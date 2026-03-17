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
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation, useRoute } from "wouter";
import { useState, useEffect, useCallback } from "react";
import type { BundleWithProducts, DiscountTierRule } from "@shared/schema";

interface ProductEntry {
  shopifyProductId: string;
  productTitle: string;
  productImage: string;
  minQty: number;
  maxQty: number | null;
}

const defaultTiers: DiscountTierRule[] = [
  { minQty: 2, discountValue: 10 },
  { minQty: 3, discountValue: 15 },
  { minQty: 4, discountValue: 20 },
];

export default function AdminBundleForm() {
  const [, navigate] = useLocation();
  const [matchNew] = useRoute("/admin/bundles/new");
  const [matchEdit, params] = useRoute("/admin/bundles/:id");
  const isNew = matchNew;
  const bundleId = matchEdit ? parseInt(params!.id) : null;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [status, setStatus] = useState<"draft" | "active" | "archived">("draft");
  const [tiers, setTiers] = useState<DiscountTierRule[]>(defaultTiers);
  const [products, setProducts] = useState<ProductEntry[]>([]);
  const [shop] = useState("dev-preview");
  const [error, setError] = useState<string | null>(null);

  const { data: existingBundle, isLoading: loadingBundle } = useQuery<BundleWithProducts>({
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
      setProducts(
        existingBundle.products.map((p) => ({
          shopifyProductId: p.shopifyProductId,
          productTitle: p.productTitle,
          productImage: p.productImage || "",
          minQty: p.minQty,
          maxQty: p.maxQty,
        }))
      );
    }
  }, [existingBundle]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        shop,
        name,
        description: description || null,
        discountType,
        discountTiers: tiers,
        status,
        products: products.map((p) => ({
          shopifyProductId: p.shopifyProductId || `demo-${Math.random().toString(36).slice(2)}`,
          productTitle: p.productTitle,
          productImage: p.productImage || null,
          minQty: p.minQty || 1,
          maxQty: p.maxQty || null,
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
    setTiers((prev) => [...prev, { minQty: (prev[prev.length - 1]?.minQty || 1) + 1, discountValue: 5 }]);
  }, []);

  const removeTier = useCallback((i: number) => {
    setTiers((prev) => prev.filter((_, idx) => idx !== i));
  }, []);

  const updateTier = useCallback((i: number, field: keyof DiscountTierRule, value: number) => {
    setTiers((prev) => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t));
  }, []);

  const addProduct = useCallback(() => {
    setProducts((prev) => [...prev, { shopifyProductId: "", productTitle: "", productImage: "", minQty: 1, maxQty: null }]);
  }, []);

  const removeProduct = useCallback((i: number) => {
    setProducts((prev) => prev.filter((_, idx) => idx !== i));
  }, []);

  const updateProduct = useCallback((i: number, field: keyof ProductEntry, value: ProductEntry[keyof ProductEntry]) => {
    setProducts((prev) => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
  }, []);

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
            <Banner title="Error saving bundle" tone="critical" onDismiss={() => setError(null)}>
              <Text as="p">{error}</Text>
            </Banner>
          )}

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
                  placeholder="e.g. Summer Starter Bundle"
                  data-testid="input-bundle-name"
                />
                <TextField
                  label="Description"
                  value={description}
                  onChange={setDescription}
                  multiline={3}
                  autoComplete="off"
                  placeholder="Describe what's included in this bundle..."
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

          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">Discount Tiers</Text>
                <Button size="slim" onClick={addTier} data-testid="button-add-tier">
                  Add tier
                </Button>
              </InlineStack>
              <Divider />
              <Text as="p" tone="subdued">
                Set quantity thresholds and corresponding{" "}
                {discountType === "percentage" ? "percentage" : "fixed dollar"} discounts.
              </Text>

              {tiers.length === 0 && (
                <Text as="p" tone="subdued" alignment="center">
                  No discount tiers yet. Add one above.
                </Text>
              )}

              <BlockStack gap="300">
                {tiers.map((tier, i) => (
                  <InlineGrid key={i} columns="1fr 1fr auto" gap="300" alignItems="end">
                    <TextField
                      label={i === 0 ? "Min quantity" : ""}
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

          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">Products in Bundle</Text>
                <Button size="slim" onClick={addProduct} data-testid="button-add-product">
                  Add product
                </Button>
              </InlineStack>
              <Divider />
              <Text as="p" tone="subdued">
                Add products to this bundle. Enter product titles (Shopify product picker will be available after connecting your store).
              </Text>

              {products.length === 0 && (
                <Text as="p" tone="subdued" alignment="center">
                  No products yet. Add one above.
                </Text>
              )}

              <BlockStack gap="300">
                {products.map((product, i) => (
                  <Box key={i} background="bg-surface-secondary" borderRadius="200" padding="400">
                    <BlockStack gap="300">
                      <InlineStack align="space-between">
                        <Badge>{`Product ${i + 1}`}</Badge>
                        <Button
                          tone="critical"
                          variant="plain"
                          size="slim"
                          onClick={() => removeProduct(i)}
                          data-testid={`button-remove-product-${i}`}
                        >
                          Remove
                        </Button>
                      </InlineStack>
                      <InlineGrid columns={2} gap="300">
                        <TextField
                          label="Product title"
                          value={product.productTitle}
                          onChange={(v) => updateProduct(i, "productTitle", v)}
                          autoComplete="off"
                          placeholder="e.g. Aluminum-Free Deodorant"
                          data-testid={`input-product-title-${i}`}
                        />
                        <TextField
                          label="Shopify Product ID"
                          value={product.shopifyProductId}
                          onChange={(v) => updateProduct(i, "shopifyProductId", v)}
                          autoComplete="off"
                          placeholder="gid://shopify/Product/123..."
                          helpText="From your Shopify admin"
                          data-testid={`input-product-id-${i}`}
                        />
                      </InlineGrid>
                      <InlineGrid columns={2} gap="300">
                        <TextField
                          label="Min quantity"
                          type="number"
                          value={String(product.minQty)}
                          onChange={(v) => updateProduct(i, "minQty", parseInt(v) || 1)}
                          autoComplete="off"
                          data-testid={`input-product-minqty-${i}`}
                        />
                        <TextField
                          label="Max quantity (optional)"
                          type="number"
                          value={product.maxQty != null ? String(product.maxQty) : ""}
                          onChange={(v) => updateProduct(i, "maxQty", v ? parseInt(v) : null)}
                          autoComplete="off"
                          placeholder="Unlimited"
                          data-testid={`input-product-maxqty-${i}`}
                        />
                      </InlineGrid>
                    </BlockStack>
                  </Box>
                ))}
              </BlockStack>
            </BlockStack>
          </Card>

          <InlineStack align="end" gap="300">
            <Button
              onClick={() => navigate("/admin/bundles")}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={saveMutation.isPending}
              disabled={!name.trim()}
              onClick={() => saveMutation.mutate()}
              data-testid="button-save-bundle"
            >
              {isNew ? "Create bundle" : "Save changes"}
            </Button>
          </InlineStack>
        </BlockStack>
      </Page>
    </AdminLayout>
  );
}
