import AdminLayout from "@/components/admin-layout";
import {
  Page,
  Card,
  FormLayout,
  TextField,
  Select,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Divider,
  Banner,
  Spinner,
  Badge,
  Box,
  InlineGrid,
  ProgressBar,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation, useRoute } from "wouter";
import { useState, useEffect, useCallback } from "react";
import type { BundleWithSlots, DiscountTierRule } from "@shared/schema";

interface SlotProduct {
  shopifyProductId: string;
  shopifyVariantId: string;
  productTitle: string;
  variantTitle: string;
  productImage: string;
}

interface SlotEntry {
  name: string;
  imageUrl: string;
  minQty: number;
  maxQty: number | null;
  products: SlotProduct[];
}

const defaultTiers: DiscountTierRule[] = [
  { minQty: 2, discountValue: 10 },
  { minQty: 3, discountValue: 15 },
  { minQty: 4, discountValue: 20 },
];

const STEPS = ["Bundle Details", "Collections", "Discount Tiers"] as const;
type StepIndex = 0 | 1 | 2;

const SLOT_NAME_DEFAULTS = [
  "T-Shirts", "Pants", "Sweats & Hoodies", "Polos", "Hats", "Shoes", "Accessories",
];

const emptySlot = (index = 0): SlotEntry => ({
  name: SLOT_NAME_DEFAULTS[index % SLOT_NAME_DEFAULTS.length] ?? "",
  imageUrl: "",
  minQty: 1,
  maxQty: null,
  products: [],
});

const emptyProduct = (): SlotProduct => ({
  shopifyProductId: "",
  shopifyVariantId: "",
  productTitle: "",
  variantTitle: "",
  productImage: "",
});

const isResourcePickerAvailable = (): boolean => {
  const w = window as unknown as { shopify?: { resourcePicker?: unknown } };
  return typeof w.shopify?.resourcePicker === "function";
};

export default function AdminBundleForm() {
  const [, navigate] = useLocation();
  const [matchNew] = useRoute("/admin/bundles/new");
  const [matchEdit, params] = useRoute("/admin/bundles/:id");
  const isNew = matchNew;
  const bundleId = matchEdit ? parseInt(params!.id) : null;

  const [step, setStep] = useState<StepIndex>(0);
  const pickerAvailable = isResourcePickerAvailable();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [status, setStatus] = useState<"draft" | "active" | "archived">("draft");
  const [tiers, setTiers] = useState<DiscountTierRule[]>(defaultTiers);
  const [slots, setSlots] = useState<SlotEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: existingBundle, isLoading: loadingBundle } = useQuery<BundleWithSlots>({
    queryKey: ["/api/bundles", bundleId],
    enabled: !!bundleId,
  });

  useEffect(() => {
    if (existingBundle) {
      setName(existingBundle.name);
      setDescription(existingBundle.description || "");
      setDiscountType(existingBundle.discountType as "percentage" | "fixed");
      setStatus(existingBundle.status as "draft" | "active" | "archived");
      const savedTiers = existingBundle.discountTiers as DiscountTierRule[];
      setTiers(savedTiers?.length ? savedTiers : defaultTiers);
      setSlots(
        (existingBundle.slots ?? []).map((slot) => ({
          name: slot.name,
          imageUrl: slot.imageUrl || "",
          minQty: slot.minQty,
          maxQty: slot.maxQty ?? null,
          products: slot.products.map((p) => ({
            shopifyProductId: p.shopifyProductId,
            shopifyVariantId: p.shopifyVariantId || "",
            productTitle: p.productTitle,
            variantTitle: p.variantTitle || "",
            productImage: p.productImage || "",
          })),
        }))
      );
    }
  }, [existingBundle]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name,
        description: description || null,
        discountType,
        discountTiers: tiers,
        status,
        slots: slots.map((slot) => ({
          name: slot.name.trim(),
          imageUrl: slot.imageUrl || null,
          minQty: slot.minQty || 1,
          maxQty: slot.maxQty || null,
          products: slot.products
            .filter((p) => p.productTitle.trim())
            .map((p) => ({
              shopifyProductId: p.shopifyProductId || "",
              shopifyVariantId: p.shopifyVariantId || null,
              productTitle: p.productTitle,
              variantTitle: p.variantTitle || null,
              productImage: p.productImage || null,
            })),
        })),
      };
      if (isNew) {
        return apiRequest("POST", "/api/bundles", body);
      } else {
        return apiRequest("PUT", `/api/bundles/${bundleId}`, body);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bundles"] });
      navigate("/admin/bundles");
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to save bundle");
    },
  });

  const addTier = useCallback(() => {
    setTiers((prev) => [
      ...prev,
      { minQty: (prev[prev.length - 1]?.minQty || 1) + 1, discountValue: 5 },
    ]);
  }, []);

  const removeTier = useCallback((i: number) => {
    setTiers((prev) => prev.filter((_, idx) => idx !== i));
  }, []);

  const updateTier = useCallback((i: number, field: keyof DiscountTierRule, value: number) => {
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)));
  }, []);

  const addSlot = useCallback(() => {
    setSlots((prev) => [...prev, emptySlot(prev.length)]);
  }, []);

  const removeSlot = useCallback((i: number) => {
    setSlots((prev) => prev.filter((_, idx) => idx !== i));
  }, []);

  const updateSlot = useCallback(
    (i: number, field: keyof Omit<SlotEntry, "products">, value: SlotEntry[typeof field]) => {
      setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));
    },
    []
  );

  const addProductToSlot = useCallback((slotIdx: number) => {
    setSlots((prev) =>
      prev.map((s, idx) =>
        idx === slotIdx ? { ...s, products: [...s.products, emptyProduct()] } : s
      )
    );
  }, []);

  const removeProductFromSlot = useCallback((slotIdx: number, productIdx: number) => {
    setSlots((prev) =>
      prev.map((s, idx) =>
        idx === slotIdx
          ? { ...s, products: s.products.filter((_, pi) => pi !== productIdx) }
          : s
      )
    );
  }, []);

  const updateProductInSlot = useCallback(
    (slotIdx: number, productIdx: number, field: keyof SlotProduct, value: string) => {
      setSlots((prev) =>
        prev.map((s, idx) =>
          idx === slotIdx
            ? {
                ...s,
                products: s.products.map((p, pi) =>
                  pi === productIdx ? { ...p, [field]: value } : p
                ),
              }
            : s
        )
      );
    },
    []
  );

  const pickProductsFromShopify = useCallback(
    async (slotIdx: number) => {
      const w = window as unknown as {
        shopify?: { resourcePicker?: (opts: unknown) => Promise<unknown> };
      };
      if (typeof w.shopify?.resourcePicker !== "function") return;
      try {
        const selected = await w.shopify.resourcePicker({ type: "product", multiple: true });
        if (!Array.isArray(selected)) return;
        const newProducts: SlotProduct[] = selected.flatMap((res: unknown) => {
          const r = res as {
            id?: string;
            title?: string;
            images?: Array<{ originalSrc?: string }>;
            variants?: Array<{ id?: string; title?: string }>;
          };
          if (!r.variants?.length) return [];
          return r.variants.map((v) => ({
            shopifyProductId: r.id ?? "",
            shopifyVariantId: v.id ?? "",
            productTitle: r.title ?? "",
            variantTitle: v.title ?? "",
            productImage: r.images?.[0]?.originalSrc ?? "",
          }));
        });
        setSlots((prev) =>
          prev.map((s, idx) =>
            idx === slotIdx ? { ...s, products: [...s.products, ...newProducts] } : s
          )
        );
      } catch {
        // Resource picker dismissed or unavailable
      }
    },
    []
  );

  const allSlotsHaveProducts = slots.every((s) => s.products.length > 0);
  const allSlotsHaveNames = slots.every((s) => s.name.trim().length > 0);
  const allSlotQtyValid = slots.every((s) => s.maxQty == null || s.maxQty >= s.minQty);
  const tierQtysUnique = new Set(tiers.map((t) => t.minQty)).size === tiers.length;

  const canAdvance =
    step === 0 ? name.trim().length > 0 :
    step === 1 ? slots.length > 0 && allSlotsHaveNames && allSlotsHaveProducts && allSlotQtyValid :
    true;

  const canSave =
    name.trim().length > 0 &&
    slots.length > 0 &&
    allSlotsHaveNames &&
    allSlotsHaveProducts &&
    allSlotQtyValid &&
    tiers.length > 0 &&
    tierQtysUnique;

  if (loadingBundle) {
    return (
      <AdminLayout>
        <Page>
          <BlockStack align="center" inlineAlign="center">
            <Spinner size="large" />
          </BlockStack>
        </Page>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Page
        backAction={{ content: "Bundles", onAction: () => navigate("/admin/bundles") }}
      >
        <TitleBar title={isNew ? "Create Bundle" : "Edit Bundle"} />

        <BlockStack gap="500">
          {error && (
            <Banner
              title="Error saving bundle"
              tone="critical"
              onDismiss={() => setError(null)}
            >
              <Text as="p">{error}</Text>
            </Banner>
          )}

          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                {STEPS.map((label, idx) => (
                  <InlineStack key={label} gap="100" blockAlign="center">
                    <Box
                      background={step === idx ? "bg-fill-brand" : step > idx ? "bg-fill-success" : "bg-fill-secondary"}
                      borderRadius="full"
                      padding="100"
                      minWidth="28px"
                    >
                      <Text as="span" variant="bodySm" fontWeight="bold" tone={step === idx ? "text-inverse" : undefined} alignment="center">
                        {idx + 1}
                      </Text>
                    </Box>
                    <Text
                      as="span"
                      variant="bodySm"
                      fontWeight={step === idx ? "bold" : "regular"}
                      tone={step === idx ? undefined : "subdued"}
                    >
                      {label}
                    </Text>
                    {idx < STEPS.length - 1 && (
                      <Box minWidth="32px">
                        <Divider />
                      </Box>
                    )}
                  </InlineStack>
                ))}
              </InlineStack>
              <ProgressBar progress={((step + 1) / STEPS.length) * 100} size="small" />
            </BlockStack>
          </Card>

          {step === 0 && (
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Bundle Details</Text>
                <Divider />
                <FormLayout>
                  <TextField
                    label="Bundle name"
                    value={name}
                    onChange={setName}
                    autoComplete="off"
                    placeholder="e.g. Build Your Outfit Bundle"
                    helpText="This name will appear to merchants in the dashboard."
                    data-testid="input-bundle-name"
                  />
                  <TextField
                    label="Description (optional)"
                    value={description}
                    onChange={setDescription}
                    multiline={3}
                    autoComplete="off"
                    placeholder="e.g. Mix and match tees, pants, and accessories — save up to 20%!"
                    data-testid="input-bundle-description"
                  />
                  <InlineGrid columns={2} gap="400">
                    <Select
                      label="Discount type"
                      options={[
                        { label: "Percentage off (%)", value: "percentage" },
                        { label: "Fixed amount ($)", value: "fixed" },
                      ]}
                      value={discountType}
                      onChange={(v) => setDiscountType(v as "percentage" | "fixed")}
                      data-testid="select-discount-type"
                    />
                    <Select
                      label="Status"
                      options={[
                        { label: "Draft", value: "draft" },
                        { label: "Active", value: "active" },
                        { label: "Archived", value: "archived" },
                      ]}
                      value={status}
                      onChange={(v) => setStatus(v as "draft" | "active" | "archived")}
                      data-testid="select-status"
                    />
                  </InlineGrid>
                </FormLayout>
              </BlockStack>
            </Card>
          )}

          {step === 1 && (
            <BlockStack gap="400">
              {!pickerAvailable && (
                <Banner tone="info">
                  <Text as="p">
                    Product browsing is available when this app is open inside Shopify Admin.
                    Use <strong>Add manually</strong> to enter product titles and IDs while developing,
                    or open the app embedded to use the Shopify product picker.
                  </Text>
                </Banner>
              )}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <BlockStack gap="100">
                      <Text as="h2" variant="headingMd">Collections</Text>
                      <Text as="p" tone="subdued">
                        Each collection is a category tab customers browse in the bundle builder (e.g. "T-Shirts", "Hats", "Accessories").
                      </Text>
                    </BlockStack>
                    <Button onClick={addSlot} data-testid="button-add-slot">
                      Add collection
                    </Button>
                  </InlineStack>
                  <Divider />
                  {slots.length === 0 && (
                    <Box padding="400">
                      <BlockStack gap="100" inlineAlign="center">
                        <Text as="p" tone="subdued" alignment="center">
                          No collections yet. Add one to define which products customers can choose from.
                        </Text>
                        <Text as="p" tone="caution" alignment="center">
                          At least one collection is required to continue.
                        </Text>
                      </BlockStack>
                    </Box>
                  )}
                </BlockStack>
              </Card>

              {slots.map((slot, slotIdx) => (
                <Card key={slotIdx}>
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="start">
                      <Badge>{`Collection ${slotIdx + 1}`}</Badge>
                      <Button
                        tone="critical"
                        variant="plain"
                        size="slim"
                        onClick={() => removeSlot(slotIdx)}
                        data-testid={`button-remove-slot-${slotIdx}`}
                      >
                        Remove collection
                      </Button>
                    </InlineStack>

                    <FormLayout>
                      <TextField
                        label="Collection name"
                        value={slot.name}
                        onChange={(v) => updateSlot(slotIdx, "name", v)}
                        autoComplete="off"
                        placeholder='e.g. "T-Shirts", "Hats", "Accessories"'
                        helpText="Shown as a tab label in the storefront bundle builder."
                        data-testid={`input-slot-name-${slotIdx}`}
                      />
                      <TextField
                        label="Collection image URL (optional)"
                        value={slot.imageUrl}
                        onChange={(v) => updateSlot(slotIdx, "imageUrl", v)}
                        autoComplete="off"
                        placeholder="https://cdn.mystore.com/images/tshirts-tab.png"
                        helpText="Shown as a small icon inside the tab. If left blank, only the collection name is displayed."
                        data-testid={`input-slot-imageurl-${slotIdx}`}
                        connectedRight={
                          slot.imageUrl ? (
                            <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", border: "1px solid #e5e7eb", flexShrink: 0 }}>
                              <img
                                src={slot.imageUrl}
                                alt={slot.name}
                                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            </div>
                          ) : undefined
                        }
                      />
                      <InlineGrid columns={2} gap="400">
                        <TextField
                          label="Min quantity"
                          type="number"
                          value={String(slot.minQty)}
                          onChange={(v) => updateSlot(slotIdx, "minQty", parseInt(v) || 1)}
                          autoComplete="off"
                          helpText="Minimum items to pick from this slot."
                          data-testid={`input-slot-minqty-${slotIdx}`}
                        />
                        <TextField
                          label="Max quantity (optional)"
                          type="number"
                          value={slot.maxQty != null ? String(slot.maxQty) : ""}
                          onChange={(v) => updateSlot(slotIdx, "maxQty", v ? parseInt(v) : null)}
                          autoComplete="off"
                          placeholder="No limit"
                          helpText="Leave blank for no maximum."
                          data-testid={`input-slot-maxqty-${slotIdx}`}
                        />
                      </InlineGrid>
                    </FormLayout>

                    <Divider />

                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h3" variant="headingSm">
                        Products in this collection ({slot.products.length})
                      </Text>
                      <InlineStack gap="200">
                        <Button
                          size="slim"
                          onClick={() => pickProductsFromShopify(slotIdx)}
                          data-testid={`button-pick-products-${slotIdx}`}
                        >
                          Browse Shopify products
                        </Button>
                        <Button
                          size="slim"
                          variant="plain"
                          onClick={() => addProductToSlot(slotIdx)}
                          data-testid={`button-add-product-${slotIdx}`}
                        >
                          Add manually
                        </Button>
                      </InlineStack>
                    </InlineStack>

                    {slot.products.length === 0 && (
                      <Text as="p" tone="subdued" alignment="center">
                        No products yet. Use "Browse Shopify products" when connected, or add manually (e.g. T-Shirts, Polos, Hoodies).
                      </Text>
                    )}

                    <BlockStack gap="300">
                      {slot.products.map((product, productIdx) => (
                        <Box
                          key={productIdx}
                          background="bg-surface-secondary"
                          borderRadius="200"
                          padding="400"
                        >
                          <BlockStack gap="300">
                            <InlineStack align="space-between">
                              <Badge tone="info">{`Product ${productIdx + 1}`}</Badge>
                              <Button
                                tone="critical"
                                variant="plain"
                                size="slim"
                                onClick={() => removeProductFromSlot(slotIdx, productIdx)}
                                data-testid={`button-remove-product-${slotIdx}-${productIdx}`}
                              >
                                Remove
                              </Button>
                            </InlineStack>
                            <InlineGrid columns={2} gap="300">
                              <TextField
                                label="Product title"
                                value={product.productTitle}
                                onChange={(v) =>
                                  updateProductInSlot(slotIdx, productIdx, "productTitle", v)
                                }
                                autoComplete="off"
                                placeholder="e.g. Classic Crew Tee"
                                data-testid={`input-product-title-${slotIdx}-${productIdx}`}
                              />
                              <TextField
                                label="Shopify Product ID (GID)"
                                value={product.shopifyProductId}
                                onChange={(v) =>
                                  updateProductInSlot(slotIdx, productIdx, "shopifyProductId", v)
                                }
                                autoComplete="off"
                                placeholder="gid://shopify/Product/123..."
                                helpText="From your Shopify admin"
                                data-testid={`input-product-id-${slotIdx}-${productIdx}`}
                              />
                            </InlineGrid>
                            <InlineGrid columns={2} gap="300">
                              <TextField
                                label="Variant ID (optional)"
                                value={product.shopifyVariantId}
                                onChange={(v) =>
                                  updateProductInSlot(slotIdx, productIdx, "shopifyVariantId", v)
                                }
                                autoComplete="off"
                                placeholder="gid://shopify/ProductVariant/..."
                                helpText="Leave blank to allow any variant."
                                data-testid={`input-variant-id-${slotIdx}-${productIdx}`}
                              />
                              <TextField
                                label="Variant title (optional)"
                                value={product.variantTitle}
                                onChange={(v) =>
                                  updateProductInSlot(slotIdx, productIdx, "variantTitle", v)
                                }
                                autoComplete="off"
                                placeholder="e.g. Red / Large"
                                data-testid={`input-variant-title-${slotIdx}-${productIdx}`}
                              />
                            </InlineGrid>
                          </BlockStack>
                        </Box>
                      ))}
                    </BlockStack>
                  </BlockStack>
                </Card>
              ))}
            </BlockStack>
          )}

          {step === 2 && (
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingMd">Discount Tiers</Text>
                    <Text as="p" tone="subdued">
                      Set quantity thresholds and corresponding{" "}
                      {discountType === "percentage" ? "percentage" : "fixed dollar"} discounts.
                    </Text>
                  </BlockStack>
                  <Button onClick={addTier} data-testid="button-add-tier">
                    Add tier
                  </Button>
                </InlineStack>
                <Divider />

                {tiers.length === 0 && (
                  <Text as="p" tone="subdued" alignment="center">
                    No discount tiers yet. Add one above.
                  </Text>
                )}

                <BlockStack gap="300">
                  {tiers.map((tier, i) => (
                    <InlineGrid key={i} columns="1fr 1fr auto" gap="300" alignItems="end">
                      <TextField
                        label={i === 0 ? "Min quantity (items in cart)" : ""}
                        type="number"
                        value={String(tier.minQty)}
                        onChange={(v) => updateTier(i, "minQty", parseInt(v) || 1)}
                        autoComplete="off"
                        prefix="≥"
                        data-testid={`input-tier-qty-${i}`}
                      />
                      <TextField
                        label={i === 0 ? "Discount value" : ""}
                        type="number"
                        value={String(tier.discountValue)}
                        onChange={(v) => updateTier(i, "discountValue", parseFloat(v) || 0)}
                        autoComplete="off"
                        suffix={discountType === "percentage" ? "%" : "$"}
                        data-testid={`input-tier-value-${i}`}
                      />
                      <Button
                        tone="critical"
                        variant="plain"
                        onClick={() => removeTier(i)}
                        data-testid={`button-remove-tier-${i}`}
                      >
                        Remove
                      </Button>
                    </InlineGrid>
                  ))}
                </BlockStack>
              </BlockStack>
            </Card>
          )}

          <InlineStack align="space-between">
            <Button
              onClick={() => (step === 0 ? navigate("/admin/bundles") : setStep((s) => (s - 1) as StepIndex))}
              data-testid="button-back"
            >
              {step === 0 ? "Cancel" : "Back"}
            </Button>
            {step < 2 ? (
              <Button
                variant="primary"
                disabled={!canAdvance}
                onClick={() => setStep((s) => (s + 1) as StepIndex)}
                data-testid="button-next"
              >
                Next: {STEPS[step + 1]}
              </Button>
            ) : (
              <Button
                variant="primary"
                loading={saveMutation.isPending}
                disabled={!canSave}
                onClick={() => saveMutation.mutate()}
                data-testid="button-save-bundle"
              >
                {isNew ? "Create bundle" : "Save changes"}
              </Button>
            )}
          </InlineStack>
        </BlockStack>
      </Page>
    </AdminLayout>
  );
}
