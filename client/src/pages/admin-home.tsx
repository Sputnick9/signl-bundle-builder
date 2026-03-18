import AdminLayout from "@/components/admin-layout";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineGrid,
  Box,
  Button,
  Banner,
  Divider,
  Badge,
  InlineStack,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Bundle } from "@shared/schema";

function SetupBanner() {
  return (
    <Banner
      title="Connect your Shopify Partner App"
      tone="warning"
      action={{
        content: "View Setup Guide",
        url: "https://github.com/Sputnick9/shopify-bundle-builder#readme",
        external: true,
      }}
    >
      <BlockStack gap="200">
        <Text as="p">
          To enable full Shopify integration, set these environment variables in your Replit Secrets:
        </Text>
        <BlockStack gap="100">
          <Text as="p" fontWeight="semibold"><code>SHOPIFY_API_KEY</code> — from your Partner Dashboard</Text>
          <Text as="p" fontWeight="semibold"><code>SHOPIFY_API_SECRET</code> — from your Partner Dashboard</Text>
          <Text as="p" fontWeight="semibold"><code>SHOPIFY_APP_URL</code> — your app&apos;s public URL (this Replit URL)</Text>
          <Text as="p" fontWeight="semibold"><code>VITE_SHOPIFY_API_KEY</code> — same as SHOPIFY_API_KEY (exposed to browser)</Text>
        </BlockStack>
      </BlockStack>
    </Banner>
  );
}

function StatCard({ label, value, badge }: { label: string; value: string; badge?: string }) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="p" tone="subdued">{label}</Text>
        <InlineGrid columns="1fr auto" alignItems="center">
          <Text as="p" variant="headingXl" fontWeight="bold">{value}</Text>
          {badge && <Badge tone="success">{badge}</Badge>}
        </InlineGrid>
      </BlockStack>
    </Card>
  );
}

function RoadmapCard() {
  const steps = [
    { label: "App Foundation & OAuth", done: true },
    { label: "Bundle Admin UI (Polaris)", done: true },
    { label: "Theme App Extension (Storefront)", done: false },
    { label: "Shopify Functions (Real Discounts)", done: false },
    { label: "Billing & Subscriptions", done: false },
  ];

  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingMd">Build Roadmap</Text>
        <Divider />
        <BlockStack gap="300">
          {steps.map((step, i) => (
            <InlineStack key={i} gap="300" blockAlign="center">
              <Box
                background={step.done ? "bg-fill-success" : "bg-fill-disabled"}
                borderRadius="full"
                padding="100"
                minWidth="28px"
              >
                <Text as="span" alignment="center" tone={step.done ? "success" : "subdued"}>
                  {step.done ? "✓" : String(i + 1)}
                </Text>
              </Box>
              <Text
                as="p"
                tone={step.done ? "success" : undefined}
                textDecorationLine={step.done ? "line-through" : undefined}
              >
                {step.label}
              </Text>
            </InlineStack>
          ))}
        </BlockStack>
      </BlockStack>
    </Card>
  );
}

export default function AdminHome() {
  const [, navigate] = useLocation();

  const shopParam = new URLSearchParams(window.location.search).get("shop") ?? "";
  const authStatusUrl = shopParam
    ? `/api/auth/status?shop=${encodeURIComponent(shopParam)}`
    : "/api/auth/status";

  const { data: authStatus } = useQuery<{
    configured: boolean;
    authenticated: boolean;
    message?: string;
    shop?: string;
  }>({ queryKey: [authStatusUrl] });

  const { data: bundles = [] } = useQuery<Bundle[]>({
    queryKey: ["/api/bundles"],
  });

  const activeBundles = bundles.filter((b) => b.status === "active").length;
  const isConfigured = authStatus?.configured;

  return (
    <AdminLayout>
      <Page>
        <TitleBar title="Bundle Builder" />
        <BlockStack gap="500">
          {!isConfigured && <SetupBanner />}

          {isConfigured && authStatus?.shop && (
            <Banner title={`Connected to ${authStatus.shop}`} tone="success" data-testid="banner-app-installed">
              <Text as="p" data-testid="text-app-installed">App is installed and connected to this Shopify store.</Text>
            </Banner>
          )}

          <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
            <StatCard label="Total Bundles" value={String(bundles.length)} />
            <StatCard label="Active Bundles" value={String(activeBundles)} />
            <StatCard label="Stores Installed" value={isConfigured ? "1" : "0"} />
          </InlineGrid>

          <InlineGrid columns={{ xs: 1, md: "1fr 1fr" }} gap="400">
            <RoadmapCard />

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Quick Actions</Text>
                <Divider />
                <BlockStack gap="300">
                  <Button
                    fullWidth
                    variant="primary"
                    size="large"
                    onClick={() => navigate("/admin/bundles/new")}
                    data-testid="button-create-bundle"
                  >
                    Create New Bundle
                  </Button>
                  <Button
                    fullWidth
                    onClick={() => navigate("/admin/bundles")}
                    data-testid="button-view-bundles"
                  >
                    View All Bundles
                  </Button>
                  <Button
                    fullWidth
                    variant="plain"
                    url="/bundle-preview"
                    data-testid="link-bundle-preview"
                  >
                    Preview Storefront UI
                  </Button>
                </BlockStack>
              </BlockStack>
            </Card>
          </InlineGrid>

          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">OAuth &amp; Webhook Endpoints</Text>
              <Divider />
              <BlockStack gap="200">
                {[
                  ["OAuth Install", "/auth?shop=yourstore.myshopify.com"],
                  ["OAuth Callback", "/auth/callback"],
                  ["Webhook Handler", "/api/webhooks"],
                  ["GDPR — Data Request", "/api/webhooks/customers/data_request"],
                  ["GDPR — Customer Redact", "/api/webhooks/customers/redact"],
                  ["GDPR — Shop Redact", "/api/webhooks/shop/redact"],
                ].map(([label, endpoint]) => (
                  <InlineGrid key={label} columns="220px 1fr" gap="300">
                    <Text as="p" fontWeight="semibold" tone="subdued">{label}</Text>
                    <Text as="p"><code>{endpoint}</code></Text>
                  </InlineGrid>
                ))}
              </BlockStack>
            </BlockStack>
          </Card>
        </BlockStack>
      </Page>
    </AdminLayout>
  );
}
