import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TierSelector } from "@/components/tier-selector";
import { ProductCard } from "@/components/product-card";
import { BundleSummary, MobileBottomBar } from "@/components/bundle-summary";
import { ShoppingBag, Sparkles, Package } from "lucide-react";
import type { Product, BundleTier } from "@shared/schema";
import { motion } from "framer-motion";

const CATEGORIES = ["All", "Deodorant", "Body Wash", "Body Cream"];

export default function BundleBuilder() {
  const [selectedTierId, setSelectedTierId] = useState<number>(2);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [cartCount, setCartCount] = useState(0);
  const [showMobileSummary, setShowMobileSummary] = useState(false);

  const { toast } = useToast();
  const isMobile = useIsMobile();

  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: tiers = [], isLoading: tiersLoading } = useQuery<BundleTier[]>({
    queryKey: ["/api/tiers"],
  });

  const currentTier = tiers.find((t) => t.id === selectedTierId) || null;
  const maxItems = currentTier?.itemCount || 0;

  const selectedProducts = useMemo(
    () =>
      selectedProductIds
        .map((id) => products.find((p) => p.id === id))
        .filter(Boolean) as Product[],
    [selectedProductIds, products]
  );

  const filteredProducts = useMemo(
    () =>
      activeCategory === "All"
        ? products
        : products.filter((p) => p.category === activeCategory),
    [products, activeCategory]
  );

  const handleTierChange = (tierId: number) => {
    setSelectedTierId(tierId);
    const newTier = tiers.find((t) => t.id === tierId);
    if (newTier && selectedProductIds.length > newTier.itemCount) {
      setSelectedProductIds((prev) => prev.slice(0, newTier.itemCount));
    }
  };

  const handleToggleProduct = (productId: number) => {
    const idx = selectedProductIds.indexOf(productId);
    if (idx >= 0) {
      setSelectedProductIds((prev) => prev.filter((id) => id !== productId));
    } else if (selectedProductIds.length < maxItems) {
      setSelectedProductIds((prev) => [...prev, productId]);
    } else {
      toast({
        title: "Bundle is full",
        description: `You can only select ${maxItems} items in this bundle.`,
        variant: "destructive",
      });
    }
  };

  const handleRemoveProduct = (productId: number) => {
    setSelectedProductIds((prev) => prev.filter((id) => id !== productId));
  };

  const addToCartMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cart/bundle", {
        tierId: selectedTierId,
        productIds: selectedProductIds,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setCartCount((prev) => prev + 1);
      setSelectedProductIds([]);
      setShowMobileSummary(false);
      toast({
        title: "Bundle added to cart!",
        description: `Your ${currentTier?.name} has been added. Total: $${(data.bundle.total / 100).toFixed(2)}`,
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
    if (selectedProductIds.length !== maxItems) return;
    addToCartMutation.mutate();
  };

  const isLoading = productsLoading || tiersLoading;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 h-16">
            <div className="flex items-center gap-2">
              <Package className="w-6 h-6 text-primary" />
              <span className="font-bold text-lg tracking-tight" data-testid="text-brand">
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

      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 py-16 md:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(162_63%_41%/0.06),transparent_70%)]" />
        <div className="relative max-w-4xl mx-auto text-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="secondary" className="mb-4 gap-1">
              <Sparkles className="w-3 h-3" />
              Save up to 20%
            </Badge>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
              Build Your Custom Bundle
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground mt-4 max-w-2xl mx-auto">
              Mix and match your favorite products. The more you bundle, the more you save.
            </p>
          </motion.div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
              1
            </div>
            <h2 className="text-xl font-semibold">Choose Your Bundle Size</h2>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
          ) : (
            <TierSelector
              tiers={tiers}
              selectedTierId={selectedTierId}
              onSelect={handleTierChange}
            />
          )}
        </section>

        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
              2
            </div>
            <h2 className="text-xl font-semibold">Select Your Products</h2>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 min-w-0">
              <Tabs
                value={activeCategory}
                onValueChange={setActiveCategory}
                className="mb-6"
              >
                <TabsList data-testid="tabs-category">
                  {CATEGORIES.map((cat) => (
                    <TabsTrigger
                      key={cat}
                      value={cat}
                      data-testid={`tab-${cat.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {cat}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              {isLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-72 rounded-xl" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      isSelected={selectedProductIds.includes(product.id)}
                      onToggle={handleToggleProduct}
                      disabled={selectedProductIds.length >= maxItems}
                    />
                  ))}
                </div>
              )}

              {!isLoading && filteredProducts.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    No products in this category.
                  </p>
                </div>
              )}
            </div>

            {!isMobile && (
              <div className="w-[340px] flex-shrink-0">
                <div className="sticky top-24">
                  <BundleSummary
                    tier={currentTier}
                    selectedProducts={selectedProducts}
                    onRemoveProduct={handleRemoveProduct}
                    onAddToCart={handleAddToCart}
                    isSubmitting={addToCartMutation.isPending}
                    maxItems={maxItems}
                  />
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {isMobile && (
        <>
          <MobileBottomBar
            tier={currentTier}
            selectedProducts={selectedProducts}
            onViewBundle={() => setShowMobileSummary(true)}
            onAddToCart={handleAddToCart}
            isSubmitting={addToCartMutation.isPending}
            maxItems={maxItems}
          />

          <Sheet open={showMobileSummary} onOpenChange={setShowMobileSummary}>
            <SheetContent side="bottom" className="max-h-[80vh]">
              <SheetHeader>
                <SheetTitle>Your Bundle</SheetTitle>
              </SheetHeader>
              <div className="mt-4 overflow-y-auto">
                <BundleSummary
                  tier={currentTier}
                  selectedProducts={selectedProducts}
                  onRemoveProduct={handleRemoveProduct}
                  onAddToCart={handleAddToCart}
                  isSubmitting={addToCartMutation.isPending}
                  maxItems={maxItems}
                />
              </div>
            </SheetContent>
          </Sheet>

          <div className="h-24" />
        </>
      )}

      <footer className="border-t mt-16 py-8 text-center text-sm text-muted-foreground">
        <p>Shopify Bundle Builder Tool</p>
      </footer>
    </div>
  );
}
