import AdminLayout from "@/components/admin-layout";
import {
  Page,
  IndexTable,
  Badge,
  Text,
  EmptyState,
  Button,
  InlineStack,
  useIndexResourceState,
  Modal,
  Card,
  BlockStack,
  InlineGrid,
  Divider,
  Collapsible,
  Box,
  Spinner,
  Banner,
  List,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useState, useCallback } from "react";
import type { Bundle } from "@shared/schema";

const HOW_TO_STEPS = [
  {
    title: "Create a Bundle",
    body: "Click 'Create New Bundle' and give it a name and description. For example: 'Build Your Outfit Bundle — mix and match tees, pants, and accessories.' Choose a discount type and set status to Draft while building.",
  },
  {
    title: "Add Collections",
    body: "Each collection is a category tab customers browse in your storefront bundle builder — e.g. 'T-Shirts', 'Pants', 'Sweats & Hoodies', 'Hats', 'Accessories'. Add an optional image URL per collection to display a thumbnail on the tab.",
  },
  {
    title: "Browse & Add Products",
    body: "Inside each collection, click 'Browse Shopify products' to open the Shopify product picker (available when opened inside Shopify Admin). Products and their variants are automatically imported.",
  },
  {
    title: "Configure Discount Tiers",
    body: "Set up tiered discounts — e.g. buy 2 items get 10% off, buy 3 get 15%, buy 4 get 20%. These are applied automatically at checkout through Shopify's native discount engine.",
  },
  {
    title: "Publish to Your Storefront",
    body: "Set the bundle status to 'Active', then go to your Shopify Theme Editor → Add section → Apps → SiGNL Bundle Builder. Place it on any product page or standalone page.",
  },
  {
    title: "Activate the Discount Function",
    body: "For real checkout discounts, deploy the Shopify Function using Shopify CLI, set the SHOPIFY_FUNCTION_ID environment variable, then click 'Register Discount' on this page.",
  },
];

const FAQ_ITEMS = [
  {
    q: "Can I have multiple bundles active at the same time?",
    a: "Yes — each bundle is independent. You can have unlimited active bundles across different product pages or standalone pages. For example, a 'Build Your Outfit' bundle and a separate 'Accessories Pack' bundle can run simultaneously.",
  },
  {
    q: "How do collection tabs work on the storefront?",
    a: "Each collection you add becomes a pill-shaped tab at the top of the bundle widget. Customers click a tab (e.g. 'T-Shirts') to browse products in that category, then navigate to the next tab to complete their bundle. Add an image URL to each collection to show a thumbnail icon inside the tab.",
  },
  {
    q: "Do discounts apply automatically at checkout?",
    a: "Yes, once the Discount Function is registered. Shopify applies the tier discount natively at checkout — no discount codes needed. For example, add 2 items and save 10%, add 3 and save 15%.",
  },
  {
    q: "Can I assign a bundle to multiple pages?",
    a: "Yes — add the bundle builder block to as many pages or product pages as you like in the theme editor. Configure which bundle ID to display in each block's settings.",
  },
  {
    q: "What happens to a bundle if I delete it?",
    a: "The bundle and all its collection configuration are permanently removed. Any pages displaying that bundle will show an empty state until updated.",
  },
  {
    q: "Can I use the bundle builder on a 'Build Your Own Outfit' landing page?",
    a: "Yes — the bundle builder can be placed as a section on any page in your theme, not just product pages. It works great as a standalone 'Build Your Look' or 'Customize Your Bundle' page.",
  },
];

function statusBadge(status: string) {
  if (status === "active") return <Badge tone="success">Active</Badge>;
  if (status === "archived") return <Badge tone="warning">Archived</Badge>;
  return <Badge tone="info">Draft</Badge>;
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface DiscountStatus {
  configured: boolean;
  functionIdSet: boolean;
  active: boolean;
  discountId?: string | null;
  title?: string | null;
  error?: string;
}

function DiscountFunctionCard({ shop }: { shop: string }) {
  const qc = useQueryClient();
  const discountKey = ["/api/shop/discount", shop];

  const { data: status, isLoading } = useQuery<DiscountStatus>({
    queryKey: discountKey,
    queryFn: () =>
      fetch(`/api/shop/discount?shop=${encodeURIComponent(shop)}`).then((r) => r.json()),
    enabled: !!shop,
  });

  const register = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/shop/discount?shop=${encodeURIComponent(shop)}`, {}).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: discountKey }),
  });

  const deregister = useMutation({
    mutationFn: () =>
      apiRequest("DELETE", `/api/shop/discount?shop=${encodeURIComponent(shop)}`, { discountId: status?.discountId }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: discountKey }),
  });

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingMd">Discount Function</Text>
          {isLoading ? (
            <Spinner size="small" />
          ) : status?.active ? (
            <Badge tone="success" data-testid="badge-discount-active">Active</Badge>
          ) : (
            <Badge tone="warning" data-testid="badge-discount-inactive">Inactive</Badge>
          )}
        </InlineStack>
        <Divider />
        <BlockStack gap="300">
          {!status?.configured && (
            <Text as="p" tone="subdued">Configure Shopify credentials to enable automatic discounts.</Text>
          )}
          {status?.configured && !status.functionIdSet && (
            <Banner tone="warning">
              <Text as="p">
                Set the <code>SHOPIFY_FUNCTION_ID</code> environment variable after running{" "}
                <code>shopify app deploy</code> to activate checkout discounts.
              </Text>
            </Banner>
          )}
          {status?.configured && status.functionIdSet && (
            <>
              <Text as="p" tone="subdued">
                {status.active
                  ? `Automatic discount "${status.title}" is active at checkout.`
                  : "The Shopify Function is deployed but the automatic discount has not been registered yet."}
              </Text>
              {status.error && (
                <Text as="p" tone="critical">{status.error}</Text>
              )}
              <InlineStack gap="300">
                {!status.active && (
                  <Button
                    variant="primary"
                    onClick={() => register.mutate()}
                    loading={register.isPending}
                    data-testid="button-register-discount"
                  >
                    Register Discount
                  </Button>
                )}
                {status.active && status.discountId && (
                  <Button
                    tone="critical"
                    onClick={() => deregister.mutate()}
                    loading={deregister.isPending}
                    data-testid="button-deregister-discount"
                  >
                    Deactivate Discount
                  </Button>
                )}
              </InlineStack>
            </>
          )}
        </BlockStack>
      </BlockStack>
    </Card>
  );
}

export default function AdminBundles() {
  const [, navigate] = useLocation();
  const [deleteTarget, setDeleteTarget] = useState<Bundle | null>(null);
  const [howToOpen, setHowToOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const qc = useQueryClient();

  const urlParams = new URLSearchParams(window.location.search);
  const shopParam = urlParams.get("shop") ?? "";

  const { data: bundles = [], isLoading } = useQuery<Bundle[]>({
    queryKey: ["/api/bundles"],
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/bundles/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bundles"] });
      setDeleteTarget(null);
    },
  });

  const toggleDiscountMutation = useMutation({
    mutationFn: ({ id, discountEnabled }: { id: number; discountEnabled: boolean }) =>
      apiRequest("PUT", `/api/bundles/${id}`, { discountEnabled }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bundles"] });
    },
  });

  const confirmDelete = useCallback((bundle: Bundle) => {
    setDeleteTarget(bundle);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (deleteTarget) {
      deleteMut.mutate(deleteTarget.id);
    }
  }, [deleteTarget, deleteMut]);

  const handleCancelDelete = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const activeBundles = bundles.filter((b) => b.status === "active").length;

  const resourceName = { singular: "bundle", plural: "bundles" };
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(bundles.map((b) => ({ id: String(b.id) })));

  const rowMarkup = bundles.map((bundle, index) => (
    <IndexTable.Row
      id={String(bundle.id)}
      key={bundle.id}
      selected={selectedResources.includes(String(bundle.id))}
      position={index}
      data-testid={`row-bundle-${bundle.id}`}
    >
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">
          {bundle.name}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {statusBadge(bundle.status)}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" tone="subdued">
          {bundle.discountType === "percentage" ? "% off" : "$ off"} per tier
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" tone="subdued">
          {formatDate(bundle.createdAt)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Button
          size="slim"
          pressed={bundle.discountEnabled !== false}
          onClick={() =>
            toggleDiscountMutation.mutate({
              id: bundle.id,
              discountEnabled: bundle.discountEnabled === false,
            })
          }
          loading={toggleDiscountMutation.isPending}
          data-testid={`button-toggle-discount-${bundle.id}`}
        >
          {bundle.discountEnabled !== false ? "Discount On" : "Discount Off"}
        </Button>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          <Button
            size="slim"
            onClick={() => navigate(`/admin/bundles/${bundle.id}`)}
            data-testid={`button-edit-bundle-${bundle.id}`}
          >
            Edit
          </Button>
          <Button
            size="slim"
            tone="critical"
            onClick={() => confirmDelete(bundle)}
            data-testid={`button-delete-bundle-${bundle.id}`}
          >
            Delete
          </Button>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <AdminLayout>
      <Page>
        <TitleBar title="Bundles">
          <button
            variant="primary"
            onClick={() => navigate("/admin/bundles/new")}
            data-testid="button-create-bundle-titlebar"
          >
            Create bundle
          </button>
        </TitleBar>

        <BlockStack gap="500">
          <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
            <Card>
              <BlockStack gap="200">
                <Text as="p" tone="subdued">Total Bundles</Text>
                <Text as="p" variant="headingXl" fontWeight="bold" data-testid="stat-total-bundles">
                  {isLoading ? "—" : String(bundles.length)}
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text as="p" tone="subdued">Active Bundles</Text>
                <Text as="p" variant="headingXl" fontWeight="bold" data-testid="stat-active-bundles">
                  {isLoading ? "—" : String(activeBundles)}
                </Text>
              </BlockStack>
            </Card>
          </InlineGrid>

          <InlineStack gap="300">
            <Button
              variant="primary"
              size="large"
              onClick={() => navigate("/admin/bundles/new")}
              data-testid="button-create-bundle"
            >
              Create New Bundle
            </Button>
            <Button
              size="large"
              url="/bundle-preview"
              data-testid="link-preview-storefront"
            >
              Preview Storefront UI
            </Button>
          </InlineStack>

          <Modal
            open={deleteTarget !== null}
            onClose={handleCancelDelete}
            title="Delete bundle?"
            primaryAction={{
              content: "Delete",
              destructive: true,
              loading: deleteMut.isPending,
              onAction: handleConfirmDelete,
            }}
            secondaryActions={[
              {
                content: "Cancel",
                onAction: handleCancelDelete,
              },
            ]}
          >
            <Modal.Section>
              <Text as="p">
                Are you sure you want to delete{" "}
                <Text as="span" fontWeight="bold">
                  {deleteTarget?.name}
                </Text>
                ? This will permanently remove the bundle and all its slot configuration. This action cannot be undone.
              </Text>
            </Modal.Section>
          </Modal>

          {!isLoading && bundles.length === 0 ? (
            <EmptyState
              heading="Build your first outfit bundle"
              action={{
                content: "Create bundle",
                onAction: () => navigate("/admin/bundles/new"),
              }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>
                Create a bundle with collection tabs — T-Shirts, Pants, Shoes, and more — and offer volume discounts to boost your average order value.
              </p>
            </EmptyState>
          ) : (
            <IndexTable
              resourceName={resourceName}
              itemCount={bundles.length}
              selectedItemsCount={
                allResourcesSelected ? "All" : selectedResources.length
              }
              onSelectionChange={handleSelectionChange}
              loading={isLoading}
              headings={[
                { title: "Bundle name" },
                { title: "Status" },
                { title: "Discount type" },
                { title: "Created" },
                { title: "Discount" },
                { title: "Actions" },
              ]}
            >
              {rowMarkup}
            </IndexTable>
          )}

          <DiscountFunctionCard shop={shopParam} />

          <Card>
            <BlockStack gap="0">
              <Box paddingBlockEnd="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">How to Build a Bundle</Text>
                  <Button
                    variant="plain"
                    onClick={() => setHowToOpen((v) => !v)}
                    ariaExpanded={howToOpen}
                    ariaControls="how-to-collapsible"
                    data-testid="button-toggle-howto"
                  >
                    {howToOpen ? "▲ Collapse" : "▼ Expand"}
                  </Button>
                </InlineStack>
              </Box>
              <Collapsible
                open={howToOpen}
                id="how-to-collapsible"
                transition={{ duration: "200ms", timingFunction: "ease-in-out" }}
              >
                <Divider />
                <Box paddingBlockStart="400">
                  <BlockStack gap="400">
                    {HOW_TO_STEPS.map((step, i) => (
                      <InlineStack key={i} gap="300" blockAlign="start">
                        <Box
                          background="bg-fill-brand"
                          borderRadius="full"
                          minWidth="28px"
                          minHeight="28px"
                        >
                          <Box padding="100">
                            <Text as="span" variant="bodySm" fontWeight="bold" tone="text-inverse" alignment="center">
                              {i + 1}
                            </Text>
                          </Box>
                        </Box>
                        <BlockStack gap="100">
                          <Text as="p" fontWeight="semibold">{step.title}</Text>
                          <Text as="p" tone="subdued">{step.body}</Text>
                        </BlockStack>
                      </InlineStack>
                    ))}
                  </BlockStack>
                </Box>
              </Collapsible>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="0">
              <Box paddingBlockEnd="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">Frequently Asked Questions</Text>
                  <Button
                    variant="plain"
                    onClick={() => setFaqOpen((v) => !v)}
                    ariaExpanded={faqOpen}
                    ariaControls="faq-collapsible"
                    data-testid="button-toggle-faq"
                  >
                    {faqOpen ? "▲ Collapse" : "▼ Expand"}
                  </Button>
                </InlineStack>
              </Box>
              <Collapsible
                open={faqOpen}
                id="faq-collapsible"
                transition={{ duration: "200ms", timingFunction: "ease-in-out" }}
              >
                <Divider />
                <Box paddingBlockStart="400">
                  <List type="bullet">
                    {FAQ_ITEMS.map((item, i) => (
                      <List.Item key={i}>
                        <BlockStack gap="100">
                          <Text as="p" fontWeight="semibold">{item.q}</Text>
                          <Text as="p" tone="subdued">{item.a}</Text>
                        </BlockStack>
                      </List.Item>
                    ))}
                  </List>
                </Box>
              </Collapsible>
            </BlockStack>
          </Card>
        </BlockStack>
      </Page>
    </AdminLayout>
  );
}
