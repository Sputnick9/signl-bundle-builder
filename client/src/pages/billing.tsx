import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Badge,
  Banner,
  Divider,
  List,
  Box,
  Spinner,
} from "@shopify/polaris";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import AdminLayout from "@/components/admin-layout";

interface BillingStatus {
  hasSubscription: boolean;
  status: string;
  chargeId?: string | null;
  planName?: string;
  planPrice?: string;
  trialDays?: number;
  activatedAt?: string | null;
}

const PLAN_FEATURES = [
  "Unlimited bundle configurations",
  "Tiered quantity discounts (real Shopify checkout discounts)",
  "Theme App Extension — native storefront picker",
  "Custom slot-based product selection",
  "Discount enable/disable per bundle",
  "Priority support",
];

export default function BillingPage() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const shop = params.get("shop") ?? "";
  const host = params.get("host") ?? "";
  const billingResult = params.get("billing");

  const { data: status, isLoading } = useQuery<BillingStatus>({
    queryKey: ["/api/billing/status", shop],
    queryFn: () =>
      fetch(`/api/billing/status?shop=${encodeURIComponent(shop)}`).then((r) => r.json()),
    enabled: !!shop,
    retry: false,
  });

  const subscribe = useMutation({
    mutationFn: () =>
      apiRequest(
        "POST",
        `/api/billing/subscribe?shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(host)}`,
        {}
      ).then((r) => r.json()),
    onSuccess: (data: { confirmationUrl?: string; message?: string }) => {
      if (data.confirmationUrl) {
        if (window.top) {
          window.top.location.href = data.confirmationUrl;
        } else {
          window.location.href = data.confirmationUrl;
        }
      }
    },
  });

  const isActive = status?.hasSubscription && status.status === "active";
  const isPending = status?.status === "pending";
  const isDeclined = billingResult === "declined";
  const justActivated = billingResult === "active" || billingResult === "pending";
  const isError = billingResult === "error";

  if (isLoading) {
    return (
      <AdminLayout>
        <Page>
          <Box padding="800">
            <InlineStack align="center">
              <Spinner size="large" />
            </InlineStack>
          </Box>
        </Page>
      </AdminLayout>
    );
  }

  if (isActive || (isPending && !isDeclined)) {
    return (
      <AdminLayout>
        <Page>
          <BlockStack gap="500">
            <Banner
              title="Subscription Active"
              tone="success"
              action={{
                content: "Go to Dashboard",
                onAction: () => {
                  navigate(host ? `/?shop=${shop}&host=${host}` : `/?shop=${shop}`);
                },
              }}
            >
              <Text as="p">
                Your SiGNL Bundle Builder subscription is active. You have full access to all features.
              </Text>
            </Banner>

            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">{status?.planName ?? "Standard Plan"}</Text>
                  <Badge tone="success" data-testid="badge-subscription-active">Active</Badge>
                </InlineStack>
                <Divider />
                <BlockStack gap="200">
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="p" variant="headingXl" fontWeight="bold">
                      ${status?.planPrice ?? "19.99"}
                    </Text>
                    <Text as="p" tone="subdued">/month</Text>
                  </InlineStack>
                  {(status?.trialDays ?? 0) > 0 && (
                    <Text as="p" tone="subdued">
                      Includes a {status?.trialDays}-day free trial
                    </Text>
                  )}
                </BlockStack>
                <Button
                  variant="primary"
                  size="large"
                  onClick={() => navigate(host ? `/?shop=${shop}&host=${host}` : `/?shop=${shop}`)}
                  data-testid="button-go-to-dashboard"
                >
                  Go to Dashboard
                </Button>
              </BlockStack>
            </Card>
          </BlockStack>
        </Page>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Page>
        <BlockStack gap="500">
          {justActivated && (
            <Banner title="Subscription Confirmed" tone="success">
              <Text as="p">
                Your subscription is being processed. You now have full access to SiGNL Bundle Builder.
              </Text>
            </Banner>
          )}

          {isDeclined && (
            <Banner title="Subscription Declined" tone="warning" data-testid="banner-billing-declined">
              <Text as="p">
                You declined the subscription. You won&apos;t be able to use SiGNL Bundle Builder without an active plan.
                You can approve the subscription at any time below.
              </Text>
            </Banner>
          )}

          {isError && (
            <Banner title="Billing Error" tone="critical">
              <Text as="p">
                There was an error processing your subscription. Please try again or contact support.
              </Text>
            </Banner>
          )}

          <Card>
            <BlockStack gap="600">
              <BlockStack gap="200">
                <Text as="h1" variant="headingXl" fontWeight="bold">
                  SiGNL Bundle Builder
                </Text>
                <Text as="p" tone="subdued" variant="bodyLg">
                  Create powerful product bundles with tiered discounts — applied automatically at checkout through Shopify&apos;s native discount engine.
                </Text>
              </BlockStack>

              <Divider />

              <BlockStack gap="400">
                <InlineStack gap="200" blockAlign="center">
                  <Text as="p" variant="heading2xl" fontWeight="bold">
                    $19.99
                  </Text>
                  <Text as="p" tone="subdued" variant="bodyLg">/month</Text>
                  <Badge tone="info" data-testid="badge-trial">7-day free trial</Badge>
                </InlineStack>
                <Text as="p" tone="subdued">
                  No charge during the free trial period. Cancel anytime through your Shopify admin.
                </Text>
              </BlockStack>

              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">What&apos;s included</Text>
                <List type="bullet">
                  {PLAN_FEATURES.map((feature) => (
                    <List.Item key={feature}>{feature}</List.Item>
                  ))}
                </List>
              </BlockStack>

              <Divider />

              <BlockStack gap="300">
                {subscribe.isError && (
                  <Banner tone="critical">
                    <Text as="p">
                      {subscribe.error instanceof Error
                        ? subscribe.error.message
                        : "Failed to start subscription. Please try again."}
                    </Text>
                  </Banner>
                )}

                {(subscribe.data as { message?: string; confirmationUrl?: string } | undefined)?.message &&
                  !(subscribe.data as { confirmationUrl?: string }).confirmationUrl && (
                  <Banner tone="warning">
                    <Text as="p">
                      {(subscribe.data as { message: string }).message}
                    </Text>
                  </Banner>
                )}

                <Button
                  variant="primary"
                  size="large"
                  fullWidth
                  onClick={() => subscribe.mutate()}
                  loading={subscribe.isPending}
                  data-testid="button-start-subscription"
                >
                  Start 7-Day Free Trial
                </Button>

                <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                  By approving, you agree to be charged $19.99/month after the trial. Manage or cancel your subscription anytime in your Shopify admin under Apps &amp; sales channels.
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Frequently Asked Questions</Text>
              <Divider />
              <BlockStack gap="300">
                <BlockStack gap="100">
                  <Text as="p" fontWeight="semibold">When will I be charged?</Text>
                  <Text as="p" tone="subdued">
                    Your free trial lasts 7 days. After the trial, Shopify will charge $19.99/month on your Shopify invoice — no separate credit card needed.
                  </Text>
                </BlockStack>
                <BlockStack gap="100">
                  <Text as="p" fontWeight="semibold">How do I cancel?</Text>
                  <Text as="p" tone="subdued">
                    You can cancel at any time from your Shopify admin under Apps &amp; sales channels → SiGNL Bundle Builder. Shopify handles all billing management.
                  </Text>
                </BlockStack>
                <BlockStack gap="100">
                  <Text as="p" fontWeight="semibold">What happens if I cancel?</Text>
                  <Text as="p" tone="subdued">
                    Your bundles will stop working on your storefront immediately upon cancellation. Your bundle configurations are saved and will resume if you resubscribe.
                  </Text>
                </BlockStack>
              </BlockStack>
            </BlockStack>
          </Card>
        </BlockStack>
      </Page>
    </AdminLayout>
  );
}
