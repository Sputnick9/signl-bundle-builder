import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { createHmac, timingSafeEqual } from "crypto";
import { storage } from "./storage";
import { addToCartSchema, bundles } from "@shared/schema";
import type { DiscountTierRule } from "@shared/schema";
import { getShopify, shopifyConfigured, sessionStorage } from "./shopify";
import { log } from "./index";
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

const slotProductSchema = z.object({
  shopifyProductId: z.string().optional().default(""),
  shopifyVariantId: z.string().nullable().optional(),
  productTitle: z.string().min(1),
  variantTitle: z.string().nullable().optional(),
  productImage: z.string().nullable().optional(),
});

const bundleSlotSchema = z.object({
  name: z.string().min(1),
  minQty: z.number().int().min(1).default(1),
  maxQty: z.number().int().min(1).nullable().optional(),
  products: z.array(slotProductSchema).min(1, "Each slot must have at least one product"),
}).refine(
  (s) => s.maxQty == null || s.maxQty >= s.minQty,
  { message: "maxQty must be greater than or equal to minQty", path: ["maxQty"] }
);

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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const shopify = getShopify();
  const shopifyAuth = makeShopifyAuthMiddleware();

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

        const host = req.query.host as string;
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

  app.get("/api/bundles", shopifyAuth, async (req: Request, res: Response) => {
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

  app.get("/api/bundles/:id", shopifyAuth, async (req: Request, res: Response) => {
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

  app.post("/api/bundles", shopifyAuth, async (req: Request, res: Response) => {
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

  app.put("/api/bundles/:id", shopifyAuth, async (req: Request, res: Response) => {
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
        ...(rawBundle.status !== undefined && { status: rawBundle.status }),
      };

      const slotSeeds: SlotSeed[] | undefined = slots?.map((s) => ({
        name: s.name,
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

  app.delete("/api/bundles/:id", shopifyAuth, async (req: Request, res: Response) => {
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

  app.options("/api/storefront/product-variants", (_req: Request, res: Response) => {
    setCorsStorefront(res);
    res.sendStatus(204);
  });

  /* GET /api/storefront/bundles?shop=xxx&productId=gid://shopify/Product/yyy
   * Returns active bundles containing the given product (no auth required). */
  app.get("/api/storefront/bundles", async (req: Request, res: Response) => {
    setCorsStorefront(res);
    const shop = req.query.shop as string | undefined;
    const productId = req.query.productId as string | undefined;

    if (!shop || !productId) {
      res.status(400).json({ error: "Missing shop or productId" });
      return;
    }
    if (!/^[a-zA-Z0-9-]+\.myshopify\.com$/.test(shop)) {
      res.status(400).json({ error: "Invalid shop domain" });
      return;
    }
    try {
      const result = await getBundlesForProduct(shop, productId);
      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      log(`Storefront bundles error: ${msg}`);
      res.status(500).json({ error: "Failed to fetch bundles" });
    }
  });

  /* GET /api/storefront/product-variants?shop=xxx&productId=gid://shopify/Product/yyy
   * Proxies to Shopify Admin API to return product variants (no storefront token needed). */
  app.get("/api/storefront/product-variants", async (req: Request, res: Response) => {
    setCorsStorefront(res);
    const shop = req.query.shop as string | undefined;
    const productGid = req.query.productId as string | undefined;

    if (!shop || !productGid) {
      res.status(400).json({ error: "Missing shop or productId" });
      return;
    }
    if (!/^[a-zA-Z0-9-]+\.myshopify\.com$/.test(shop)) {
      res.status(400).json({ error: "Invalid shop domain" });
      return;
    }

    const numericIdMatch = productGid.match(/\/(\d+)$/);
    if (!numericIdMatch) {
      res.status(400).json({ error: "Invalid product GID" });
      return;
    }
    const numericId = numericIdMatch[1];

    const shopifyInstance = getShopify();
    if (!shopifyInstance) {
      res.status(503).json({ error: "Shopify not configured" });
      return;
    }

    try {
      const sessions = await sessionStorage.findSessionsByShop(shop);
      const session = sessions.find((s) => !!s.accessToken);
      if (!session) {
        res.status(404).json({ error: "Shop session not found" });
        return;
      }

      const client = new shopifyInstance.clients.Rest({ session });
      const response = await client.get({ path: `products/${numericId}` });
      const product = (response.body as Record<string, unknown>).product as Record<string, unknown> | undefined;
      if (!product) {
        res.status(404).json({ error: "Product not found" });
        return;
      }

      const productImage = ((product.image as Record<string, unknown> | null)?.src ?? null) as string | null;
      const rawVariants = product.variants as Array<Record<string, unknown>>;
      const variants = rawVariants.map((v) => ({
        id: v.id as number,
        gid: `gid://shopify/ProductVariant/${v.id}`,
        title: v.title as string,
        price: v.price as string,
        available:
          v.inventory_management === null ||
          (v.inventory_quantity as number) > 0,
        image: productImage,
      }));

      res.json({
        productTitle: product.title as string,
        productImage,
        variants,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      log(`Storefront product-variants error: ${msg}`);
      res.status(500).json({ error: "Failed to fetch product variants" });
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

  return httpServer;
}
