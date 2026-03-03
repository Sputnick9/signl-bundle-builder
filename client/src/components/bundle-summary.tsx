import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { X, ShoppingCart, Package, Tag, ArrowRight } from "lucide-react";
import type { Product, BundleTier } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2);
}

interface BundleSummaryProps {
  tier: BundleTier | null;
  selectedProducts: Product[];
  onRemoveProduct: (productId: number) => void;
  onAddToCart: () => void;
  isSubmitting: boolean;
  maxItems: number;
}

export function BundleSummary({
  tier,
  selectedProducts,
  onRemoveProduct,
  onAddToCart,
  isSubmitting,
  maxItems,
}: BundleSummaryProps) {
  const selectedCount = selectedProducts.length;
  const progress = maxItems > 0 ? (selectedCount / maxItems) * 100 : 0;
  const isFull = selectedCount >= maxItems;

  const subtotal = selectedProducts.reduce((sum, p) => sum + p.price, 0);
  const discountPercent = tier?.discountPercent || 0;
  const discount = Math.round(subtotal * (discountPercent / 100));
  const total = subtotal - discount;

  const emptySlots = maxItems - selectedCount;

  if (!tier) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm">
            Choose a bundle size to get started
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg">Your Bundle</CardTitle>
          <Badge variant="secondary">
            {selectedCount}/{maxItems}
          </Badge>
        </div>
        <Progress
          value={progress}
          className="h-2 mt-2"
          data-testid="progress-bundle"
        />
        <p className="text-xs text-muted-foreground mt-1">
          {isFull
            ? "Bundle complete! Ready to add to cart."
            : `Select ${emptySlots} more item${emptySlots !== 1 ? "s" : ""}`}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-4 gap-2">
          <AnimatePresence mode="popLayout">
            {selectedProducts.map((product) => (
              <motion.div
                key={product.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="relative group"
              >
                <div
                  className="aspect-square rounded-md flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${product.gradientFrom}, ${product.gradientTo})`,
                  }}
                  title={product.name}
                >
                  <button
                    data-testid={`button-remove-slot-${product.id}`}
                    aria-label={`Remove ${product.name}`}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full items-center justify-center text-xs flex opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    onClick={() => onRemoveProduct(product.id)}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center mt-1 truncate">
                  {product.name}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>

          {Array.from({ length: emptySlots }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square rounded-md border-2 border-dashed border-muted flex items-center justify-center">
              <span className="text-muted-foreground text-lg">+</span>
            </div>
          ))}
        </div>

        <Separator />

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Subtotal</span>
            <span data-testid="text-subtotal">${formatPrice(subtotal)}</span>
          </div>
          {discount > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="flex items-center justify-between gap-2"
            >
              <span className="text-primary flex items-center gap-1">
                <Tag className="w-3 h-3" />
                Savings ({discountPercent}%)
              </span>
              <span className="text-primary font-medium" data-testid="text-savings">
                -${formatPrice(discount)}
              </span>
            </motion.div>
          )}
          <Separator />
          <div className="flex items-center justify-between gap-2 font-bold text-base pt-1">
            <span>Total</span>
            <span data-testid="text-total">${formatPrice(total)}</span>
          </div>
        </div>

        <Button
          data-testid="button-add-to-cart"
          className="w-full gap-2"
          size="lg"
          disabled={!isFull || isSubmitting}
          onClick={onAddToCart}
        >
          {isSubmitting ? (
            "Adding to Cart..."
          ) : (
            <>
              <ShoppingCart className="w-4 h-4" />
              {isFull
                ? `Add Bundle - $${formatPrice(total)}`
                : `Select ${emptySlots} more`}
              {isFull && <ArrowRight className="w-4 h-4" />}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

interface MobileBottomBarProps {
  tier: BundleTier | null;
  selectedProducts: Product[];
  onViewBundle: () => void;
  onAddToCart: () => void;
  isSubmitting: boolean;
  maxItems: number;
}

export function MobileBottomBar({
  tier,
  selectedProducts,
  onViewBundle,
  onAddToCart,
  isSubmitting,
  maxItems,
}: MobileBottomBarProps) {
  if (!tier) return null;

  const selectedCount = selectedProducts.length;
  const isFull = selectedCount >= maxItems;
  const subtotal = selectedProducts.reduce((sum, p) => sum + p.price, 0);
  const discount = Math.round(subtotal * ((tier.discountPercent || 0) / 100));
  const total = subtotal - discount;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 z-50 safe-area-bottom">
      <div className="flex items-center gap-3">
        <button
          data-testid="button-view-bundle-mobile"
          onClick={onViewBundle}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          <div className="flex -space-x-2">
            {selectedProducts.slice(0, 3).map((p) => (
              <div
                key={p.id}
                className="w-8 h-8 rounded-full border-2 border-card"
                style={{
                  background: `linear-gradient(135deg, ${p.gradientFrom}, ${p.gradientTo})`,
                }}
              />
            ))}
            {selectedCount > 3 && (
              <div className="w-8 h-8 rounded-full border-2 border-card bg-muted flex items-center justify-center text-xs font-medium">
                +{selectedCount - 3}
              </div>
            )}
          </div>
          <div className="text-left min-w-0">
            <p className="text-xs text-muted-foreground">
              {selectedCount}/{maxItems} items
            </p>
            <p className="font-bold text-sm">${formatPrice(total)}</p>
          </div>
        </button>

        <Button
          data-testid="button-add-to-cart-mobile"
          disabled={!isFull || isSubmitting}
          onClick={onAddToCart}
          className={cn(!isFull && "min-w-[120px]")}
        >
          {isSubmitting
            ? "Adding..."
            : isFull
            ? "Add to Cart"
            : `${maxItems - selectedCount} more`}
        </Button>
      </div>
    </div>
  );
}
