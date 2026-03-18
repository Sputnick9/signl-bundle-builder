import { db } from "./db";
import { bundles, bundleSlots, bundleSlotProducts } from "@shared/schema";
import type {
  Bundle,
  BundleSlot,
  BundleSlotProduct,
  BundleSlotWithProducts,
  BundleWithSlots,
  DiscountTierRule,
} from "@shared/schema";
import { and, eq, asc, desc } from "drizzle-orm";

type BundleInsert = typeof bundles.$inferInsert;
type SlotInsert = typeof bundleSlots.$inferInsert;
type SlotProductInsert = typeof bundleSlotProducts.$inferInsert;

export type SlotProductSeed = Omit<SlotProductInsert, "slotId" | "id">;
export type SlotSeed = Omit<SlotInsert, "bundleId" | "id"> & {
  products: SlotProductSeed[];
};

export type { BundleInsert, SlotInsert, SlotProductInsert };

export async function listBundles(shop: string): Promise<Bundle[]> {
  return db
    .select()
    .from(bundles)
    .where(eq(bundles.shop, shop))
    .orderBy(desc(bundles.createdAt));
}

export async function getBundle(id: number, shop: string): Promise<BundleWithSlots | null> {
  const [bundle] = await db
    .select()
    .from(bundles)
    .where(and(eq(bundles.id, id), eq(bundles.shop, shop)));
  if (!bundle) return null;

  const slots = await db
    .select()
    .from(bundleSlots)
    .where(eq(bundleSlots.bundleId, id))
    .orderBy(asc(bundleSlots.position));

  const slotsWithProducts: BundleSlotWithProducts[] = await Promise.all(
    slots.map(async (slot) => {
      const products = await db
        .select()
        .from(bundleSlotProducts)
        .where(eq(bundleSlotProducts.slotId, slot.id));
      return { ...slot, products };
    })
  );

  return { ...bundle, slots: slotsWithProducts };
}

async function insertSlotsInTx(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  bundleId: number,
  slots: SlotSeed[]
): Promise<BundleSlotWithProducts[]> {
  const slotsWithProducts: BundleSlotWithProducts[] = [];
  for (let position = 0; position < slots.length; position++) {
    const { products: productSeeds, ...slotData } = slots[position];
    const [slot] = await tx
      .insert(bundleSlots)
      .values({ ...slotData, bundleId, position })
      .returning();

    let products: BundleSlotProduct[] = [];
    if (productSeeds.length > 0) {
      products = await tx
        .insert(bundleSlotProducts)
        .values(productSeeds.map((p) => ({ ...p, slotId: slot.id })))
        .returning();
    }
    slotsWithProducts.push({ ...slot, products });
  }
  return slotsWithProducts;
}

export async function createBundle(
  data: BundleInsert,
  slots: SlotSeed[]
): Promise<BundleWithSlots> {
  return db.transaction(async (tx) => {
    const [bundle] = await tx.insert(bundles).values(data).returning();
    const slotsWithProducts = await insertSlotsInTx(tx, bundle.id, slots);
    return { ...bundle, slots: slotsWithProducts };
  });
}

export async function updateBundle(
  id: number,
  shop: string,
  data: Partial<Omit<BundleInsert, "id" | "shop">>,
  slots?: SlotSeed[]
): Promise<BundleWithSlots | null> {
  return db.transaction(async (tx) => {
    const updateSet: Partial<Omit<BundleInsert, "id" | "shop">> = {
      ...data,
      updatedAt: new Date(),
    };

    const [bundle] = await tx
      .update(bundles)
      .set(updateSet)
      .where(and(eq(bundles.id, id), eq(bundles.shop, shop)))
      .returning();
    if (!bundle) return null;

    let slotsWithProducts: BundleSlotWithProducts[];

    if (slots !== undefined) {
      await tx.delete(bundleSlots).where(eq(bundleSlots.bundleId, id));
      slotsWithProducts = await insertSlotsInTx(tx, id, slots);
    } else {
      const rawSlots = await tx
        .select()
        .from(bundleSlots)
        .where(eq(bundleSlots.bundleId, id))
        .orderBy(asc(bundleSlots.position));

      slotsWithProducts = await Promise.all(
        rawSlots.map(async (slot) => {
          const products = await tx
            .select()
            .from(bundleSlotProducts)
            .where(eq(bundleSlotProducts.slotId, slot.id));
          return { ...slot, products };
        })
      );
    }

    return { ...bundle, slots: slotsWithProducts };
  });
}

export async function deleteBundle(id: number, shop: string): Promise<boolean> {
  const result = await db
    .delete(bundles)
    .where(and(eq(bundles.id, id), eq(bundles.shop, shop)))
    .returning();
  return result.length > 0;
}

export async function getBundlesForProduct(
  shop: string,
  shopifyProductId: string
): Promise<BundleWithSlots[]> {
  const matchingRows = await db
    .selectDistinct({ bundleId: bundleSlots.bundleId })
    .from(bundleSlotProducts)
    .innerJoin(bundleSlots, eq(bundleSlotProducts.slotId, bundleSlots.id))
    .innerJoin(bundles, eq(bundleSlots.bundleId, bundles.id))
    .where(
      and(
        eq(bundles.shop, shop),
        eq(bundles.status, "active"),
        eq(bundleSlotProducts.shopifyProductId, shopifyProductId)
      )
    );

  if (!matchingRows.length) return [];

  const bundleIds = [...new Set(matchingRows.map((r) => r.bundleId))];
  const results = await Promise.all(bundleIds.map((id) => getBundle(id, shop)));
  return results.filter((b): b is BundleWithSlots => b !== null);
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
