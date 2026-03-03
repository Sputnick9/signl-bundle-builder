import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductTypeCard } from "@/components/product-type-card";
import { StickyCartBar } from "@/components/bundle-summary";
import {
  ShoppingBag,
  Sparkles,
  Star,
  Droplets,
  Waves,
  Bath,
  Flower2,
  Shirt,
} from "lucide-react";
import type { ProductType, CartItem, DiscountTier } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const CATEGORY_META: Record<
  string,
  { icon: typeof Droplets; label: string }
> = {
  Deodorant: { icon: Droplets, label: "Deodorant" },
  Wash: { icon: Waves, label: "Wash" },
  Wipes: { icon: Sparkles, label: "Wipes" },
  Soap: { icon: Bath, label: "Soap" },
  "Body Cream": { icon: Flower2, label: "Body Cream" },
  Laundry: { icon: Shirt, label: "Laundry" },
};

export default function BundleBuilder() {
  const [activeCategory, setActiveCategory] = useState<string>("Deodorant");
  const [expandedTypeId, setExpandedTypeId] = useState<number | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartCount, setCartCount] = useState(0);

  const { toast } = useToast();

  const { data: allProducts = [], isLoading: productsLoading } = useQuery<
    ProductType[]
  >({
    queryKey: ["/api/products"],
  });

  const { data: discountTiers = [] } = useQuery<DiscountTier[]>({
    queryKey: ["/api/discount-tiers"],
  });

  const categories = useMemo(() => {
    const cats = new Set(allProducts.map((p) => p.category));
    return Array.from(cats);
  }, [allProducts]);

  const filteredProducts = useMemo(
    () => allProducts.filter((p) => p.category === activeCategory),
    [allProducts, activeCategory]
  );

  const totalItemCount = useMemo(
    () => cartItems.reduce((sum, ci) => sum + ci.quantity, 0),
    [cartItems]
  );

  const handleAddVariant = useCallback((variantId: number) => {
    setCartItems((prev) => {
      const existing = prev.find((ci) => ci.variantId === variantId);
      if (existing) {
        return prev.map((ci) =>
          ci.variantId === variantId
            ? { ...ci, quantity: ci.quantity + 1 }
            : ci
        );
      }
      return [...prev, { variantId, quantity: 1 }];
    });
  }, []);

  const handleRemoveVariant = useCallback((variantId: number) => {
    setCartItems((prev) => {
      const existing = prev.find((ci) => ci.variantId === variantId);
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        return prev.filter((ci) => ci.variantId !== variantId);
      }
      return prev.map((ci) =>
        ci.variantId === variantId
          ? { ...ci, quantity: ci.quantity - 1 }
          : ci
      );
    });
  }, []);

  const addToCartMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cart/bundle", {
        items: cartItems,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setCartCount((prev) => prev + 1);
      setCartItems([]);
      toast({
        title: "Bundle added to cart!",
        description: `${data.bundle.itemCount} items added. You saved ${(data.bundle.discount / 100).toFixed(2)}!`,
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to add bundle",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleAddToCart = () => {
    if (cartItems.length === 0) return;
    addToCartMutation.mutate();
  };

  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
    setExpandedTypeId(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4 h-14">
            <div className="flex items-center gap-2">
              <Droplets className="w-5 h-5 text-primary" />
              <span
                className="font-bold text-base tracking-tight"
                data-testid="text-brand"
              >
                BundleBuilder
              </span>
            </div>
            <button
              data-testid="button-cart"
              className="relative p-2 rounded-md hover-elevate"
            >
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center font-bold"
                >
                  {cartCount}
                </motion.span>
              )}
            </button>
          </div>
        </div>
      </header>

      <section className="bg-gradient-to-b from-primary/5 to-background py-8 sm:py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-0.5 text-amber-500">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <span
                  className="text-sm text-muted-foreground"
                  data-testid="text-reviews"
                >
                  964 reviews
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
                Build Your
                <br />
                <span className="text-primary">Bundle</span>
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-3 max-w-md">
                Save up to 30% — the more you add to your bundle, the more you
                save! This offer cannot be combined with any other offers.
              </p>
            </div>
            <div className="hidden sm:block flex-shrink-0">
              <div className="w-48 h-32 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary">30%</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    max savings
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-2 sm:gap-3 min-w-max sm:min-w-0 sm:flex-wrap">
            {categories.map((cat) => {
              const meta = CATEGORY_META[cat];
              const Icon = meta?.icon || Droplets;
              const isActive = activeCategory === cat;

              return (
                <button
                  key={cat}
                  data-testid={`tab-${cat.toLowerCase().replace(/\s+/g, "-")}`}
                  onClick={() => handleCategoryChange(cat)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm font-medium transition-all duration-200 whitespace-nowrap",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border hover-elevate"
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                      isActive
                        ? "bg-primary-foreground/20"
                        : "bg-muted"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  {meta?.label || cat}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          {productsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))
          ) : (
            filteredProducts.map((pt, index) => (
              <motion.div
                key={pt.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
              >
                <ProductTypeCard
                  productType={pt}
                  isExpanded={expandedTypeId === pt.id}
                  onToggleExpand={() =>
                    setExpandedTypeId(
                      expandedTypeId === pt.id ? null : pt.id
                    )
                  }
                  cartItems={cartItems}
                  onAddVariant={handleAddVariant}
                  onRemoveVariant={handleRemoveVariant}
                />
              </motion.div>
            ))
          )}

          {!productsLoading && filteredProducts.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground">
                No products in this category.
              </p>
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {totalItemCount > 0 && (
          <StickyCartBar
            cartItems={cartItems}
            productTypes={allProducts}
            discountTiers={discountTiers}
            onAddVariant={handleAddVariant}
            onRemoveVariant={handleRemoveVariant}
            onAddToCart={handleAddToCart}
            isSubmitting={addToCartMutation.isPending}
          />
        )}
      </AnimatePresence>

      <div className={cn(totalItemCount > 0 ? "h-32" : "h-8")} />

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>Shopify Bundle Builder Tool</p>
      </footer>
    </div>
  );
}

