import { db } from "./db";
import { bundles, bundleProducts, type Bundle, type BundleProduct, type BundleWithProducts, type InsertBundle, type InsertBundleProduct } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

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
  data: InsertBundle,
  products: Omit<InsertBundleProduct, "bundleId">[]
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
  data: Partial<InsertBundle>,
  products?: Omit<InsertBundleProduct, "bundleId">[]
): Promise<BundleWithProducts | null> {
  const [bundle] = await db
    .update(bundles)
    .set({ ...data, updatedAt: new Date() })
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
