import { type Product, type BundleTier, type CartBundle, type AddToCartRequest } from "@shared/schema";

const PRODUCTS: Product[] = [
  {
    id: 1,
    name: "Lavender Sage",
    description: "A calming blend of lavender and sage for all-day freshness",
    price: 1599,
    category: "Deodorant",
    available: true,
    gradientFrom: "#E8D5F5",
    gradientTo: "#C4B5FD",
  },
  {
    id: 2,
    name: "Clean Tangerine",
    description: "Bright citrus scent that energizes your day",
    price: 1599,
    category: "Deodorant",
    available: true,
    gradientFrom: "#FFEDD5",
    gradientTo: "#FDBA74",
  },
  {
    id: 3,
    name: "Silver Spruce",
    description: "Crisp and woodsy, inspired by mountain forests",
    price: 1599,
    category: "Deodorant",
    available: true,
    gradientFrom: "#D1FAE5",
    gradientTo: "#6EE7B7",
  },
  {
    id: 4,
    name: "Jasmine Rose",
    description: "Delicate floral notes for a sophisticated touch",
    price: 1599,
    category: "Deodorant",
    available: true,
    gradientFrom: "#FFE4E6",
    gradientTo: "#FDA4AF",
  },
  {
    id: 5,
    name: "Coconut Crush",
    description: "Tropical coconut vibes that last all day",
    price: 1599,
    category: "Deodorant",
    available: true,
    gradientFrom: "#FEF3C7",
    gradientTo: "#FCD34D",
  },
  {
    id: 6,
    name: "Cool Cucumber",
    description: "Refreshing and clean, perfect for sensitive skin",
    price: 1499,
    category: "Deodorant",
    available: true,
    gradientFrom: "#ECFDF5",
    gradientTo: "#A7F3D0",
  },
  {
    id: 7,
    name: "Peony Rose",
    description: "Luxurious peony and rose body wash for silky skin",
    price: 1299,
    category: "Body Wash",
    available: true,
    gradientFrom: "#FCE7F3",
    gradientTo: "#F9A8D4",
  },
  {
    id: 8,
    name: "Fresh Alpine",
    description: "Invigorating alpine herbs cleanse and refresh",
    price: 1299,
    category: "Body Wash",
    available: true,
    gradientFrom: "#CCFBF1",
    gradientTo: "#2DD4BF",
  },
  {
    id: 9,
    name: "Citrus Grove",
    description: "Zesty lemon and grapefruit revitalize your skin",
    price: 1299,
    category: "Body Wash",
    available: true,
    gradientFrom: "#FEF9C3",
    gradientTo: "#FACC15",
  },
  {
    id: 10,
    name: "Toasted Coconut",
    description: "Rich, deeply moisturizing body cream with warm coconut",
    price: 1899,
    category: "Body Cream",
    available: true,
    gradientFrom: "#FDE68A",
    gradientTo: "#D97706",
  },
  {
    id: 11,
    name: "Vanilla Bean",
    description: "Velvety vanilla-infused cream for ultimate hydration",
    price: 1899,
    category: "Body Cream",
    available: true,
    gradientFrom: "#FDF4FF",
    gradientTo: "#E879F9",
  },
  {
    id: 12,
    name: "Shea Butter",
    description: "Pure shea butter formula for deep nourishment",
    price: 1899,
    category: "Body Cream",
    available: false,
    gradientFrom: "#F5F5F4",
    gradientTo: "#A8A29E",
  },
];

const TIERS: BundleTier[] = [
  {
    id: 1,
    name: "Starter Bundle",
    itemCount: 3,
    discountPercent: 10,
    description: "Perfect for trying new scents",
    badge: "",
  },
  {
    id: 2,
    name: "Value Bundle",
    itemCount: 5,
    discountPercent: 15,
    description: "Our most popular bundle size",
    badge: "Most Popular",
  },
  {
    id: 3,
    name: "Ultimate Bundle",
    itemCount: 7,
    discountPercent: 20,
    description: "Maximum savings for bundle lovers",
    badge: "Best Value",
  },
];

export interface IStorage {
  getProducts(): Promise<Product[]>;
  getProductById(id: number): Promise<Product | undefined>;
  getTiers(): Promise<BundleTier[]>;
  getTierById(id: number): Promise<BundleTier | undefined>;
  createCartBundle(data: AddToCartRequest): Promise<CartBundle>;
}

export class MemStorage implements IStorage {
  private cart: CartBundle[] = [];

  async getProducts(): Promise<Product[]> {
    return PRODUCTS;
  }

  async getProductById(id: number): Promise<Product | undefined> {
    return PRODUCTS.find((p) => p.id === id);
  }

  async getTiers(): Promise<BundleTier[]> {
    return TIERS;
  }

  async getTierById(id: number): Promise<BundleTier | undefined> {
    return TIERS.find((t) => t.id === id);
  }

  async createCartBundle(data: AddToCartRequest): Promise<CartBundle> {
    const tier = TIERS.find((t) => t.id === data.tierId);
    if (!tier) {
      throw new Error("Invalid tier");
    }

    if (data.productIds.length !== tier.itemCount) {
      throw new Error(`Bundle requires exactly ${tier.itemCount} items`);
    }

    const items: Product[] = [];
    for (const pid of data.productIds) {
      const product = PRODUCTS.find((p) => p.id === pid);
      if (!product) {
        throw new Error(`Product ${pid} not found`);
      }
      if (!product.available) {
        throw new Error(`Product ${product.name} is out of stock`);
      }
      items.push(product);
    }

    const subtotal = items.reduce((sum, item) => sum + item.price, 0);
    const discount = Math.round(subtotal * (tier.discountPercent / 100));
    const total = subtotal - discount;

    const bundle: CartBundle = { tier, items, subtotal, discount, total };
    this.cart.push(bundle);
    return bundle;
  }
}

export const storage = new MemStorage();
