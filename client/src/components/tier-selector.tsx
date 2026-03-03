import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Package, PackageCheck, Boxes, Sparkles } from "lucide-react";
import type { BundleTier } from "@shared/schema";
import { motion } from "framer-motion";

const tierIcons: Record<number, typeof Package> = {
  1: Package,
  2: PackageCheck,
  3: Boxes,
};

interface TierSelectorProps {
  tiers: BundleTier[];
  selectedTierId: number | null;
  onSelect: (tierId: number) => void;
}

export function TierSelector({ tiers, selectedTierId, onSelect }: TierSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {tiers.map((tier, index) => {
        const isSelected = tier.id === selectedTierId;
        const Icon = tierIcons[tier.id] || Package;

        return (
          <motion.div
            key={tier.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.4 }}
          >
            <Card
              data-testid={`tier-card-${tier.id}`}
              role="radio"
              tabIndex={0}
              aria-checked={isSelected}
              className={cn(
                "cursor-pointer transition-all duration-300 relative hover-elevate",
                isSelected && "ring-2 ring-primary border-primary bg-primary/5"
              )}
              onClick={() => onSelect(tier.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(tier.id);
                }
              }}
            >
              {tier.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="gap-1 whitespace-nowrap">
                    <Sparkles className="w-3 h-3" />
                    {tier.badge}
                  </Badge>
                </div>
              )}
              <CardContent className={cn("p-6 text-center", tier.badge && "pt-8")}>
                <div
                  className={cn(
                    "w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center transition-colors duration-300",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-base">{tier.name}</h3>
                <p className="text-3xl font-bold mt-2 tracking-tight">{tier.itemCount}</p>
                <p className="text-sm text-muted-foreground">items</p>
                <Badge
                  variant="secondary"
                  className="mt-3"
                >
                  Save {tier.discountPercent}%
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">{tier.description}</p>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
