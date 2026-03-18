// @ts-check
// SiGNL Bundle Discount — Shopify Function (product_discounts, api_version 2024-04)
//
// Reads cart line attributes set by the bundle picker storefront JS:
//   _bundleId        — numeric bundle ID (groups lines belonging to the same bundle)
//   _discountTiers   — JSON array of { minQty, discountValue } objects
//   _discountType    — "percentage" | "fixed"
//
// For each bundle group the function selects the best tier (highest minQty that the
// total qty meets) and returns a cartLine-level discount targeting each specific
// cart line ID in the group. Using cartLine targets avoids over-applying the
// discount when the same product variant appears both in a bundle and as a
// standalone cart item. Lines without _bundleId are never targeted.

const EMPTY = { discounts: [], discountApplicationStrategy: "FIRST" };

/**
 * @param {{ cart: { lines: Array<{
 *   id: string,
 *   quantity: number,
 *   merchandise: { id: string },
 *   attributes: Array<{ key: string, value: string }>
 * }> } }} input
 * @returns {{ discounts: unknown[], discountApplicationStrategy: string }}
 */
export function run(input) {
  const lines = input.cart?.lines ?? [];

  /** @type {Map<string, { lines: typeof lines, tiers: Array<{minQty:number,discountValue:number}>, discountType: string, totalQty: number }>} */
  const bundleGroups = new Map();

  for (const line of lines) {
    const attrs = line.attributes ?? [];
    const bundleId = getAttr(attrs, "_bundleId");
    const tiersJson = getAttr(attrs, "_discountTiers");
    const discountType = getAttr(attrs, "_discountType") ?? "percentage";

    if (!bundleId || !tiersJson) continue;

    let tiers;
    try {
      tiers = JSON.parse(tiersJson);
    } catch {
      continue;
    }
    if (!Array.isArray(tiers) || tiers.length === 0) continue;

    if (!bundleGroups.has(bundleId)) {
      bundleGroups.set(bundleId, { lines: [], tiers, discountType, totalQty: 0 });
    }

    const group = /** @type {NonNullable<ReturnType<typeof bundleGroups.get>>} */ (bundleGroups.get(bundleId));
    group.lines.push(line);
    group.totalQty += line.quantity;
  }

  if (bundleGroups.size === 0) return EMPTY;

  const discounts = [];

  for (const group of bundleGroups.values()) {
    const { tiers, totalQty, discountType } = group;

    const tier = [...tiers]
      .sort((a, b) => b.minQty - a.minQty)
      .find(t => totalQty >= t.minQty);

    if (!tier) continue;

    // Target specific cart lines (not product variants) to avoid accidentally
    // discounting same-variant items that were added to the cart independently.
    const targets = group.lines.map(line => ({
      cartLine: { id: line.id },
    }));

    if (discountType === "percentage") {
      discounts.push({
        targets,
        value: { percentage: { value: String(tier.discountValue) } },
        message: `Bundle Discount \u2014 ${tier.discountValue}% off`,
      });
    } else {
      const dollarOff = (tier.discountValue / 100).toFixed(2);
      discounts.push({
        targets,
        value: {
          fixedAmount: {
            amount: String(dollarOff),
            appliesToEachApplicableLineItem: true,
          },
        },
        message: `Bundle Discount \u2014 $${dollarOff} off`,
      });
    }
  }

  return { discounts, discountApplicationStrategy: "FIRST" };
}

/**
 * @param {Array<{ key: string, value: string }>} attrs
 * @param {string} key
 * @returns {string | undefined}
 */
function getAttr(attrs, key) {
  return attrs.find(a => a.key === key)?.value;
}
