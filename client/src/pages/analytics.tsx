import { useState } from "react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  InlineGrid,
  Select,
  DataTable,
  EmptyState,
  Box,
  Banner,
  SkeletonDisplayText,
  SkeletonBodyText,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useQuery } from "@tanstack/react-query";

import AdminLayout from "@/components/admin-layout";

async function buildAuthHeaders(): Promise<HeadersInit> {
  try {
    if (
      typeof window !== "undefined" &&
      (
        window as Window & {
          shopify?: { idToken: () => Promise<string> };
        }
      ).shopify?.idToken
    ) {
      const token = await (
        window as Window & { shopify: { idToken: () => Promise<string> } }
      ).shopify.idToken();
      if (token) return { Authorization: `Bearer ${token}` };
    }
  } catch {
  }
  return {};
}

interface BundleAnalyticsStat {
  bundleId: number;
  bundleName: string;
  views: number;
  carts: number;
  orders: number;
  conversionRate: number;
}

interface AnalyticsResponse {
  days: number;
  totalViews: number;
  totalCarts: number;
  totalOrders: number;
  stats: BundleAnalyticsStat[];
}

const DATE_RANGE_OPTIONS = [
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "Last 90 days", value: "90" },
];

function KpiCard({
  label,
  value,
  helpText,
  testId,
  loading,
}: {
  label: string;
  value: number | string;
  helpText?: string;
  testId?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <BlockStack gap="100">
        <Text as="p" variant="bodySm" tone="subdued">
          {label}
        </Text>
        {loading ? (
          <SkeletonDisplayText size="medium" />
        ) : (
          <Text
            as="p"
            variant="headingXl"
            fontWeight="bold"
            data-testid={testId}
          >
            {value}
          </Text>
        )}
        {helpText && (
          <Text as="p" variant="bodySm" tone="subdued">
            {helpText}
          </Text>
        )}
      </BlockStack>
    </Card>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState("30");

  const { data, isLoading, isError } = useQuery<AnalyticsResponse | null>({
    queryKey: ["/api/analytics", days],
    queryFn: async () => {
      const res = await fetch(`/api/analytics?days=${days}`, {
        headers: await buildAuthHeaders(),
        credentials: "include",
      });
      if (res.status === 401 || res.status === 402) return null;
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    retry: 1,
  });

  const hasData = data != null && data.stats.length > 0;

  const tableRows = (data?.stats ?? []).map((s) => [
    <Text as="span" data-testid={`bundle-name-${s.bundleId}`}>
      {s.bundleName}
    </Text>,
    <Text as="span" data-testid={`views-${s.bundleId}`}>
      {s.views.toLocaleString()}
    </Text>,
    <Text as="span" data-testid={`carts-${s.bundleId}`}>
      {s.carts.toLocaleString()}
    </Text>,
    <Text as="span" data-testid={`orders-${s.bundleId}`}>
      {s.orders.toLocaleString()}
    </Text>,
    <Text as="span" data-testid={`conversion-${s.bundleId}`}>
      {s.conversionRate}%
    </Text>,
  ]);

  return (
    <AdminLayout>
      <Page>
        <TitleBar title="Analytics" />
        <BlockStack gap="500">
          <InlineStack align="space-between" blockAlign="center" wrap={false}>
            <Text as="h1" variant="headingLg">
              Bundle Performance
            </Text>
            <div data-testid="date-range-select" style={{ minWidth: 160 }}>
              <Select
                label="Date range"
                labelHidden
                options={DATE_RANGE_OPTIONS}
                value={days}
                onChange={setDays}
              />
            </div>
          </InlineStack>

          {isError ? (
            <Banner tone="critical">
              <Text as="p">
                Failed to load analytics data. Please try again later.
              </Text>
            </Banner>
          ) : (
            <>
              <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
                <KpiCard
                  label="Total Bundle Views"
                  value={(data?.totalViews ?? 0).toLocaleString()}
                  helpText="Widget loads on storefront"
                  testId="kpi-total-views"
                  loading={isLoading}
                />
                <KpiCard
                  label="Add-to-Cart Events"
                  value={(data?.totalCarts ?? 0).toLocaleString()}
                  helpText="Clicked 'Add Bundle to Cart'"
                  testId="kpi-total-carts"
                  loading={isLoading}
                />
                <KpiCard
                  label="Completed Bundle Orders"
                  value={(data?.totalOrders ?? 0).toLocaleString()}
                  helpText="Orders containing a bundle"
                  testId="kpi-total-orders"
                  loading={isLoading}
                />
              </InlineGrid>

              <Card padding="0">
                {isLoading ? (
                  <Box padding="400">
                    <BlockStack gap="300">
                      <SkeletonBodyText lines={1} />
                      <SkeletonBodyText lines={3} />
                    </BlockStack>
                  </Box>
                ) : hasData ? (
                  <DataTable
                    columnContentTypes={[
                      "text",
                      "numeric",
                      "numeric",
                      "numeric",
                      "numeric",
                    ]}
                    headings={[
                      "Bundle",
                      "Views",
                      "Add-to-Cart",
                      "Orders",
                      "Conversion Rate",
                    ]}
                    rows={tableRows}
                  />
                ) : (
                  <EmptyState
                    heading="No analytics data yet"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <BlockStack gap="200">
                      <Text as="p" tone="subdued">
                        Analytics data appears here once customers view your
                        bundles on your storefront.
                      </Text>
                      <Text as="p" tone="subdued">
                        Make sure your bundles are active and the storefront
                        widget is installed. Events are recorded when customers
                        interact with your bundle picker.
                      </Text>
                    </BlockStack>
                  </EmptyState>
                )}
              </Card>
            </>
          )}
        </BlockStack>
      </Page>
    </AdminLayout>
  );
}
