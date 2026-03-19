import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { createHmac, timingSafeEqual } from "crypto";
import { storage } from "./storage";
import { addToCartSchema, bundles } from "@shared/schema";
import type { DiscountTierRule } from "@shared/schema";
import { getShopify, shopifyConfigured, sessionStorage, getAppUrl } from "./shopify";
import { log } from "./index";
import {
  getSubscriptionStatus,
  checkSubscriptionLive,
  createAppSubscription,
  verifyAppSubscription,
  upsertFreeSubscription,
  getPlanFeatures,
  PLANS,
  type PlanTier,
} from "./billing";
import {
  listBundles,
  getBundle,
  createBundle,
  updateBundle,
  deleteBundle,
  toBundleInsert,
  getBundlesForProduct,
} from "./bundle-db";
import type { SlotSeed } from "./bundle-db";
import { z } from "zod";
import { db } from "./db";
import { bundleEvents, bundleEventTypeZodEnum } from "@shared/schema";
import { eq, and, gte, sql as drizzleSql } from "drizzle-orm";

const SHOPIFY_HOST_PATTERN = /^(admin\.shopify\.com|[a-z0-9][a-z0-9-]*\.myshopify\.com)(\/|$)/i;

function decodeShopifyHost(host: string | undefined, shop: string): string {
  if (!host) return `https://${shop}/admin/apps`;
  try {
    const decoded = Buffer.from(host, "base64").toString("utf8");
    const url = new URL(decoded.startsWith("https://") ? decoded : `https://${decoded}`);
    if (!SHOPIFY_HOST_PATTERN.test(url.hostname)) {
      log(`Untrusted host param decoded to ${url.hostname} — falling back to shop admin`);
      return `https://${shop}/admin/apps`;
    }
    return url.href;
  } catch {
    return `https://${shop}/admin/apps`;
  }
}

const slotProductSchema = z.object({
  shopifyProductId: z.string().optional().default(""),
  shopifyVariantId: z.string().nullable().optional(),
  productTitle: z.string().min(1),
  variantTitle: z.string().nullable().optional(),
  productImage: z.string().nullable().optional(),
});

const bundleSlotSchema = z.object({
  name: z.string().min(1),
  imageUrl: z.string().nullable().optional(),
  shopifyCollectionId: z.string().nullable().optional(),
  shopifyCollectionTitle: z.string().nullable().optional(),
  minQty: z.number().int().min(1).default(1),
  maxQty: z.number().int().min(1).nullable().optional(),
  products: z.array(slotProductSchema).default([]),
}).superRefine((s, ctx) => {
  if (!s.shopifyCollectionId && s.products.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.too_small,
      minimum: 1,
      inclusive: true,
      type: "array",
      message: "Each slot must have at least one product or a linked collection",
      path: ["products"],
    });
  }
  if (s.maxQty != null && s.maxQty < s.minQty) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "maxQty must be greater than or equal to minQty",
      path: ["maxQty"],
    });
  }
});

const tierItemSchema = z.object({
  minQty: z.number().int().min(1),
  discountValue: z.number().min(0),
});

const bundleBodySchema = z.object({
  shop: z.string().optional(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  discountType: z.enum(["percentage", "fixed"]).default("percentage"),
  discountTiers: z.array(tierItemSchema)
    .min(1, "At least one discount tier is required")
    .refine(
      (tiers) => new Set(tiers.map((t) => t.minQty)).size === tiers.length,
      { message: "Discount tier quantities must be unique" }
    ),
  discountEnabled: z.boolean().optional().default(true),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  slots: z.array(bundleSlotSchema).min(1, "At least one product slot is required"),
});

function verifyWebhookHmac(body: string, hmacHeader: string): boolean {
  const secret = process.env.SHOPIFY_API_SECRET || "";
  if (!secret) return false;
  const digest = createHmac("sha256", secret).update(body).digest("base64");
  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}

function getHeaderString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function getRawBody(req: Request): string {
  if (typeof (req as Request & { rawBody?: unknown }).rawBody === "string") {
    return (req as Request & { rawBody: string }).rawBody;
  }
  if (Buffer.isBuffer((req as Request & { rawBody?: unknown }).rawBody)) {
    return (req as Request & { rawBody: Buffer }).rawBody.toString();
  }
  return JSON.stringify(req.body);
}

interface AuthenticatedRequest extends Request {
  shopifyShop?: string;
  billingChecked?: boolean;
}

function makeShopifyAuthMiddleware() {
  const shopify = getShopify();
  return async function shopifyAuthMiddleware(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    if (!shopify || !shopifyConfigured) {
      next();
      return;
    }
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized: missing Shopify session token" });
      return;
    }
    const token = authorization.slice(7);
    try {
      const payload = await shopify.session.decodeSessionToken(token);
      const shopFromToken = payload.dest?.replace(/^https?:\/\//, "");

      const requestedShop =
        (req.query.shop as string | undefined) ??
        (req.body as Record<string, unknown> | undefined)?.shop as string | undefined;

      if (requestedShop && shopFromToken && requestedShop !== shopFromToken) {
        res.status(401).json({ error: "Unauthorized: shop context mismatch" });
        return;
      }

      req.shopifyShop = shopFromToken ?? requestedShop ?? "";
      next();
    } catch {
      res.status(401).json({ error: "Unauthorized: invalid Shopify session token" });
    }
  };
}

function resolveShop(
  req: AuthenticatedRequest,
  fromBody?: string
): string | undefined {
  const token = req.shopifyShop;
  if (token) return token;
  const query = req.query.shop as string | undefined;
  const candidate = fromBody || query;
  if (shopifyConfigured) {
    return candidate;
  }
  return candidate || "dev-preview";
}

function makeRequireActiveSubscription() {
  const shopify = getShopify();
  return async function requireActiveSubscription(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    if (!shopify || !shopifyConfigured) {
      next();
      return;
    }
    const shop = resolveShop(req);
    if (!shop) {
      res.status(401).json({ error: "Unauthorized: missing shop context" });
      return;
    }
    try {
      const sessions = await sessionStorage.findSessionsByShop(shop);
      const session = sessions.find((s) => !!s.accessToken);
      if (session) {
        try {
          const isLive = await checkSubscriptionLive(shopify, session);
          if (isLive) {
            next();
            return;
          }
          const localStatus = await getSubscriptionStatus(shop);
          if (localStatus.hasSubscription) {
            next();
            return;
          }
          if (localStatus.status === "none") {
            await upsertFreeSubscription(shop);
            log(`Auto-enrolled ${shop} on free tier (missing subscription record)`);
            next();
            return;
          }
        } catch (liveErr) {
          log(`Billing live check for ${shop} failed, falling back to DB: ${liveErr instanceof Error ? liveErr.message : String(liveErr)}`);
          const localStatus = await getSubscriptionStatus(shop);
          if (localStatus.hasSubscription) {
            next();
            return;
          }
          if (localStatus.status === "none") {
            await upsertFreeSubscription(shop);
            log(`Auto-enrolled ${shop} on free tier (missing subscription record, fallback path)`);
            next();
            return;
          }
        }
      } else {
        const localStatus = await getSubscriptionStatus(shop);
        if (localStatus.hasSubscription) {
          next();
          return;
        }
        if (localStatus.status === "none") {
          await upsertFreeSubscription(shop);
          log(`Auto-enrolled ${shop} on free tier (no session, missing subscription record)`);
          next();
          return;
        }
      }
      res.status(402).json({
        error: "Subscription required",
        billingRequired: true,
        message: "An active SiGNL Bundle Builder subscription is required to use this app.",
      });
    } catch (err) {
      log(`requireActiveSubscription error for ${shop}: ${err instanceof Error ? err.message : String(err)}`);
      res.status(402).json({
        error: "Subscription check failed",
        billingRequired: true,
        message: "Unable to verify subscription status. Please try again.",
      });
    }
  };
}

async function ensureAutomaticDiscount(
  shopifyInstance: NonNullable<ReturnType<typeof getShopify>>,
  session: Awaited<ReturnType<typeof sessionStorage.findSessionsByShop>>[number],
  functionId: string
): Promise<string | null> {
  const client = new shopifyInstance.clients.Graphql({ session });

  const listResult = await client.query({
    data: {
      query: `query {
        automaticDiscountNodes(first: 20) {
          nodes {
            id
            automaticDiscount {
              ... on DiscountAutomaticApp {
                title
                appDiscountType { functionId }
              }
            }
          }
        }
      }`,
    },
  });

  const listBody = listResult.body as Record<string, unknown>;
  const nodes = ((listBody.data as Record<string, unknown>)?.automaticDiscountNodes as Record<string, unknown>)?.nodes as Array<Record<string, unknown>> ?? [];
  const existing = nodes.find((n) => {
    const d = n.automaticDiscount as Record<string, unknown> | undefined;
    return (d?.appDiscountType as Record<string, unknown> | undefined)?.functionId === functionId;
  });

  if (existing) return existing.id as string;

  const createResult = await client.query({
    data: {
      query: `mutation DiscountAutomaticAppCreate($automaticAppDiscount: DiscountAutomaticAppInput!) {
        discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
          automaticAppDiscount { discountId }
          userErrors { field message }
        }
      }`,
      variables: {
        automaticAppDiscount: {
          title: "SiGNL Bundle Discount",
          functionId,
          startsAt: new Date().toISOString(),
          combinesWith: {
            orderDiscounts: false,
            productDiscounts: false,
            shippingDiscounts: true,
          },
        },
      },
    },
  });

  const createBody = createResult.body as Record<string, unknown>;
  const created = ((createBody.data as Record<string, unknown>)?.discountAutomaticAppCreate as Record<string, unknown>)?.automaticAppDiscount as Record<string, unknown> | undefined;
  const errors = ((createBody.data as Record<string, unknown>)?.discountAutomaticAppCreate as Record<string, unknown>)?.userErrors as Array<{ field: string; message: string }> | undefined;
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(", "));
  return (created?.discountId as string) ?? null;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const shopify = getShopify();
  const shopifyAuth = makeShopifyAuthMiddleware();
  const requireBilling = makeRequireActiveSubscription();

  if (shopify && shopifyConfigured) {
    app.get("/auth", async (req: Request, res: Response) => {
      const rawShop = req.query.shop as string | undefined;
      const sanitizedShop = rawShop
        ? shopify.utils.sanitizeShop(rawShop, true)
        : null;
      if (!sanitizedShop) {
        res.status(400).send("Missing or invalid shop parameter. Expected: mystore.myshopify.com");
        return;
      }
      try {
        await shopify.auth.begin({
          shop: sanitizedShop,
          callbackPath: "/auth/callback",
          isOnline: false,
          rawRequest: req,
          rawResponse: res,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        log(`OAuth begin error: ${msg}`);
        res.status(500).send("OAuth error: " + msg);
      }
    });

    app.get("/auth/callback", async (req: Request, res: Response) => {
      try {
        const callback = await shopify.auth.callback({
          rawRequest: req,
          rawResponse: res,
        });
        const { session } = callback;
        log(`OAuth callback success for shop: ${session.shop}`);

        try {
          const registrations = await shopify.webhooks.register({ session });
          log(`Webhooks registered for ${session.shop}: ${JSON.stringify(registrations)}`);
        } catch (webhookErr: unknown) {
          const msg = webhookErr instanceof Error ? webhookErr.message : "Unknown error";
          log(`Webhook registration warning: ${msg}`);
        }

        const functionId = process.env.SHOPIFY_FUNCTION_ID;
        if (functionId) {
          try {
            await ensureAutomaticDiscount(shopify, session, functionId);
            log(`Automatic bundle discount ensured for ${session.shop}`);
          } catch (discountErr: unknown) {
            const msg = discountErr instanceof Error ? discountErr.message : "Unknown error";
            log(`Discount registration warning: ${msg}`);
          }
        }

        const host = req.query.host as string;
        try {
          await upsertFreeSubscription(session.shop);
          log(`Free subscription ensured for ${session.shop}`);
        } catch (freeErr: unknown) {
          const msg = freeErr instanceof Error ? freeErr.message : "Unknown error";
          log(`Free subscription upsert warning: ${msg}`);
        }
        const redirectUrl = host
          ? `/?shop=${session.shop}&host=${host}`
          : `/?shop=${session.shop}`;
        res.redirect(redirectUrl);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        log(`OAuth callback error: ${msg}`);
        res.status(500).send("OAuth callback error: " + msg);
      }
    });

    app.post("/api/webhooks", async (req: Request, res: Response) => {
      const topic = getHeaderString(req.headers["x-shopify-topic"]);
      const hmac = getHeaderString(req.headers["x-shopify-hmac-sha256"]);
      const rawBody = getRawBody(req);

      if (!verifyWebhookHmac(rawBody, hmac)) {
        log(`Webhook HMAC verification failed for topic: ${topic}`);
        res.status(401).send("HMAC verification failed");
        return;
      }

      log(`Webhook received: ${topic}`);
      res.status(200).send("OK");
    });

    app.post(
      "/api/webhooks/customers/data_request",
      (req: Request, res: Response) => {
        const hmac = getHeaderString(req.headers["x-shopify-hmac-sha256"]);
        const rawBody = getRawBody(req);
        if (!verifyWebhookHmac(rawBody, hmac)) {
          res.status(401).send("HMAC verification failed");
          return;
        }
        log(`GDPR: customers/data_request for shop ${req.body?.shop_domain}`);
        res.status(200).send("OK");
      }
    );

    app.post(
      "/api/webhooks/customers/redact",
      (req: Request, res: Response) => {
        const hmac = getHeaderString(req.headers["x-shopify-hmac-sha256"]);
        const rawBody = getRawBody(req);
        if (!verifyWebhookHmac(rawBody, hmac)) {
          res.status(401).send("HMAC verification failed");
          return;
        }
        log(`GDPR: customers/redact for shop ${req.body?.shop_domain}`);
        res.status(200).send("OK");
      }
    );

    app.post("/api/webhooks/shop/redact", (req: Request, res: Response) => {
      const hmac = getHeaderString(req.headers["x-shopify-hmac-sha256"]);
      const rawBody = getRawBody(req);
      if (!verifyWebhookHmac(rawBody, hmac)) {
        res.status(401).send("HMAC verification failed");
        return;
      }
      log(`GDPR: shop/redact for shop ${req.body?.shop_domain}`);
      res.status(200).send("OK");
    });

    app.post("/api/webhooks/orders/paid", async (req: Request, res: Response) => {
      const hmac = getHeaderString(req.headers["x-shopify-hmac-sha256"]);
      const shop = getHeaderString(req.headers["x-shopify-shop-domain"]);
      const rawBody = getRawBody(req);
      if (!verifyWebhookHmac(rawBody, hmac)) {
        log(`orders/paid: HMAC verification failed`);
        res.status(401).send("HMAC verification failed");
        return;
      }
      res.status(200).send("OK");

      try {
        const order = req.body as Record<string, unknown>;
        const lineItems = (order.line_items as Array<Record<string, unknown>>) ?? [];
        const bundleIdSet = new Set<number>();
        for (const item of lineItems) {
          const props = (item.properties as Array<{ name: string; value: string }>) ?? [];
          for (const prop of props) {
            if (prop.name === "_bundleId") {
              const id = parseInt(prop.value, 10);
              if (!isNaN(id) && id > 0) bundleIdSet.add(id);
            }
          }
        }
        if (bundleIdSet.size > 0 && shop) {
          await Promise.all(
            [...bundleIdSet].map((bundleId) =>
              db.insert(bundleEvents).values({ shop, bundleId, eventType: "order" }).catch((e) => {
                log(`orders/paid: failed to insert order event for bundle ${bundleId}: ${e}`);
              })
            )
          );
          log(`orders/paid: recorded ${bundleIdSet.size} order event(s) for shop ${shop}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        log(`orders/paid processing error: ${msg}`);
      }
    });

    app.get("/api/auth/status", async (req: Request, res: Response) => {
      const rawShop = req.query.shop as string | undefined;
      const shop = rawShop ? (shopify.utils.sanitizeShop(rawShop, true) ?? null) : null;
      if (!shop) {
        res.json({ configured: true, authenticated: false });
        return;
      }
      try {
        const sessions = await sessionStorage.findSessionsByShop(shop);
        const hasSession = sessions.some((s) => !!s.accessToken);
        res.json({ configured: true, authenticated: hasSession, shop });
      } catch {
        res.json({ configured: true, authenticated: false, shop });
      }
    });
  } else {
    app.get("/api/auth/status", (_req: Request, res: Response) => {
      res.json({
        configured: false,
        authenticated: false,
        message:
          "Set SHOPIFY_API_KEY, SHOPIFY_API_SECRET, and SHOPIFY_APP_URL to enable Shopify OAuth.",
      });
    });
  }

  app.get("/api/bundles", shopifyAuth, requireBilling, async (req: Request, res: Response) => {
    const authedReq = req as AuthenticatedRequest;
    const shop = resolveShop(authedReq);
    if (!shop) {
      res.status(401).json({ error: "Unauthorized: missing shop context" });
      return;
    }
    try {
      const result = await listBundles(shop);
      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      log(`List bundles error: ${msg}`);
      res.status(500).json({ error: "Failed to fetch bundles" });
    }
  });

  app.get("/api/bundles/:id", shopifyAuth, requireBilling, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid bundle ID" });
      return;
    }
    const authedReq = req as AuthenticatedRequest;
    const shop = resolveShop(authedReq);
    if (!shop) {
      res.status(401).json({ error: "Unauthorized: missing shop context" });
      return;
    }
    try {
      const bundle = await getBundle(id, shop);
      if (!bundle) {
        res.status(404).json({ error: "Bundle not found" });
        return;
      }
      res.json(bundle);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      log(`Get bundle error: ${msg}`);
      res.status(500).json({ error: "Failed to fetch bundle" });
    }
  });

  app.post("/api/bundles", shopifyAuth, requireBilling, async (req: Request, res: Response) => {
    const parsed = bundleBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid data", details: parsed.error.flatten() });
      return;
    }
    const { slots, ...rawBundle } = parsed.data;
    const authedReq = req as AuthenticatedRequest;
    const canonicalShop = resolveShop(authedReq, rawBundle.shop);
    if (!canonicalShop) {
      res.status(401).json({ error: "Unauthorized: missing shop context" });
      return;
    }
    try {
      const bundleInsert = toBundleInsert({ ...rawBundle, shop: canonicalShop });
      const slotSeeds: SlotSeed[] = slots.map((s) => ({
        name: s.name,
        imageUrl: s.imageUrl ?? null,
        shopifyCollectionId: s.shopifyCollectionId ?? null,
        shopifyCollectionTitle: s.shopifyCollectionTitle ?? null,
        minQty: s.minQty,
        maxQty: s.maxQty ?? null,
        products: s.products.map((p) => ({
          shopifyProductId: p.shopifyProductId,
          shopifyVariantId: p.shopifyVariantId ?? null,
          productTitle: p.productTitle,
          variantTitle: p.variantTitle ?? null,
          productImage: p.productImage ?? null,
        })),
      }));
      const bundle = await createBundle(bundleInsert, slotSeeds);
      res.status(201).json(bundle);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      log(`Create bundle error: ${msg}`);
      res.status(500).json({ error: "Failed to create bundle" });
    }
  });

  app.put("/api/bundles/:id", shopifyAuth, requireBilling, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid bundle ID" });
      return;
    }
    const parsed = bundleBodySchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid data", details: parsed.error.flatten() });
      return;
    }
    const { slots, shop: _clientShop, ...rawBundle } = parsed.data;
    const authedReq = req as AuthenticatedRequest;
    const canonicalShop = resolveShop(authedReq, _clientShop);
    if (!canonicalShop) {
      res.status(401).json({ error: "Unauthorized: missing shop context" });
      return;
    }
    try {
      const updateData: Partial<Omit<typeof bundles.$inferInsert, "id" | "shop">> = {
        ...(rawBundle.name !== undefined && { name: rawBundle.name }),
        ...(rawBundle.description !== undefined && { description: rawBundle.description }),
        ...(rawBundle.discountType !== undefined && { discountType: rawBundle.discountType }),
        ...(rawBundle.discountTiers !== undefined && { discountTiers: rawBundle.discountTiers as DiscountTierRule[] }),
        ...(rawBundle.discountEnabled !== undefined && { discountEnabled: rawBundle.discountEnabled }),
        ...(rawBundle.status !== undefined && { status: rawBundle.status }),
      };

      const slotSeeds: SlotSeed[] | undefined = slots?.map((s) => ({
        name: s.name,
        imageUrl: s.imageUrl ?? null,
        shopifyCollectionId: s.shopifyCollectionId ?? null,
        shopifyCollectionTitle: s.shopifyCollectionTitle ?? null,
        minQty: s.minQty,
        maxQty: s.maxQty ?? null,
        products: s.products.map((p) => ({
          shopifyProductId: p.shopifyProductId,
          shopifyVariantId: p.shopifyVariantId ?? null,
          productTitle: p.productTitle,
          variantTitle: p.variantTitle ?? null,
          productImage: p.productImage ?? null,
        })),
      }));

      const bundle = await updateBundle(id, canonicalShop, updateData, slotSeeds);
      if (!bundle) {
        res.status(404).json({ error: "Bundle not found" });
        return;
      }
      res.json(bundle);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      log(`Update bundle error: ${msg}`);
      res.status(500).json({ error: "Failed to update bundle" });
    }
  });

  app.delete("/api/bundles/:id", shopifyAuth, requireBilling, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid bundle ID" });
      return;
    }
    const authedReq = req as AuthenticatedRequest;
    const shop = resolveShop(authedReq);
    if (!shop) {
      res.status(401).json({ error: "Unauthorized: missing shop context" });
      return;
    }
    try {
      const deleted = await deleteBundle(id, shop);
      if (!deleted) {
        res.status(404).json({ error: "Bundle not found" });
        return;
      }
      res.json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      log(`Delete bundle error: ${msg}`);
      res.status(500).json({ error: "Failed to delete bundle" });
    }
  });

  /* GET /api/shopify/collection-products?collectionId=gid://shopify/Collection/123
   * Fetches products from a Shopify collection using the Admin API.
   * Requires a valid Shopify session (admin-only). */
  app.get("/api/shopify/collection-products", shopifyAuth, async (req: Request, res: Response) => {
    const authedReq = req as AuthenticatedRequest;
    const shop = resolveShop(authedReq);
    if (!shop) {
      res.status(401).json({ error: "Unauthorized: missing shop context" });
      return;
    }
    const collectionId = req.query.collectionId as string | undefined;
    if (!collectionId) {
      res.status(400).json({ error: "Missing collectionId" });
      return;
    }

    const shopifyInstance = getShopify();
    if (!shopifyInstance) {
      res.status(503).json({ error: "Shopify not configured" });
      return;
    }

    try {
      const sessions = await sessionStorage.findSessionsByShop(shop);
      const session = sessions.find((s) => !!s.accessToken);
      if (!session) {
        res.status(401).json({ error: "No active session for shop" });
        return;
      }

      const numericId = collectionId.replace(/\D/g, "");
      if (!numericId) {
        res.status(400).json({ error: "Invalid collectionId" });
        return;
      }

      const client = new shopifyInstance.clients.Rest({ session });
      const response = await client.get({
        path: `products`,
        query: { collection_id: numericId, limit: "50", fields: "id,title,images,variants" },
      });

      const rawProducts = (response.body as Record<string, unknown>).products as Array<Record<string, unknown>> ?? [];
      const products = rawProducts.map((p) => {
        const images = p.images as Array<Record<string, unknown>>;
        const variants = p.variants as Array<Record<string, unknown>>;
        const productImage = images?.[0]?.src as string ?? null;
        return {
          shopifyProductId: `gid://shopify/Product/${p.id as number}`,
          productTitle: p.title as string,
          productImage,
          variants: (variants ?? []).map((v) => ({
            shopifyVariantId: `gid://shopify/ProductVariant/${v.id as number}`,
            variantTitle: v.title as string,
            price: v.price as string,
          })),
        };
      });

      res.json({ products });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      log(`Collection products error: ${msg}`);
      res.status(500).json({ error: "Failed to fetch collection products" });
    }
  });

  app.get("/api/products", async (_req, res) => {
    try {
      const products = await storage.getProductTypes();
      res.json(products);
    } catch {
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/categories", async (_req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.get("/api/discount-tiers", async (_req, res) => {
    try {
      const tiers = await storage.getDiscountTiers();
      res.json(tiers);
    } catch {
      res.status(500).json({ error: "Failed to fetch discount tiers" });
    }
  });

  /* ── Shopify Function discount registration ───────────────────────────── */
  // All three endpoints require shopifyAuth so shop is always derived from
  // the authenticated Shopify session token, never trusted from request body/query.

  app.get("/api/shop/discount", shopifyAuth, requireBilling, async (req: Request, res: Response) => {
    if (!shopifyConfigured) {
      res.json({ configured: false, functionIdSet: false, active: false });
      return;
    }
    const authedReq = req as AuthenticatedRequest;
    const shop = resolveShop(authedReq) || "";
    const functionId = process.env.SHOPIFY_FUNCTION_ID || "";
    if (!functionId) {
      res.json({ configured: true, functionIdSet: false, active: false });
      return;
    }
    try {
      const sessions = await sessionStorage.findSessionsByShop(shop);
      const session = sessions.find((s) => !!s.accessToken);
      if (!session) {
        res.json({ configured: true, functionIdSet: true, active: false, error: "No session found" });
        return;
      }
      const shopifyInstance = getShopify()!;
      const client = new shopifyInstance.clients.Graphql({ session });
      const result = await client.query({
        data: {
          query: `query {
            automaticDiscountNodes(first: 20) {
              nodes {
                id
                automaticDiscount {
                  ... on DiscountAutomaticApp {
                    title
                    status
                    appDiscountType { functionId }
                  }
                }
              }
            }
          }`,
        },
      });
      const body = result.body as Record<string, unknown>;
      const nodes = ((body.data as Record<string, unknown>)?.automaticDiscountNodes as Record<string, unknown>)?.nodes as Array<Record<string, unknown>> ?? [];
      const match = nodes.find((n) => {
        const d = n.automaticDiscount as Record<string, unknown> | undefined;
        return (d?.appDiscountType as Record<string, unknown> | undefined)?.functionId === functionId;
      });
      res.json({
        configured: true,
        functionIdSet: true,
        active: !!match,
        discountId: match?.id ?? null,
        title: match ? ((match.automaticDiscount as Record<string, unknown>)?.title ?? null) : null,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/shop/discount", shopifyAuth, requireBilling, async (req: Request, res: Response) => {
    if (!shopifyConfigured) {
      res.status(503).json({ error: "Shopify not configured" });
      return;
    }
    const functionId = process.env.SHOPIFY_FUNCTION_ID || "";
    if (!functionId) {
      res.status(400).json({
        error: "SHOPIFY_FUNCTION_ID is not configured. Run `shopify app deploy` to deploy the function, then set SHOPIFY_FUNCTION_ID to the returned function ID in your Replit Secrets.",
      });
      return;
    }
    const authedReq = req as AuthenticatedRequest;
    const shop = resolveShop(authedReq);
    if (!shop) {
      res.status(401).json({ error: "Unauthorized: missing shop context" });
      return;
    }
    try {
      const sessions = await sessionStorage.findSessionsByShop(shop);
      const session = sessions.find((s) => !!s.accessToken);
      if (!session) {
        res.status(404).json({ error: "No session found for shop" });
        return;
      }
      const shopifyInstance = getShopify()!;
      const discountId = await ensureAutomaticDiscount(shopifyInstance, session, functionId);
      res.json({ success: true, discountId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: msg });
    }
  });

  app.delete("/api/shop/discount", shopifyAuth, requireBilling, async (req: Request, res: Response) => {
    if (!shopifyConfigured) {
      res.status(503).json({ error: "Shopify not configured" });
      return;
    }
    const authedReq = req as AuthenticatedRequest;
    const shop = resolveShop(authedReq);
    if (!shop) {
      res.status(401).json({ error: "Unauthorized: missing shop context" });
      return;
    }
    const { discountId } = req.body as { discountId?: string };
    if (!discountId) {
      res.status(400).json({ error: "Missing discountId" });
      return;
    }
    try {
      const sessions = await sessionStorage.findSessionsByShop(shop);
      const session = sessions.find((s) => !!s.accessToken);
      if (!session) {
        res.status(404).json({ error: "No session found for shop" });
        return;
      }
      const shopifyInstance = getShopify()!;
      const client = new shopifyInstance.clients.Graphql({ session });
      await client.query({
        data: {
          query: `mutation DiscountAutomaticDelete($id: ID!) {
            discountAutomaticDelete(id: $id) {
              deletedAutomaticDiscountId
              userErrors { field message }
            }
          }`,
          variables: { id: discountId },
        },
      });
      res.json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: msg });
    }
  });

  /* ── Analytics endpoints ──────────────────────────────────────────────── */

  /* POST /api/events — public, unauthenticated, rate-limited-ish via validation
   * Accepts { shop, bundleId, eventType } from storefront widget */
  const eventIngestSchema = z.object({
    shop: z.string().regex(/^[a-zA-Z0-9-]+\.myshopify\.com$/),
    bundleId: z.number().int().positive(),
    eventType: bundleEventTypeZodEnum,
  });

  const eventRateMap = new Map<string, { count: number; resetAt: number }>();
  const EVENT_RATE_LIMIT = 50;
  const EVENT_RATE_WINDOW_MS = 60 * 1000;

  function checkEventRateLimit(key: string): boolean {
    const now = Date.now();
    const entry = eventRateMap.get(key);
    if (!entry || now > entry.resetAt) {
      eventRateMap.set(key, { count: 1, resetAt: now + EVENT_RATE_WINDOW_MS });
      return true;
    }
    if (entry.count >= EVENT_RATE_LIMIT) return false;
    entry.count++;
    return true;
  }

  app.options("/api/events", (_req: Request, res: Response) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.sendStatus(204);
  });

  app.post("/api/events", async (req: Request, res: Response) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const parsed = eventIngestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid event data" });
      return;
    }
    const { shop, bundleId, eventType } = parsed.data;
    const rateLimitKey = `${shop}:${req.ip ?? "unknown"}`;
    if (!checkEventRateLimit(rateLimitKey)) {
      res.status(429).json({ error: "Rate limit exceeded" });
      return;
    }
    try {
      await db.insert(bundleEvents).values({ shop, bundleId, eventType });
      res.status(201).json({ ok: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      log(`Event insert error: ${msg}`);
      res.status(500).json({ error: "Failed to record event" });
    }
  });

  /* GET /api/analytics?shop=&days=
   * Protected by shopifyAuth + requireBilling
   * Returns per-bundle stats aggregated from bundle_events */
  app.get("/api/analytics", shopifyAuth, requireBilling, async (req: Request, res: Response) => {
    const authedReq = req as AuthenticatedRequest;
    const shop = resolveShop(authedReq);
    if (!shop) {
      res.status(401).json({ error: "Unauthorized: missing shop context" });
      return;
    }
    const rawDays = parseInt((req.query.days as string) || "30", 10);
    const days = [7, 30, 90].includes(rawDays) ? rawDays : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    try {
      const rows = await db
        .select({
          bundleId: bundleEvents.bundleId,
          eventType: bundleEvents.eventType,
          count: drizzleSql<number>`cast(count(*) as integer)`,
        })
        .from(bundleEvents)
        .where(and(eq(bundleEvents.shop, shop), gte(bundleEvents.createdAt, since)))
        .groupBy(bundleEvents.bundleId, bundleEvents.eventType);

      const bundleIds = [...new Set(rows.map((r) => r.bundleId))];

      let bundleNames: Record<number, string> = {};
      if (bundleIds.length > 0) {
        const bundleRows = await listBundles(shop);
        bundleRows.forEach((b) => { bundleNames[b.id] = b.name; });
      }

      const statsMap: Record<number, { views: number; carts: number; orders: number }> = {};
      rows.forEach(({ bundleId, eventType, count }) => {
        if (!statsMap[bundleId]) statsMap[bundleId] = { views: 0, carts: 0, orders: 0 };
        if (eventType === "view") statsMap[bundleId].views = count;
        else if (eventType === "add_to_cart") statsMap[bundleId].carts = count;
        else if (eventType === "order") statsMap[bundleId].orders = count;
      });

      const stats = Object.entries(statsMap).map(([idStr, s]) => {
        const bundleId = parseInt(idStr, 10);
        const conversionRate = s.views > 0 ? Math.round((s.orders / s.views) * 100 * 10) / 10 : 0;
        return {
          bundleId,
          bundleName: bundleNames[bundleId] ?? `Bundle #${bundleId}`,
          views: s.views,
          carts: s.carts,
          orders: s.orders,
          conversionRate,
        };
      });

      stats.sort((a, b) => b.views - a.views);

      const totalViews = stats.reduce((s, x) => s + x.views, 0);
      const totalCarts = stats.reduce((s, x) => s + x.carts, 0);
      const totalOrders = stats.reduce((s, x) => s + x.orders, 0);

      res.json({ days, totalViews, totalCarts, totalOrders, stats });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      log(`Analytics error: ${msg}`);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  /* ── Storefront public endpoints (CORS-enabled, no auth) ──────────────── */

  function setCorsStorefront(res: Response): void {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  app.options("/api/storefront/bundles", (_req: Request, res: Response) => {
    setCorsStorefront(res);
    res.sendStatus(204);
  });

  /* GET /api/storefront/bundles?shop=xxx&productId=gid://shopify/Product/yyy
   * Returns active bundles for a product page. For slot products without a specific
   * shopifyVariantId the server resolves available variants server-side (using the
   * shop's existing Admin API session) and inlines them as `availableVariants`. This
   * keeps Admin API access entirely server-side — no open proxy endpoint is exposed. */

  const variantCache = new Map<string, { variants: unknown[]; expiresAt: number }>();

  async function resolveVariants(
    shopifyInstance: ReturnType<typeof getShopify>,
    shop: string,
    productGid: string
  ): Promise<unknown[]> {
    const cacheKey = `${shop}:${productGid}`;
    const cached = variantCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.variants;

    const numericIdMatch = productGid.match(/\/(\d+)$/);
    if (!numericIdMatch || !shopifyInstance) return [];

    const sessions = await sessionStorage.findSessionsByShop(shop);
    const session = sessions.find((s) => !!s.accessToken);
    if (!session) return [];

    const client = new shopifyInstance.clients.Rest({ session });
    const response = await client.get({ path: `products/${numericIdMatch[1]}` });
    const product = (response.body as Record<string, unknown>).product as Record<string, unknown> | undefined;
    if (!product) return [];

    const productImage = ((product.image as Record<string, unknown> | null)?.src ?? null) as string | null;
    const rawVariants = product.variants as Array<Record<string, unknown>>;
    const variants = rawVariants.map((v) => ({
      id: v.id as number,
      title: v.title as string,
      price: v.price as string,
      available: v.inventory_management === null || (v.inventory_quantity as number) > 0,
      image: productImage,
    }));

    variantCache.set(cacheKey, { variants, expiresAt: Date.now() + 5 * 60 * 1000 });
    return variants;
  }

  app.get("/api/storefront/bundles", async (req: Request, res: Response) => {
    setCorsStorefront(res);
    const shop = req.query.shop as string | undefined;
    const productId = req.query.productId as string | undefined;
    const bundleId = req.query.bundleId as string | undefined;

    if (!shop || (!productId && !bundleId)) {
      res.status(400).json({ error: "Missing shop and either productId or bundleId" });
      return;
    }
    if (!/^[a-zA-Z0-9-]+\.myshopify\.com$/.test(shop)) {
      res.status(400).json({ error: "Invalid shop domain" });
      return;
    }
    try {
      let result;
      if (bundleId) {
        if (!/^\d+$/.test(bundleId)) {
          res.status(400).json({ error: "Invalid bundleId: must be a positive integer" });
          return;
        }
        const numericId = parseInt(bundleId, 10);
        if (isNaN(numericId)) {
          res.status(400).json({ error: "Invalid bundleId" });
          return;
        }
        const bundle = await getBundle(numericId, shop);
        result = bundle && bundle.status === "active" ? [bundle] : [];
      } else {
        result = await getBundlesForProduct(shop, productId!);
      }
      const shopifyInstance = getShopify();

      const enriched = await Promise.all(result.map(async (bundle) => {
        const enrichedSlots = await Promise.all(bundle.slots.map(async (slot) => {
          const enrichedProducts = await Promise.all(slot.products.map(async (product) => {
            if (!product.shopifyVariantId && product.shopifyProductId && shopifyInstance) {
              const availableVariants = await resolveVariants(shopifyInstance, shop, product.shopifyProductId).catch(() => []);
              return { ...product, availableVariants };
            }
            return product;
          }));
          return { ...slot, products: enrichedProducts };
        }));
        return { ...bundle, slots: enrichedSlots };
      }));

      res.json(enriched);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      log(`Storefront bundles error: ${msg}`);
      res.status(500).json({ error: "Failed to fetch bundles" });
    }
  });

  app.post("/api/cart/bundle", async (req, res) => {
    const parsed = addToCartSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request data" });
      return;
    }
    try {
      const bundle = await storage.createCartBundle(parsed.data);
      res.json({ success: true, bundle });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(400).json({ error: msg });
    }
  });

  app.get("/api/billing/status", shopifyAuth, async (req: Request, res: Response) => {
    const authedReq = req as AuthenticatedRequest;
    const shop = resolveShop(authedReq);
    if (!shop) {
      res.status(401).json({ error: "Unauthorized: missing shop context" });
      return;
    }
    try {
      const status = await getSubscriptionStatus(shop);
      const features = getPlanFeatures(status.planTier);
      res.json({ ...status, ...features });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      log(`Billing status error: ${msg}`);
      res.status(500).json({ error: "Failed to get billing status" });
    }
  });

  app.get("/api/billing/features", shopifyAuth, async (req: Request, res: Response) => {
    const authedReq = req as AuthenticatedRequest;
    const shop = resolveShop(authedReq);
    if (!shop) {
      res.status(401).json({ error: "Unauthorized: missing shop context" });
      return;
    }
    try {
      const status = await getSubscriptionStatus(shop);
      const features = getPlanFeatures(status.planTier);
      res.json(features);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      log(`Billing features error: ${msg}`);
      res.status(500).json({ error: "Failed to get plan features" });
    }
  });

  if (shopify && shopifyConfigured) {
    app.post("/api/billing/subscribe", shopifyAuth, async (req: Request, res: Response) => {
      const authedReq = req as AuthenticatedRequest;
      const shop = resolveShop(authedReq);
      if (!shop) {
        res.status(401).json({ error: "Unauthorized: missing shop context" });
        return;
      }
      try {
        const sessions = await sessionStorage.findSessionsByShop(shop);
        const session = sessions.find((s) => !!s.accessToken);
        if (!session) {
          res.status(401).json({ error: "No active session for shop" });
          return;
        }
        const rawPlan = (req.query.plan as string) || "essential";
        const planTier: PlanTier = rawPlan === "pro" ? "pro" : "essential";
        const host = (req.query.host as string) || "";
        const returnUrl = `${getAppUrl()}/billing/return?shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(host)}`;
        const confirmationUrl = await createAppSubscription(shopify, session, returnUrl, planTier);
        res.json({ confirmationUrl });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        log(`Billing subscribe error: ${msg}`);
        res.status(500).json({ error: `Failed to create subscription: ${msg}` });
      }
    });

    app.get("/billing/return", async (req: Request, res: Response) => {
      const shop = req.query.shop as string | undefined;
      const host = req.query.host as string | undefined;
      const chargeId = req.query.charge_id as string | undefined;

      if (!shop) {
        res.status(400).send("Missing shop parameter");
        return;
      }

      if (!chargeId) {
        const exitUrl = decodeShopifyHost(host, shop);
        res.send(
          `<!DOCTYPE html><html><head><title>Subscription Declined</title>` +
          `<script>` +
          `var msg=document.createElement("p");msg.textContent="Subscription declined. Redirecting to Shopify admin...";document.body.appendChild(msg);` +
          `if(window.top===window.self){window.location.href=${JSON.stringify(exitUrl)};}` +
          `else{window.top.location.href=${JSON.stringify(exitUrl)};}` +
          `</script></head><body></body></html>`
        );
        return;
      }

      try {
        const sessions = await sessionStorage.findSessionsByShop(shop);
        const session = sessions.find((s) => !!s.accessToken);
        if (!session) {
          res.status(401).send("No active session for shop");
          return;
        }
        const status = await verifyAppSubscription(shopify, session, chargeId);
        log(`Billing return for ${shop}: charge ${chargeId} status=${status}`);

        if (status === "active" || status === "pending") {
          const redirectUrl = host
            ? `/billing?shop=${shop}&host=${host}&billing=${status}`
            : `/billing?shop=${shop}&billing=${status}`;
          res.redirect(redirectUrl);
        } else {
          const exitUrl = decodeShopifyHost(host, shop);
          res.send(
            `<!DOCTYPE html><html><head><title>Subscription Not Approved</title>` +
            `<script>` +
            `var msg=document.createElement("p");msg.textContent="Subscription not approved (${status}). Redirecting to Shopify admin...";document.body.appendChild(msg);` +
            `if(window.top===window.self){window.location.href=${JSON.stringify(exitUrl)};}` +
            `else{window.top.location.href=${JSON.stringify(exitUrl)};}` +
            `</script></head><body></body></html>`
          );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        log(`Billing return error: ${msg}`);
        const exitUrl = decodeShopifyHost(host, shop);
        res.send(
          `<!DOCTYPE html><html><head><title>Billing Error</title>` +
          `<script>` +
          `var msg=document.createElement("p");msg.textContent="Billing error. Redirecting to Shopify admin...";document.body.appendChild(msg);` +
          `if(window.top===window.self){window.location.href=${JSON.stringify(exitUrl)};}` +
          `else{window.top.location.href=${JSON.stringify(exitUrl)};}` +
          `</script></head><body></body></html>`
        );
      }
    });
  } else {
    app.post("/api/billing/subscribe", async (_req: Request, res: Response) => {
      res.json({
        confirmationUrl: null,
        message: "Billing not configured — Shopify credentials required",
      });
    });
  }

  return httpServer;
}
