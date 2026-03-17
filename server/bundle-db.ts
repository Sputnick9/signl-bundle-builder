import { db } from "./db";
import { bundles, bundleProducts } from "@shared/schema";
import type { Bundle, BundleProduct, BundleWithProducts, DiscountTierRule } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

type BundleInsert = typeof bundles.$inferInsert;
type BundleProductInsert = typeof bundleProducts.$inferInsert;
type BundleProductSeed = Omit<BundleProductInsert, "bundleId">;

export type { BundleInsert, BundleProductSeed };

export async function listBundles(shop: string): Promise<Bundle[]> {
  return db
    .select()
    .from(bundles)
    .where(eq(bundles.shop, shop))
    .orderBy(desc(bundles.createdAt));
}

export async function getBundle(id: number): Promise<BundleWithProducts | null> {
  const [bundle] = await db.select().from(bundles).where(eq(bundles.id, id));
  if (!bundle) return null;
  const products = await db
    .select()
    .from(bundleProducts)
    .where(eq(bundleProducts.bundleId, id));
  return { ...bundle, products };
}

export async function createBundle(
  data: BundleInsert,
  products: BundleProductSeed[]
): Promise<BundleWithProducts> {
  const [bundle] = await db.insert(bundles).values(data).returning();
  let inserted: BundleProduct[] = [];
  if (products.length > 0) {
    inserted = await db
      .insert(bundleProducts)
      .values(products.map((p) => ({ ...p, bundleId: bundle.id })))
      .returning();
  }
  return { ...bundle, products: inserted };
}

export async function updateBundle(
  id: number,
  data: Partial<Omit<BundleInsert, "id">>,
  products?: BundleProductSeed[]
): Promise<BundleWithProducts | null> {
  const updateSet: Partial<Omit<BundleInsert, "id">> = {
    ...data,
    updatedAt: new Date(),
  };
  const [bundle] = await db
    .update(bundles)
    .set(updateSet)
    .where(eq(bundles.id, id))
    .returning();
  if (!bundle) return null;

  let updatedProducts: BundleProduct[];
  if (products !== undefined) {
    await db.delete(bundleProducts).where(eq(bundleProducts.bundleId, id));
    if (products.length > 0) {
      updatedProducts = await db
        .insert(bundleProducts)
        .values(products.map((p) => ({ ...p, bundleId: id })))
        .returning();
    } else {
      updatedProducts = [];
    }
  } else {
    updatedProducts = await db
      .select()
      .from(bundleProducts)
      .where(eq(bundleProducts.bundleId, id));
  }

  return { ...bundle, products: updatedProducts };
}

export async function deleteBundle(id: number): Promise<boolean> {
  const result = await db.delete(bundles).where(eq(bundles.id, id)).returning();
  return result.length > 0;
}

export function toBundleInsert(raw: {
  shop: string;
  name: string;
  description?: string | null;
  discountType?: string;
  discountTiers?: DiscountTierRule[];
  status?: string;
}): BundleInsert {
  return {
    shop: raw.shop,
    name: raw.name,
    description: raw.description ?? null,
    discountType: raw.discountType ?? "percentage",
    discountTiers: (raw.discountTiers ?? []) as DiscountTierRule[],
    status: raw.status ?? "draft",
  };
}
