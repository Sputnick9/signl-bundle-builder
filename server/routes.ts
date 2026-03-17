import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { createHmac } from "crypto";
import { storage } from "./storage";
import { addToCartSchema, insertBundleSchema, insertBundleProductSchema } from "@shared/schema";
import { getShopify, shopifyConfigured } from "./shopify";
import { log } from "./index";
import { listBundles, getBundle, createBundle, updateBundle, deleteBundle } from "./bundle-db";
import { z } from "zod";

function verifyWebhookHmac(body: string, hmacHeader: string): boolean {
  const secret = process.env.SHOPIFY_API_SECRET || "";
  if (!secret) return false;
  const digest = createHmac("sha256", secret).update(body).digest("base64");
  return digest === hmacHeader;
}

const bundleBodySchema = insertBundleSchema.extend({
  products: z.array(
    insertBundleProductSchema.omit({ bundleId: true })
  ).optional().default([]),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const shopify = getShopify();

  if (shopify && shopifyConfigured) {
    app.get("/auth", async (req: Request, res: Response) => {
      try {
        await shopify.auth.begin({
          shop: shopify.utils.sanitizeShop(req.query.shop as string, true)!,
          callbackPath: "/auth/callback",
          isOnline: false,
          rawRequest: req,
          rawResponse: res,
        });
      } catch (err: any) {
        log(`OAuth begin error: ${err.message}`);
        res.status(500).send("OAuth error: " + err.message);
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
        const host = req.query.host as string;
        const redirectUrl = host
          ? `/?shop=${session.shop}&host=${host}`
          : `/?shop=${session.shop}`;
        res.redirect(redirectUrl);
      } catch (err: any) {
        log(`OAuth callback error: ${err.message}`);
        res.status(500).send("OAuth callback error: " + err.message);
      }
    });

    app.post("/api/webhooks", async (req: Request, res: Response) => {
      const topic = req.headers["x-shopify-topic"] as string;
      const hmac = req.headers["x-shopify-hmac-sha256"] as string;
      const rawBody =
        typeof req.rawBody === "string"
          ? req.rawBody
          : Buffer.isBuffer(req.rawBody)
            ? req.rawBody.toString()
            : JSON.stringify(req.body);

      if (!verifyWebhookHmac(rawBody, hmac)) {
        log(`Webhook HMAC verification failed for topic: ${topic}`);
        return res.status(401).send("HMAC verification failed");
      }

      log(`Webhook received: ${topic}`);
      res.status(200).send("OK");
    });

    app.post(
      "/api/webhooks/customers/data_request",
      (req: Request, res: Response) => {
        const hmac = req.headers["x-shopify-hmac-sha256"] as string;
        const rawBody =
          typeof req.rawBody === "string"
            ? req.rawBody
            : JSON.stringify(req.body);
        if (!verifyWebhookHmac(rawBody, hmac)) {
          return res.status(401).send("HMAC verification failed");
        }
        log(`GDPR: customers/data_request for shop ${req.body?.shop_domain}`);
        res.status(200).send("OK");
      }
    );

    app.post(
      "/api/webhooks/customers/redact",
      (req: Request, res: Response) => {
        const hmac = req.headers["x-shopify-hmac-sha256"] as string;
        const rawBody =
          typeof req.rawBody === "string"
            ? req.rawBody
            : JSON.stringify(req.body);
        if (!verifyWebhookHmac(rawBody, hmac)) {
          return res.status(401).send("HMAC verification failed");
        }
        log(`GDPR: customers/redact for shop ${req.body?.shop_domain}`);
        res.status(200).send("OK");
      }
    );

    app.post("/api/webhooks/shop/redact", (req: Request, res: Response) => {
      const hmac = req.headers["x-shopify-hmac-sha256"] as string;
      const rawBody =
        typeof req.rawBody === "string"
          ? req.rawBody
          : JSON.stringify(req.body);
      if (!verifyWebhookHmac(rawBody, hmac)) {
        return res.status(401).send("HMAC verification failed");
      }
      log(`GDPR: shop/redact for shop ${req.body?.shop_domain}`);
      res.status(200).send("OK");
    });

    app.get("/api/auth/status", async (req: Request, res: Response) => {
      const shop = req.query.shop as string;
      if (!shop) {
        return res.json({ configured: true, authenticated: false });
      }
      try {
        const sessions = await shopify.session.findSessionsByShop?.(shop);
        const hasSession = sessions && sessions.length > 0 && !!sessions[0]?.accessToken;
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

  app.get("/api/bundles", async (req: Request, res: Response) => {
    const shop = (req.query.shop as string) || "dev-preview";
    try {
      const result = await listBundles(shop);
      res.json(result);
    } catch (err: any) {
      log(`List bundles error: ${err.message}`);
      res.status(500).json({ error: "Failed to fetch bundles" });
    }
  });

  app.get("/api/bundles/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid bundle ID" });
    try {
      const bundle = await getBundle(id);
      if (!bundle) return res.status(404).json({ error: "Bundle not found" });
      res.json(bundle);
    } catch (err: any) {
      log(`Get bundle error: ${err.message}`);
      res.status(500).json({ error: "Failed to fetch bundle" });
    }
  });

  app.post("/api/bundles", async (req: Request, res: Response) => {
    const parsed = bundleBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid data", details: parsed.error.flatten() });
    }
    const { products, ...bundleData } = parsed.data;
    try {
      const bundle = await createBundle(bundleData, products);
      res.status(201).json(bundle);
    } catch (err: any) {
      log(`Create bundle error: ${err.message}`);
      res.status(500).json({ error: "Failed to create bundle" });
    }
  });

  app.put("/api/bundles/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid bundle ID" });
    const parsed = bundleBodySchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid data", details: parsed.error.flatten() });
    }
    const { products, ...bundleData } = parsed.data;
    try {
      const bundle = await updateBundle(id, bundleData, products);
      if (!bundle) return res.status(404).json({ error: "Bundle not found" });
      res.json(bundle);
    } catch (err: any) {
      log(`Update bundle error: ${err.message}`);
      res.status(500).json({ error: "Failed to update bundle" });
    }
  });

  app.delete("/api/bundles/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid bundle ID" });
    try {
      const deleted = await deleteBundle(id);
      if (!deleted) return res.status(404).json({ error: "Bundle not found" });
      res.json({ success: true });
    } catch (err: any) {
      log(`Delete bundle error: ${err.message}`);
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

  app.post("/api/cart/bundle", async (req, res) => {
    const parsed = addToCartSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request data" });
    }
    try {
      const bundle = await storage.createCartBundle(parsed.data);
      res.json({ success: true, bundle });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  return httpServer;
}
