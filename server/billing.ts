import { db } from "./db";
import { shopSubscriptions } from "@shared/schema";
import { eq } from "drizzle-orm";
function log(msg: string) {
  console.log(`[billing] ${msg}`);
}

export const PLAN_NAME = "SiGNL Bundle Builder — Standard";
export const PLAN_PRICE = "19.99";
export const TRIAL_DAYS = 7;

export type SubscriptionStatus = "active" | "pending" | "declined" | "cancelled" | "expired" | "frozen" | "none";

export interface BillingStatus {
  hasSubscription: boolean;
  status: SubscriptionStatus;
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
      return { hasSubscription: false, status: "none" };
    }

    const sub = rows[0];
    const active = sub.status === "active" || sub.status === "pending";
    return {
      hasSubscription: active,
      status: sub.status as SubscriptionStatus,
      chargeId: sub.chargeId,
      planName: sub.planName,
      planPrice: sub.planPrice,
      trialDays: sub.trialDays,
      activatedAt: sub.activatedAt,
    };
  } catch (err) {
    log(`getSubscriptionStatus error: ${err instanceof Error ? err.message : String(err)}`);
    return { hasSubscription: false, status: "none" };
  }
}

export async function upsertSubscription(
  shop: string,
  chargeId: string,
  status: string
): Promise<void> {
  const now = new Date();
  const activatedAt = status === "active" ? now : null;
  const cancelledAt = status === "cancelled" ? now : null;

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
        ...(activatedAt && { activatedAt }),
        ...(cancelledAt && { cancelledAt }),
        updatedAt: now,
      })
      .where(eq(shopSubscriptions.shop, shop));
  } else {
    await db.insert(shopSubscriptions).values({
      shop,
      chargeId,
      status,
      trialDays: TRIAL_DAYS,
      planName: PLAN_NAME,
      planPrice: PLAN_PRICE,
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
  returnUrl: string
): Promise<string> {
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
        name: PLAN_NAME,
        returnUrl,
        trialDays: TRIAL_DAYS,
        test: process.env.NODE_ENV !== "production",
        lineItems: [
          {
            plan: {
              appRecurringPricingDetails: {
                price: { amount: PLAN_PRICE, currencyCode: "USD" },
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
    await upsertSubscription(session.shop, chargeId, status);
  }

  return confirmationUrl;
}

export async function verifyAppSubscription(
  shopifyInstance: NonNullable<import("./shopify").GetShopifyReturn>,
  session: import("@shopify/shopify-api").Session,
  chargeId: string
): Promise<string> {
  const client = new shopifyInstance.clients.Graphql({ session });

  const result = await client.query({
    data: {
      query: `query AppSubscription($id: ID!) {
        node(id: $id) {
          ... on AppSubscription {
            id
            status
            name
            createdAt
            currentPeriodEnd
          }
        }
      }`,
      variables: { id: chargeId },
    },
  });

  const body = result.body as unknown as Record<string, unknown>;
  const node = (body.data as Record<string, unknown>)?.node as Record<string, unknown> | undefined;
  const status = ((node?.status as string | undefined) ?? "pending").toLowerCase();

  await upsertSubscription(session.shop, chargeId, status);
  return status;
}
