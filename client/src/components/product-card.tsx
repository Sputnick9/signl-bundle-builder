import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, Plus, Minus, Droplets, Waves, Flower2 } from "lucide-react";
import type { Product } from "@shared/schema";
import { motion } from "framer-motion";

const categoryIcons: Record<string, typeof Droplets> = {
  Deodorant: Droplets,
  "Body Wash": Waves,
  "Body Cream": Flower2,
};

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2);
}

interface ProductCardProps {
  product: Product;
  isSelected: boolean;
  onToggle: (productId: number) => void;
  disabled: boolean;
}

export function ProductCard({ product, isSelected, onToggle, disabled }: ProductCardProps) {
  const Icon = categoryIcons[product.category] || Droplets;
  const isDisabled = !product.available || (disabled && !isSelected);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        data-testid={`product-card-${product.id}`}
        role="button"
        tabIndex={isDisabled ? -1 : 0}
        aria-pressed={isSelected}
        aria-disabled={isDisabled}
        className={cn(
          "group transition-all duration-300 hover-elevate",
          isSelected && "ring-2 ring-primary border-primary",
          isDisabled && "opacity-50 cursor-not-allowed",
          !isDisabled && "cursor-pointer"
        )}
        onClick={() => !isDisabled && onToggle(product.id)}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !isDisabled) {
            e.preventDefault();
            onToggle(product.id);
          }
        }}
      >
        <div
          className="h-36 rounded-t-xl relative flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${product.gradientFrom}, ${product.gradientTo})`,
          }}
        >
          <Icon
            className="w-10 h-10"
            style={{ color: product.gradientTo, filter: "brightness(0.5)" }}
          />

          {isSelected && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute top-3 right-3 w-7 h-7 bg-primary rounded-full flex items-center justify-center shadow-md"
            >
              <Check className="w-4 h-4 text-primary-foreground" />
            </motion.div>
          )}

          {!product.available && (
            <div className="absolute inset-0 bg-background/60 rounded-t-xl flex items-center justify-center">
              <Badge variant="secondary">Out of Stock</Badge>
            </div>
          )}
        </div>

        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            {product.category}
          </p>
          <h4 className="font-semibold mt-1 text-sm">{product.name}</h4>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {product.description}
          </p>
          <div className="flex items-center justify-between gap-2 mt-3">
            <span className="font-bold text-base">${formatPrice(product.price)}</span>
            <Button
              data-testid={`button-toggle-product-${product.id}`}
              size="sm"
              variant={isSelected ? "default" : "outline"}
              disabled={isDisabled}
              onClick={(e) => {
                e.stopPropagation();
                if (!isDisabled) onToggle(product.id);
              }}
            >
              {!product.available ? (
                "Sold Out"
              ) : isSelected ? (
                <>
                  <Minus className="w-3 h-3 mr-1" />
                  Remove
                </>
              ) : (
                <>
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
