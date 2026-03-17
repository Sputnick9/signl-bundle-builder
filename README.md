# Shopify Bundle Builder App

A full Shopify embedded app that lets merchants create product bundles with progressive volume discounts. Merchants install it via OAuth, configure bundles in the Polaris admin UI, and customers experience the bundle builder on the storefront.

---

## Quick Start (Development)

```bash
npm install
npm run db:push   # Create database tables
npm run dev       # Start Express + Vite on port 5000
```

Visit `http://localhost:5000` — the Polaris admin UI loads with a setup banner until you connect a Shopify Partner app.

---

## Shopify Partner Setup

### 1. Create the App in Partner Dashboard

1. Go to [partners.shopify.com](https://partners.shopify.com) → **Apps** → **Create app**
2. Choose **Custom app** or **Public app**
3. Set the following fields:

| Field | Value |
|-------|-------|
| **App URL** | `https://yourapp.yourusername.replit.app` |
| **Allowed redirection URL** | `https://yourapp.yourusername.replit.app/auth/callback` |

4. Copy your **Client ID** and **Client Secret**

### 2. Set Environment Variables (Replit Secrets)

| Secret | Value |
|--------|-------|
| `SHOPIFY_API_KEY` | Client ID from Partner Dashboard |
| `SHOPIFY_API_SECRET` | Client Secret from Partner Dashboard (keep private) |
| `SHOPIFY_APP_URL` | Your app's full HTTPS URL, no trailing slash |
| `VITE_SHOPIFY_API_KEY` | Same value as `SHOPIFY_API_KEY` (exposed to browser for App Bridge) |
| `SCOPES` | Optional — defaults to `read_products,write_products,read_orders,write_discounts,read_draft_orders,write_draft_orders` |

### 3. Install the App on a Development Store

Navigate to:

```
https://yourapp.yourusername.replit.app/auth?shop=yourdevstore.myshopify.com
```

This starts the OAuth flow. After approval, you'll be redirected back to the embedded admin.

---

## API Endpoints

### Auth & OAuth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/auth?shop=store.myshopify.com` | Start OAuth install flow |
| `GET` | `/auth/callback` | OAuth callback (handled automatically) |
| `GET` | `/api/auth/status?shop=store.myshopify.com` | Check if app is configured and authenticated |

### Bundles (require Shopify session token in `Authorization: Bearer <token>` when Shopify is configured)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/bundles?shop=store.myshopify.com` | List all bundles for a shop |
| `GET` | `/api/bundles/:id` | Get a bundle with its products |
| `POST` | `/api/bundles` | Create a new bundle |
| `PUT` | `/api/bundles/:id` | Update a bundle |
| `DELETE` | `/api/bundles/:id` | Delete a bundle |

### GDPR Webhooks (HMAC verified)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/webhooks/customers/data_request` | Customer data request |
| `POST` | `/api/webhooks/customers/redact` | Customer data redact |
| `POST` | `/api/webhooks/shop/redact` | Shop data redact |

---

## Architecture

```
client/
  src/
    components/
      admin-layout.tsx          Polaris Frame + sidebar navigation
    pages/
      admin-home.tsx            Dashboard with stats and roadmap
      admin-bundles.tsx         Bundle list (IndexTable)
      admin-bundle-form.tsx     Create/edit bundle form
      bundle-builder.tsx        Storefront preview UI
    lib/
      queryClient.ts            TanStack Query + App Bridge session token fetch

server/
  shopify.ts                    Shopify API SDK config + session storage + webhook registration
  routes.ts                     Express routes: OAuth, bundle CRUD, GDPR webhooks
  bundle-db.ts                  Drizzle ORM bundle CRUD operations
  db.ts                         PostgreSQL connection

shared/
  schema.ts                     Drizzle ORM tables + Zod schemas (shopify_sessions, bundles, bundle_products)
```

---

## Database Tables

| Table | Description |
|-------|-------------|
| `shopify_sessions` | OAuth session storage (shop, access token, scope, expiry) |
| `bundles` | Bundle campaigns (name, discount type, tiers, status, shop) |
| `bundle_products` | Products linked to bundles (product ID, title, image, qty limits) |

---

## Build Roadmap

- [x] **Task 1** — App Foundation & OAuth (Shopify SDK, session storage, GDPR webhooks)
- [x] **Task 2** — Bundle Admin UI (Polaris layout, CRUD, form with discount tiers)
- [ ] **Task 3** — Theme App Extension (storefront liquid section)
- [ ] **Task 4** — Shopify Functions (real checkout discounts)
- [ ] **Task 5** — Billing & Subscriptions (Shopify Billing API)

---

## Shopify Dawn Theme Section (Legacy)

The `sections/bundle-builder.liquid`, `assets/bundle-builder.css`, and `assets/bundle-builder.js` files are a standalone Dawn 15.2.0 theme section that can be used without the full app. See the [GitHub repo](https://github.com/Sputnick9/shopify-bundle-builder) for installation instructions.
