import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { addToCartSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/products", async (_req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/tiers", async (_req, res) => {
    try {
      const tiers = await storage.getTiers();
      res.json(tiers);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch tiers" });
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
