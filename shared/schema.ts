import { z } from "zod";
import { pgTable, text, boolean, timestamp, serial, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const shopifySessions = pgTable("shopify_sessions", {
  id: text("id").primaryKey(),
  shop: text("shop").notNull(),
  state: text("state"),
  isOnline: boolean("is_online").notNull().default(false),
  scope: text("scope"),
  expires: timestamp("expires"),
  accessToken: text("access_token"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ShopifySession = typeof shopifySessions.$inferSelect;
export type InsertShopifySession = typeof shopifySessions.$inferInsert;

export interface DiscountTierRule {
  minQty: number;
  discountValue: number;
}

export const bundles = pgTable("bundles", {
  id: serial("id").primaryKey(),
  shop: text("shop").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  discountType: text("discount_type").notNull().default("percentage"),
  discountTiers: jsonb("discount_tiers").notNull().$type<DiscountTierRule[]>().default([]),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Bundle = typeof bundles.$inferSelect;

export const insertBundleSchema = createInsertSchema(bundles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBundle = z.infer<typeof insertBundleSchema>;

export const bundleProducts = pgTable("bundle_products", {
  id: serial("id").primaryKey(),
  bundleId: integer("bundle_id").notNull().references(() => bundles.id, { onDelete: "cascade" }),
  shopifyProductId: text("shopify_product_id").notNull(),
  productTitle: text("product_title").notNull(),
  productImage: text("product_image"),
  minQty: integer("min_qty").notNull().default(1),
  maxQty: integer("max_qty"),
});

export type BundleProduct = typeof bundleProducts.$inferSelect;

export const insertBundleProductSchema = createInsertSchema(bundleProducts).omit({
  id: true,
});
export type InsertBundleProduct = z.infer<typeof insertBundleProductSchema>;

export interface BundleWithProducts extends Bundle {
  products: BundleProduct[];
}

export interface ScentVariant {
  id: number;
  name: string;
  productTypeId: number;
  available: boolean;
  gradientFrom: string;
  gradientTo: string;
  isNew?: boolean;
}

export interface ProductType {
  id: number;
  name: string;
  price: number;
  category: string;
  gradientFrom: string;
  gradientTo: string;
  variants: ScentVariant[];
}

export interface DiscountTier {
  minItems: number;
  discountPercent: number;
}

export interface CartItem {
  variantId: number;
  quantity: number;
}

export interface CartBundle {
  items: Array<{
    variant: ScentVariant;
    productType: ProductType;
    quantity: number;
  }>;
  itemCount: number;
  subtotal: number;
  discountPercent: number;
  discount: number;
  total: number;
}

export const addToCartSchema = z.object({
  items: z.array(
    z.object({
      variantId: z.number(),
      quantity: z.number().min(1),
    })
  ).min(1),
});

export type AddToCartRequest = z.infer<typeof addToCartSchema>;
