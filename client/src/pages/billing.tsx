import { useState } from "react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  InlineGrid,
  Button,
  Badge,
  Banner,
  Divider,
  Box,
  Spinner,
  Icon,
} from "@shopify/polaris";
import { CheckCircleIcon, MinusCircleIcon } from "@shopify/polaris-icons";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import AdminLayout from "@/components/admin-layout";

type PlanTier = "free" | "essential" | "pro";

interface BillingStatus {
  hasSubscription: boolean;
  status: string;
  planTier: PlanTier;
  chargeId?: string | null;
  planName?: string;
  planPrice?: string;
  trialDays?: number;
  activatedAt?: string | null;
  maxActiveBundles: number | null;
  cssAccess: boolean;
  advancedAnalytics: boolean;
  unlimitedSales: boolean;
}

interface PlanFeatureRow {
  label: string;
  free: string | boolean;
  essential: string | boolean;
  pro: string | boolean;
}

const FEATURES: PlanFeatureRow[] = [
  { label: "Bundle sales cap", free: "Up to $500/mo", essential: "Up to $5,000/mo", pro: "Unlimited" },
  { label: "Active bundles", free: "Up to 1", essential: "Up to 20", pro: "Unlimited" },
  { label: "Percentage discounts", free: true, essential: true, pro: true },
  { label: "Fixed amount discounts", free: false, essential: true, pro: true },
  { label: "All discount tiers", free: false, essential: true, pro: true },
  { label: "Theme App Extension", free: true, essential: true, pro: true },
  { label: "Collection-based slots", free: true, essential: true, pro: true },
  { label: "Basic analytics", free: false, essential: "Coming soon", pro: "Coming soon" },
  { label: "Custom CSS styling", free: false, essential: false, pro: true },
  { label: "Early access to features", free: false, essential: false, pro: true },
  { label: "Support", free: "Community email", essential: "Priority email (next business day)", pro: "Priority + onboarding call" },
];

function FeatureValue({ value }: { value: string | boolean }) {
  if (value === false) {
    return (
      <InlineStack gap="100" blockAlign="center">
        <Box>
          <Icon source={MinusCircleIcon} tone="subdued" />
        </Box>
        <Text as="span" tone="subdued" variant="bodySm">—</Text>
      </InlineStack>
    );
  }
  if (value === true) {
    return (
      <InlineStack gap="100" blockAlign="center">
        <Box>
          <Icon source={CheckCircleIcon} tone="success" />
        </Box>
      </InlineStack>
    );
  }
  return (
    <InlineStack gap="100" blockAlign="center">
      <Box>
        <Icon source={CheckCircleIcon} tone="success" />
      </Box>
      <Text as="span" variant="bodySm">{value}</Text>
    </InlineStack>
  );
}

interface PlanCardProps {
  tier: PlanTier;
  currentTier: PlanTier;
  isActive: boolean;
  onSubscribe: (tier: PlanTier) => void;
  subscribing: boolean;
  subscribingTier: PlanTier | null;
  onGoToBundles: () => void;
}

const PLAN_DISPLAY: Record<PlanTier, { label: string; tagline: string; price: string; trial: string | null; popular: boolean }> = {
  free: {
    label: "Free",
    tagline: "Get started with bundles at no cost",
    price: "0",
    trial: null,
    popular: false,
  },
  essential: {
    label: "Essential",
    tagline: "For growing stores scaling bundle revenue",
    price: "29",
    trial: "7-day free trial",
    popular: false,
  },
  pro: {
    label: "Pro",
    tagline: "For high-volume stores with custom needs",
    price: "49",
    trial: "14-day free trial",
    popular: true,
  },
};

function PlanCard({ tier, currentTier, isActive, onSubscribe, subscribing, subscribingTier, onGoToBundles }: Readonly<PlanCardProps>) {
  const plan = PLAN_DISPLAY[tier];
  const isCurrent = currentTier === tier && isActive;
  const isPaidActive = isActive && currentTier !== "free";
  const isOtherActivePlan = isPaidActive && !isCurrent;
  const isPending = subscribingTier === tier && subscribing;

  let ctaLabel = `Subscribe to ${plan.label}`;
  if (isCurrent) ctaLabel = "Go to Bundles";
  else if (tier === "free") ctaLabel = "Continue on Free";

  const ctaVariant: "primary" | "secondary" = isCurrent || tier === "free" ? "secondary" : "primary";

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      borderRadius: "var(--p-border-radius-300)",
      boxShadow: "var(--p-shadow-100)",
      backgroundColor: "var(--p-color-bg-surface)",
      overflow: "hidden",
      border: plan.popular ? "2px solid var(--p-color-bg-fill-brand)" : "1px solid var(--p-color-border)",
    }}>
      {plan.popular ? (
        <div style={{
          backgroundColor: "var(--p-color-bg-fill-brand)",
          padding: "8px 16px",
          textAlign: "center",
        }}>
          <Text as="p" variant="bodySm" fontWeight="semibold" tone="text-inverse">
            Most Popular
          </Text>
        </div>
      ) : (
        <div style={{ height: "36px" }} />
      )}

      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: "var(--p-space-500)",
        gap: "var(--p-space-500)",
      }}>
        <BlockStack gap="200">
          <InlineStack align="space-between" blockAlign="start">
            <Text as="h2" variant="headingLg" fontWeight="bold">
              {plan.label}
            </Text>
            {isCurrent && (
              <Badge tone="success" data-testid={`badge-current-plan-${tier}`}>
                Current Plan
              </Badge>
            )}
          </InlineStack>
          <Text as="p" tone="subdued" variant="bodySm">
            {plan.tagline}
          </Text>
        </BlockStack>

        <BlockStack gap="100">
          <InlineStack gap="100" blockAlign="baseline">
            <Text as="p" variant="heading2xl" fontWeight="bold">
              ${plan.price}
            </Text>
            <Text as="p" tone="subdued">/month</Text>
          </InlineStack>
          {plan.trial && (
            <Badge tone="info" data-testid={`badge-trial-${tier}`}>
              {plan.trial}
            </Badge>
          )}
          {tier === "free" && (
            <Text as="p" variant="bodySm" tone="subdued">
              Free to install, forever
            </Text>
          )}
        </BlockStack>

        <Divider />

        <div style={{ flex: 1 }}>
          <BlockStack gap="300">
            <Text as="p" variant="bodySm" fontWeight="semibold" tone="subdued">
              FEATURES
            </Text>
            <BlockStack gap="200">
              {FEATURES.map((feature) => (
                <InlineStack key={feature.label} gap="200" blockAlign="center">
                  <Box minWidth="20px">
                    <FeatureValue value={feature[tier]} />
                  </Box>
                  <Text as="p" variant="bodySm">
                    {feature.label}
                  </Text>
                </InlineStack>
              ))}
            </BlockStack>
          </BlockStack>
        </div>

        <div style={{ paddingTop: "var(--p-space-400)" }}>
          {isOtherActivePlan ? (
            <Text as="p" variant="bodySm" tone="subdued" alignment="center" data-testid={`text-plan-inactive-${tier}`}>
              Manage your subscription in Shopify Admin under Apps &amp; sales channels.
            </Text>
          ) : (
            <Button
              variant={ctaVariant}
              size="large"
              fullWidth
              onClick={() => {
                if (isCurrent || tier === "free") {
                  onGoToBundles();
                } else {
                  onSubscribe(tier);
                }
              }}
              loading={isPending}
              data-testid={`button-subscribe-${tier}`}
            >
              {ctaLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BillingPage() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const shop = params.get("shop") ?? "";
  const host = params.get("host") ?? "";
  const billingResult = params.get("billing");

  const { data: status, isLoading } = useQuery<BillingStatus>({
    queryKey: [`/api/billing/status?shop=${encodeURIComponent(shop)}`],
    enabled: true,
    retry: false,
  });

  const [subscribingTier, setSubscribingTier] = useState<PlanTier | null>(null);

  const subscribe = useMutation({
    mutationFn: (planTier: PlanTier) => {
      setSubscribingTier(planTier);
      return apiRequest(
        "POST",
        `/api/billing/subscribe?shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(host)}&plan=${planTier}`,
        {}
      ).then((r) => r.json());
    },
    onSuccess: (data: { confirmationUrl?: string; message?: string }) => {
      if (data.confirmationUrl) {
        if (window.top) {
          window.top.location.href = data.confirmationUrl;
        } else {
          window.location.href = data.confirmationUrl;
        }
      }
    },
    onSettled: () => setSubscribingTier(null),
  });

  const currentTier: PlanTier = status?.planTier ?? "free";
  const isActive = status?.hasSubscription === true && status?.status === "active";
  const isDeclined = billingResult === "declined";
  const isError = billingResult === "error";
  const justActivated = billingResult === "active" || billingResult === "pending";

  const goToBundles = () => {
    navigate(host ? `/admin/bundles?shop=${shop}&host=${host}` : `/admin/bundles?shop=${shop}`);
  };

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

  return (
    <AdminLayout>
      <Page>
        <BlockStack gap="600">
          {justActivated && (
            <Banner title="Subscription Confirmed" tone="success" data-testid="banner-billing-success">
              <Text as="p">
                Your subscription is being processed. You now have full access to SiGNL Bundle Builder.
              </Text>
            </Banner>
          )}

          {isDeclined && (
            <Banner title="Subscription Declined" tone="warning" data-testid="banner-billing-declined">
              <Text as="p">
                You declined the subscription. You can still use the Free plan or subscribe to a paid plan below.
              </Text>
            </Banner>
          )}

          {isError && (
            <Banner title="Billing Error" tone="critical" data-testid="banner-billing-error">
              <Text as="p">
                There was an error processing your subscription. Please try again or contact support.
              </Text>
            </Banner>
          )}

          {subscribe.isError && (
            <Banner title="Subscription Error" tone="critical">
              <Text as="p">
                {subscribe.error instanceof Error
                  ? subscribe.error.message
                  : "Failed to start subscription. Please try again."}
              </Text>
            </Banner>
          )}

          {(subscribe.data as { message?: string; confirmationUrl?: string } | undefined)?.message &&
            !(subscribe.data as { confirmationUrl?: string }).confirmationUrl && (
            <Banner title="Billing Not Configured" tone="warning">
              <Text as="p">
                {(subscribe.data as { message: string }).message}
              </Text>
            </Banner>
          )}

          <BlockStack gap="300">
            <Text as="h1" variant="headingXl" fontWeight="bold" alignment="center">
              Choose your plan
            </Text>
            <Text as="p" tone="subdued" alignment="center">
              All plans include the Theme App Extension and collection-based bundle slots.
              Upgrade or downgrade anytime through your Shopify admin.
            </Text>
          </BlockStack>

          <InlineGrid columns={3} gap="400" alignItems="stretch">
            {(["free", "essential", "pro"] as PlanTier[]).map((tier) => (
              <PlanCard
                key={tier}
                tier={tier}
                currentTier={currentTier}
                isActive={isActive}
                onSubscribe={(t) => subscribe.mutate(t)}
                subscribing={subscribe.isPending}
                subscribingTier={subscribingTier}
                onGoToBundles={goToBundles}
              />
            ))}
          </InlineGrid>

          <Text as="p" variant="bodySm" tone="subdued" alignment="center">
            By subscribing, you agree to be charged on your Shopify invoice after any trial period.
            Manage or cancel your subscription anytime in your Shopify admin under Apps &amp; sales channels.
          </Text>

          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Frequently Asked Questions</Text>
              <Divider />
              <BlockStack gap="300">
                <BlockStack gap="100">
                  <Text as="p" fontWeight="semibold">Is the Free plan really free?</Text>
                  <Text as="p" tone="subdued">
                    Yes. The Free plan is free forever with no credit card required. You get 1 active bundle and percentage discounts,
                    up to $500/month in bundle sales.
                  </Text>
                </BlockStack>
                <BlockStack gap="100">
                  <Text as="p" fontWeight="semibold">When will I be charged?</Text>
                  <Text as="p" tone="subdued">
                    Essential starts with a 7-day free trial; Pro starts with a 14-day free trial.
                    After the trial, Shopify charges the monthly fee on your Shopify invoice — no separate credit card needed.
                  </Text>
                </BlockStack>
                <BlockStack gap="100">
                  <Text as="p" fontWeight="semibold">Can I upgrade or downgrade?</Text>
                  <Text as="p" tone="subdued">
                    You can upgrade to a paid plan at any time. Downgrades are managed through your Shopify admin under
                    Apps &amp; sales channels.
                  </Text>
                </BlockStack>
                <BlockStack gap="100">
                  <Text as="p" fontWeight="semibold">What happens if I exceed the sales cap?</Text>
                  <Text as="p" tone="subdued">
                    We&apos;ll show you an upgrade prompt when you&apos;re approaching your limit.
                    Your bundles won&apos;t be hard-blocked — you&apos;ll just be encouraged to move to the next tier.
                  </Text>
                </BlockStack>
                <BlockStack gap="100">
                  <Text as="p" fontWeight="semibold">How do I cancel a paid plan?</Text>
                  <Text as="p" tone="subdued">
                    Cancel anytime from your Shopify admin under Apps &amp; sales channels → SiGNL Bundle Builder.
                    After cancellation, you&apos;ll revert to the Free plan.
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
