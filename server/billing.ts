import { db } from "./db";
import { shopSubscriptions } from "@shared/schema";
import { eq } from "drizzle-orm";

function log(msg: string) {
  console.log(`[billing] ${msg}`);
}

export type PlanTier = "free" | "essential" | "pro";

export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  price: string;
  trialDays: number;
  maxBundles: number | null;
  salesCapLabel: string;
  cssAccess: boolean;
  advancedAnalytics: boolean;
  unlimitedSales: boolean;
}

export const PLANS: Record<PlanTier, PlanDefinition> = {
  free: {
    tier: "free",
    name: "Free",
    price: "0",
    trialDays: 0,
    maxBundles: 2,
    salesCapLabel: "Up to $500/mo in bundle sales",
    cssAccess: false,
    advancedAnalytics: false,
    unlimitedSales: false,
  },
  essential: {
    tier: "essential",
    name: "SiGNL Bundle Builder — Essential",
    price: "29",
    trialDays: 7,
    maxBundles: null,
    salesCapLabel: "Up to $5,000/mo in bundle sales",
    cssAccess: false,
    advancedAnalytics: false,
    unlimitedSales: false,
  },
  pro: {
    tier: "pro",
    name: "SiGNL Bundle Builder — Pro",
    price: "49",
    trialDays: 14,
    maxBundles: null,
    salesCapLabel: "Unlimited bundle sales",
    cssAccess: true,
    advancedAnalytics: true,
    unlimitedSales: true,
  },
};

export interface PlanFeatures {
  planTier: PlanTier;
  maxActiveBundles: number | null;
  cssAccess: boolean;
  advancedAnalytics: boolean;
  unlimitedSales: boolean;
}

export type SubscriptionStatus = "active" | "pending" | "declined" | "cancelled" | "expired" | "frozen" | "none";

export interface BillingStatus {
  hasSubscription: boolean;
  status: SubscriptionStatus;
  planTier: PlanTier;
  chargeId?: string | null;
  planName?: string;
  planPrice?: string;
  trialDays?: number;
  activatedAt?: Date | null;
}

export async function getSubscriptionStatus(shop: string): Promise<BillingStatus> {
  try {
    const rows = await db
      .select()
      .from(shopSubscriptions)
      .where(eq(shopSubscriptions.shop, shop))
      .limit(1);

    if (!rows.length) {
      return { hasSubscription: false, status: "none", planTier: "free" };
    }

    const sub = rows[0];
    const active = sub.status === "active";
    const tier = (sub.planTier ?? "free") as PlanTier;
    return {
      hasSubscription: active,
      status: sub.status as SubscriptionStatus,
      planTier: tier,
      chargeId: sub.chargeId,
      planName: sub.planName,
      planPrice: sub.planPrice,
      trialDays: sub.trialDays,
      activatedAt: sub.activatedAt,
    };
  } catch (err) {
    log(`getSubscriptionStatus error: ${err instanceof Error ? err.message : String(err)}`);
    return { hasSubscription: false, status: "none", planTier: "free" };
  }
}

export function getPlanFeatures(tier: PlanTier): PlanFeatures {
  const plan = PLANS[tier];
  return {
    planTier: tier,
    maxActiveBundles: plan.maxBundles,
    cssAccess: plan.cssAccess,
    advancedAnalytics: plan.advancedAnalytics,
    unlimitedSales: plan.unlimitedSales,
  };
}

export async function upsertFreeSubscription(shop: string): Promise<void> {
  const now = new Date();
  const plan = PLANS.free;

  const existing = await db
    .select()
    .from(shopSubscriptions)
    .where(eq(shopSubscriptions.shop, shop))
    .limit(1);

  if (existing.length) {
    if (existing[0].planTier !== "free" && existing[0].status === "active") {
      return;
    }
    await db
      .update(shopSubscriptions)
      .set({
        status: "active",
        planTier: "free",
        planName: plan.name,
        planPrice: plan.price,
        trialDays: plan.trialDays,
        chargeId: null,
        activatedAt: existing[0].activatedAt ?? now,
        updatedAt: now,
      })
      .where(eq(shopSubscriptions.shop, shop));
  } else {
    await db.insert(shopSubscriptions).values({
      shop,
      chargeId: null,
      status: "active",
      planTier: "free",
      planName: plan.name,
      planPrice: plan.price,
      trialDays: plan.trialDays,
      activatedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export async function upsertSubscription(
  shop: string,
  chargeId: string,
  status: string,
  planTier: PlanTier = "essential"
): Promise<void> {
  const now = new Date();
  const activatedAt = status === "active" ? now : null;
  const cancelledAt = (status === "cancelled" || status === "declined" || status === "expired") ? now : null;
  const plan = PLANS[planTier];

  const existing = await db
    .select()
    .from(shopSubscriptions)
    .where(eq(shopSubscriptions.shop, shop))
    .limit(1);

  if (existing.length) {
    await db
      .update(shopSubscriptions)
      .set({
        chargeId,
        status,
        planTier,
        planName: plan.name,
        planPrice: plan.price,
        trialDays: plan.trialDays,
        ...(activatedAt && !existing[0].activatedAt && { activatedAt }),
        ...(cancelledAt && { cancelledAt }),
        updatedAt: now,
      })
      .where(eq(shopSubscriptions.shop, shop));
  } else {
    await db.insert(shopSubscriptions).values({
      shop,
      chargeId,
      status,
      planTier,
      planName: plan.name,
      planPrice: plan.price,
      trialDays: plan.trialDays,
      activatedAt,
      cancelledAt,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export async function createAppSubscription(
  shopifyInstance: NonNullable<import("./shopify").GetShopifyReturn>,
  session: import("@shopify/shopify-api").Session,
  returnUrl: string,
  planTier: PlanTier = "essential"
): Promise<string> {
  const plan = PLANS[planTier];
  const client = new shopifyInstance.clients.Graphql({ session });

  const result = await client.query({
    data: {
      query: `mutation AppSubscriptionCreate($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!, $trialDays: Int, $test: Boolean) {
        appSubscriptionCreate(name: $name, lineItems: $lineItems, returnUrl: $returnUrl, trialDays: $trialDays, test: $test) {
          appSubscription {
            id
            status
          }
          confirmationUrl
          userErrors {
            field
            message
          }
        }
      }`,
      variables: {
        name: plan.name,
        returnUrl,
        trialDays: plan.trialDays,
        test: process.env.NODE_ENV !== "production",
        lineItems: [
          {
            plan: {
              appRecurringPricingDetails: {
                price: { amount: plan.price, currencyCode: "USD" },
                interval: "EVERY_30_DAYS",
              },
            },
          },
        ],
      },
    },
  });

  const body = result.body as unknown as Record<string, unknown>;
  const data = (body.data as Record<string, unknown>)?.appSubscriptionCreate as Record<string, unknown> | undefined;
  const userErrors = data?.userErrors as Array<{ field: string; message: string }> | undefined;

  if (userErrors?.length) {
    throw new Error(userErrors.map((e) => e.message).join(", "));
  }

  const confirmationUrl = data?.confirmationUrl as string | undefined;
  if (!confirmationUrl) {
    throw new Error("No confirmation URL returned from Shopify Billing API");
  }

  const subscription = data?.appSubscription as Record<string, unknown> | undefined;
  const chargeId = subscription?.id as string | undefined;
  const status = (subscription?.status as string | undefined)?.toLowerCase() ?? "pending";

  if (chargeId) {
    await upsertSubscription(session.shop, chargeId, status, planTier);
  }

  return confirmationUrl;
}

export async function verifyAppSubscription(
  shopifyInstance: NonNullable<import("./shopify").GetShopifyReturn>,
  session: import("@shopify/shopify-api").Session,
  chargeId: string,
  planTier: PlanTier = "essential"
): Promise<string> {
  const client = new shopifyInstance.clients.Graphql({ session });

  const result = await client.query({
    data: {
      query: `query AppSubscription($id: ID!) {
        node(id: $id) {
          ... on AppSubscription {
            id
            status
          }
        }
      }`,
      variables: { id: chargeId },
    },
  });

  const body = result.body as unknown as Record<string, unknown>;
  const errors = body.errors as unknown[] | undefined;
  if (errors?.length) {
    throw new Error(`GraphQL errors: ${JSON.stringify(errors)}`);
  }

  const node = (body.data as Record<string, unknown>)?.node as Record<string, unknown> | null | undefined;
  if (!node || !node.status) {
    throw new Error(`Subscription ${chargeId} not found or is not an AppSubscription`);
  }

  const status = (node.status as string).toLowerCase();
  await upsertSubscription(session.shop, chargeId, status, planTier);
  return status;
}

export async function checkSubscriptionLive(
  shopifyInstance: NonNullable<import("./shopify").GetShopifyReturn>,
  session: import("@shopify/shopify-api").Session
): Promise<boolean> {
  const client = new shopifyInstance.clients.Graphql({ session });

  const result = await client.query({
    data: {
      query: `query {
        currentAppInstallation {
          activeSubscriptions {
            id
            status
            name
          }
        }
      }`,
    },
  });

  const body = result.body as unknown as Record<string, unknown>;
  const installation = (body.data as Record<string, unknown>)?.currentAppInstallation as Record<string, unknown> | undefined;
  const subs = installation?.activeSubscriptions as Array<Record<string, unknown>> | undefined;

  if (!subs?.length) {
    return false;
  }

  const active = subs.find((s) => (s.status as string)?.toLowerCase() === "active");
  if (active) {
    const chargeId = active.id as string;
    const subName = (active.name as string) ?? "";
    let tier: PlanTier = "essential";
    if (subName.toLowerCase().includes("pro")) tier = "pro";
    else if (subName.toLowerCase().includes("essential")) tier = "essential";
    await upsertSubscription(session.shop, chargeId, "active", tier);
    return true;
  }

  return false;
}
