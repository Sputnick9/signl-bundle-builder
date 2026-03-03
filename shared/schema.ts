import { z } from "zod";

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  available: boolean;
  gradientFrom: string;
  gradientTo: string;
}

export interface BundleTier {
  id: number;
  name: string;
  itemCount: number;
  discountPercent: number;
  description: string;
  badge: string;
}

export interface CartBundle {
  tier: BundleTier;
  items: Product[];
  subtotal: number;
  discount: number;
  total: number;
}

export const addToCartSchema = z.object({
  tierId: z.number(),
  productIds: z.array(z.number()).min(1),
});

export type AddToCartRequest = z.infer<typeof addToCartSchema>;
