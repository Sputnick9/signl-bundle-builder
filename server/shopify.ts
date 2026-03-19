import "@shopify/shopify-api/adapters/node";
import { shopifyApi, ApiVersion, Session, DeliveryMethod } from "@shopify/shopify-api";
import { db } from "./db";
import { shopifySessions } from "@shared/schema";
import { eq } from "drizzle-orm";

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || "";
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || "";
const SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL || "";
const SCOPES = (
  process.env.SCOPES ||
  "read_products,write_products,read_orders,write_discounts,read_draft_orders,write_draft_orders"
).split(",");

export const shopifyConfigured =
  !!SHOPIFY_API_KEY && !!SHOPIFY_API_SECRET && !!SHOPIFY_APP_URL;

function getHostName(): string {
  if (!SHOPIFY_APP_URL) return "localhost";
  return SHOPIFY_APP_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function getAppUrl(): string {
  return SHOPIFY_APP_URL || "http://localhost:5000";
}

export const sessionStorage = {
  async storeSession(session: Session): Promise<boolean> {
    try {
      const row = {
        id: session.id,
        shop: session.shop,
        state: session.state || null,
        isOnline: session.isOnline,
        scope: session.scope || null,
        expires: session.expires ? new Date(session.expires) : null,
        accessToken: session.accessToken || null,
      };
      await db
        .insert(shopifySessions)
        .values(row)
        .onConflictDoUpdate({ target: shopifySessions.id, set: row });
      return true;
    } catch (err) {
      console.error("storeSession error:", err);
      return false;
    }
  },

  async loadSession(id: string): Promise<Session | undefined> {
    try {
      const rows = await db
        .select()
        .from(shopifySessions)
        .where(eq(shopifySessions.id, id));
      if (!rows.length) return undefined;
      const r = rows[0];
      const session = new Session({
        id: r.id,
        shop: r.shop,
        state: r.state || "",
        isOnline: r.isOnline,
      });
      session.scope = r.scope || undefined;
      session.expires = r.expires ? r.expires : undefined;
      session.accessToken = r.accessToken || undefined;
      return session;
    } catch (err) {
      console.error("loadSession error:", err);
      return undefined;
    }
  },

  async deleteSession(id: string): Promise<boolean> {
    try {
      await db.delete(shopifySessions).where(eq(shopifySessions.id, id));
      return true;
    } catch (err) {
      console.error("deleteSession error:", err);
      return false;
    }
  },

  async deleteSessions(ids: string[]): Promise<boolean> {
    try {
      for (const id of ids) {
        await db.delete(shopifySessions).where(eq(shopifySessions.id, id));
      }
      return true;
    } catch (err) {
      console.error("deleteSessions error:", err);
      return false;
    }
  },

  async findSessionsByShop(shop: string): Promise<Session[]> {
    try {
      const rows = await db
        .select()
        .from(shopifySessions)
        .where(eq(shopifySessions.shop, shop));
      return rows.map((r) => {
        const session = new Session({
          id: r.id,
          shop: r.shop,
          state: r.state || "",
          isOnline: r.isOnline,
        });
        session.scope = r.scope || undefined;
        session.expires = r.expires ? r.expires : undefined;
        session.accessToken = r.accessToken || undefined;
        return session;
      });
    } catch (err) {
      console.error("findSessionsByShop error:", err);
      return [];
    }
  },
};

let _shopify: ReturnType<typeof shopifyApi> | null = null;

export function getShopify() {
  if (!shopifyConfigured) return null;
  if (_shopify) return _shopify;
  _shopify = shopifyApi({
    apiKey: SHOPIFY_API_KEY,
    apiSecretKey: SHOPIFY_API_SECRET,
    scopes: SCOPES,
    hostName: getHostName(),
    apiVersion: ApiVersion.October24,
    isEmbeddedApp: true,
    sessionStorage,
  });

  _shopify.webhooks.addHandlers({
    CUSTOMERS_DATA_REQUEST: [
      {
        deliveryMethod: DeliveryMethod.Http,
        callbackUrl: `${getAppUrl()}/api/webhooks/customers/data_request`,
      },
    ],
    CUSTOMERS_REDACT: [
      {
        deliveryMethod: DeliveryMethod.Http,
        callbackUrl: `${getAppUrl()}/api/webhooks/customers/redact`,
      },
    ],
    SHOP_REDACT: [
      {
        deliveryMethod: DeliveryMethod.Http,
        callbackUrl: `${getAppUrl()}/api/webhooks/shop/redact`,
      },
    ],
    ORDERS_PAID: [
      {
        deliveryMethod: DeliveryMethod.Http,
        callbackUrl: `${getAppUrl()}/api/webhooks/orders/paid`,
      },
    ],
  });

  return _shopify;
}

export { getAppUrl };

export type GetShopifyReturn = ReturnType<typeof shopifyApi>;
