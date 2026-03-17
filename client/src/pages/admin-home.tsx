import "@shopify/polaris/build/esm/styles.css";
import { AppProvider, Page, Card, Text, BlockStack, InlineGrid, Box, Button, Banner, Divider, Badge } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import { TitleBar } from "@shopify/app-bridge-react";
import { useQuery } from "@tanstack/react-query";

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
    { label: "Bundle Admin UI (Polaris)", done: false },
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
            <InlineGrid key={i} columns="auto 1fr" gap="300" alignItems="center">
              <Box
                background={step.done ? "bg-fill-success" : "bg-fill-disabled"}
                borderRadius="full"
                padding="100"
                minWidth="24px"
                minHeight="24px"
              >
                <Text as="span" alignment="center" tone={step.done ? "success" : "subdued"}>
                  {step.done ? "✓" : String(i + 1)}
                </Text>
              </Box>
              <Text as="p" tone={step.done ? "success" : undefined} textDecorationLine={step.done ? "line-through" : undefined}>
                {step.label}
              </Text>
            </InlineGrid>
          ))}
        </BlockStack>
      </BlockStack>
    </Card>
  );
}

function AdminHomeContent() {
  const { data: authStatus } = useQuery<{
    configured: boolean;
    authenticated: boolean;
    message?: string;
    shop?: string;
  }>({
    queryKey: ["/api/auth/status"],
  });

  const isConfigured = authStatus?.configured;

  return (
    <Page>
      <TitleBar title="Bundle Builder" />
      <BlockStack gap="500">
        {!isConfigured && <SetupBanner />}

        {isConfigured && authStatus?.shop && (
          <Banner title={`Connected to ${authStatus.shop}`} tone="success">
            <Text as="p">Your app is successfully connected to this Shopify store.</Text>
          </Banner>
        )}

        <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
          <StatCard label="Active Bundles" value="0" />
          <StatCard label="Stores Installed" value={isConfigured ? "1" : "0"} />
          <StatCard label="Bundle Revenue" value="$0.00" />
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
                  disabled
                  size="large"
                  data-testid="button-create-bundle"
                >
                  Create New Bundle
                </Button>
                <Button
                  fullWidth
                  variant="plain"
                  url="https://github.com/Sputnick9/shopify-bundle-builder"
                  external
                  data-testid="link-github"
                >
                  View on GitHub
                </Button>
                <Button
                  fullWidth
                  variant="plain"
                  url="/bundle-preview"
                  data-testid="link-bundle-preview"
                >
                  Preview Bundle Builder UI
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
              <InlineGrid columns="200px 1fr" gap="300">
                <Text as="p" fontWeight="semibold" tone="subdued">OAuth Install</Text>
                <Text as="p"><code>/auth?shop=yourstore.myshopify.com</code></Text>
              </InlineGrid>
              <InlineGrid columns="200px 1fr" gap="300">
                <Text as="p" fontWeight="semibold" tone="subdued">OAuth Callback</Text>
                <Text as="p"><code>/auth/callback</code></Text>
              </InlineGrid>
              <InlineGrid columns="200px 1fr" gap="300">
                <Text as="p" fontWeight="semibold" tone="subdued">Webhooks</Text>
                <Text as="p"><code>/api/webhooks</code></Text>
              </InlineGrid>
              <InlineGrid columns="200px 1fr" gap="300">
                <Text as="p" fontWeight="semibold" tone="subdued">GDPR — Data</Text>
                <Text as="p"><code>/api/webhooks/customers/data_request</code></Text>
              </InlineGrid>
              <InlineGrid columns="200px 1fr" gap="300">
                <Text as="p" fontWeight="semibold" tone="subdued">GDPR — Customer</Text>
                <Text as="p"><code>/api/webhooks/customers/redact</code></Text>
              </InlineGrid>
              <InlineGrid columns="200px 1fr" gap="300">
                <Text as="p" fontWeight="semibold" tone="subdued">GDPR — Shop</Text>
                <Text as="p"><code>/api/webhooks/shop/redact</code></Text>
              </InlineGrid>
            </BlockStack>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}

export default function AdminHome() {
  return (
    <AppProvider i18n={enTranslations}>
      <AdminHomeContent />
    </AppProvider>
  );
}
