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
  discountEnabled: boolean("discount_enabled").notNull().default(true),
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

export const bundleSlots = pgTable("bundle_slots", {
  id: serial("id").primaryKey(),
  bundleId: integer("bundle_id").notNull().references(() => bundles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  minQty: integer("min_qty").notNull().default(1),
  maxQty: integer("max_qty"),
});

export type BundleSlot = typeof bundleSlots.$inferSelect;
export type InsertBundleSlot = typeof bundleSlots.$inferInsert;

export const bundleSlotProducts = pgTable("bundle_slot_products", {
  id: serial("id").primaryKey(),
  slotId: integer("slot_id").notNull().references(() => bundleSlots.id, { onDelete: "cascade" }),
  shopifyProductId: text("shopify_product_id").notNull(),
  shopifyVariantId: text("shopify_variant_id"),
  productTitle: text("product_title").notNull(),
  variantTitle: text("variant_title"),
  productImage: text("product_image"),
});

export type BundleSlotProduct = typeof bundleSlotProducts.$inferSelect;
export type InsertBundleSlotProduct = typeof bundleSlotProducts.$inferInsert;

export interface BundleSlotWithProducts extends BundleSlot {
  products: BundleSlotProduct[];
}

export interface BundleWithSlots extends Bundle {
  slots: BundleSlotWithProducts[];
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

export const shopSubscriptions = pgTable("shop_subscriptions", {
  id: serial("id").primaryKey(),
  shop: text("shop").notNull().unique(),
  chargeId: text("charge_id"),
  status: text("status").notNull().default("pending"),
  planTier: text("plan_tier").notNull().default("free"),
  trialDays: integer("trial_days").notNull().default(0),
  planName: text("plan_name").notNull().default("Free"),
  planPrice: text("plan_price").notNull().default("0"),
  activatedAt: timestamp("activated_at"),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type ShopSubscription = typeof shopSubscriptions.$inferSelect;
export type InsertShopSubscription = typeof shopSubscriptions.$inferInsert;

export const addToCartSchema = z.object({
  items: z.array(
    z.object({
      variantId: z.number(),
      quantity: z.number().min(1),
    })
  ).min(1),
});

export type AddToCartRequest = z.infer<typeof addToCartSchema>;
