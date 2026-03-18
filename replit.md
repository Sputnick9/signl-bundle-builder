# Shopify Bundle Builder App

## Overview
A full Shopify embedded app that allows merchants to create and manage product bundles with progressive volume discounts. This app will eventually be listed on the Shopify App Store, similar to Wolfpack Product Bundles.

## Architecture
- **Frontend**: React + TypeScript, Tailwind CSS, shadcn/ui, Shopify Polaris, App Bridge React
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL via Drizzle ORM (sessions + bundle data)
- **Shopify SDK**: `@shopify/shopify-api` v13 (OAuth, webhooks, session management)
- **Routing**: wouter for client-side routing

## Project Status (Build Roadmap)
1. **Task 1 — App Foundation & OAuth** ✅ COMPLETE
   - Shopify OAuth install flow (`/auth`, `/auth/callback`)
   - PostgreSQL session storage with Drizzle ORM
   - Polaris + App Bridge embedded admin shell
   - GDPR webhook endpoints
2. **Task 2 — Bundle Admin UI** ✅ COMPLETE
   - Slot-based bundle model (bundles → bundle_slots → bundle_slot_products)
   - Full CRUD REST API with shop-scoped tenant isolation
   - 3-step Polaris wizard: Details → Slots → Discount Tiers
   - Shopify ResourcePicker integration + manual product entry fallback
   - App Bridge nav menu (`<ui-nav-menu>`) for embedded sidebar navigation
3. **Task 3 — Theme App Extension** ✅ COMPLETE
   - `extensions/bundle-picker/` directory with `shopify.extension.toml`
   - `blocks/bundle-picker.liquid` — Shopify OS 2.0 App Block (target: section)
   - `assets/bundle-picker.js` — slot-based picker (fetches API, variant picker modal, AJAX cart); adds `_bundleId`/`_discountTiers`/`_discountType` cart line properties for Function
   - `assets/bundle-picker.css` — scoped BEM-style CSS matching `#2A9D8F` brand
   - `GET /api/storefront/bundles` — public CORS endpoint with server-side variant enrichment (5-min cache); no open Admin API proxy
   - `getBundlesForProduct()` in `server/bundle-db.ts` — DB query using JOIN across slots
4. **Task 4 — Shopify Functions (Real Discounts)** ✅ COMPLETE
   - `extensions/bundle-discount/` — Shopify Function extension (type: `product_discounts`)
   - `shopify.extension.toml` — Shopify CLI 3.x manifest (api_version 2024-04)
   - `input.graphql` — queries cart lines + all attributes
   - `src/run.js` — pure JS function: groups lines by `_bundleId`, selects best discount tier by total qty, returns `productVariant` targets with percentage/fixed discount; standalone items unaffected
   - `esbuild.config.mjs` + `package.json` — build toolchain (esbuild bundle → javy WASM compile)
   - `server/routes.ts`: `ensureAutomaticDiscount()` helper registers one automatic discount per shop via `discountAutomaticAppCreate` GraphQL mutation (idempotent — checks first)
   - `GET/POST/DELETE /api/shop/discount` — manage discount registration per shop
   - Auto-registers discount in OAuth callback when `SHOPIFY_FUNCTION_ID` env var is set
   - Admin home: `DiscountFunctionCard` shows active/inactive status; Register/Deactivate buttons; "How it works" explainer
5. **Task 5 — Billing & Subscriptions** ✅ COMPLETE
   - `server/billing.ts` — Shopify Billing API: `createAppSubscription()`, `verifyAppSubscription()`, `getSubscriptionStatus()`, `upsertSubscription()`
   - `shared/schema.ts`: `shop_subscriptions` table (shop, chargeId, status, trialDays, planName, planPrice, activatedAt, cancelledAt)
   - `GET /api/billing/status` — returns hasSubscription, status, plan details (shopifyAuth middleware)
   - `POST /api/billing/subscribe` — calls `appSubscriptionCreate` GQL mutation; returns confirmationUrl for redirect
   - `GET /billing/return` — Shopify redirect-back URL; verifies charge via `node` GQL query; redirects with status param
   - OAuth callback now checks subscription status and redirects new installs to `/billing` if no active subscription
   - `client/src/pages/billing.tsx` — Polaris pricing page: plan card ($19.99/month, 7-day trial), feature list, FAQ, subscription confirmation states
   - `client/src/pages/admin-home.tsx` — `BillingCard` component shows subscription status badge + subscribe/manage CTA

## Database Schema

### `shopify_sessions`
Stores Shopify OAuth sessions (required by `@shopify/shopify-api`).

### `bundles`
Top-level bundle record per shop.
| Column | Type | Description |
|---|---|---|
| id | serial PK | |
| shop | text | myshopify domain (tenant key) |
| name | text | Bundle display name |
| description | text | Optional description |
| discountType | text | `percentage` or `fixed` |
| discountTiers | jsonb | Array of `{ minQty, discountValue }` tier rules |
| status | text | `draft`, `active`, or `archived` |
| createdAt / updatedAt | timestamp | |

### `bundle_slots`
Each slot = one product group customers choose from (e.g. "Choose a T-Shirt").
| Column | Type | Description |
|---|---|---|
| id | serial PK | |
| bundleId | integer FK → bundles.id | |
| name | text | Slot label (shown to customer) |
| position | integer | Display order |
| minQty | integer | Min items customer must pick |
| maxQty | integer | Max items (null = unlimited) |

### `bundle_slot_products`
Individual product/variant options within a slot.
| Column | Type | Description |
|---|---|---|
| id | serial PK | |
| slotId | integer FK → bundle_slots.id | |
| shopifyProductId | text | Shopify GID (e.g. `gid://shopify/Product/123`) |
| shopifyVariantId | text | Shopify variant GID (null = any variant) |
| productTitle | text | Display name |
| variantTitle | text | Variant label (optional) |
| productImage | text | Image URL (optional) |

### `shop_subscriptions`
Tracks Shopify Billing API subscription status per shop.
| Column | Type | Description |
|---|---|---|
| id | serial PK | |
| shop | text UNIQUE | myshopify domain |
| chargeId | text | Shopify subscription GID (`gid://shopify/AppSubscription/...`) |
| status | text | `pending`, `active`, `declined`, `cancelled`, `expired`, `frozen` |
| trialDays | integer | Free trial days (default: 7) |
| planName | text | Plan display name |
| planPrice | text | Monthly price string (default: `19.99`) |
| activatedAt | timestamp | When subscription became active |
| cancelledAt | timestamp | When subscription was cancelled |

## Required Environment Variables
Set these in Replit Secrets before enabling Shopify OAuth:
- `SHOPIFY_API_KEY` — from your Shopify Partner Dashboard
- `SHOPIFY_API_SECRET` — from your Shopify Partner Dashboard (secret)
- `SHOPIFY_APP_URL` — your app's public HTTPS URL (e.g., `https://yourrepl.yourusername.replit.app`)
- `VITE_SHOPIFY_API_KEY` — same value as SHOPIFY_API_KEY (exposed to browser for App Bridge)
- `SCOPES` — OAuth scopes (default: `read_products,write_products,read_orders,write_discounts,read_draft_orders,write_draft_orders`)

## API Endpoints

### Bundle CRUD (authenticated with Shopify session token)
- `GET /api/bundles` — List all bundles for the authenticated shop
- `GET /api/bundles/:id` — Get bundle with slots and slot products
- `POST /api/bundles` — Create bundle (body: `{ name, discountType, discountTiers, status, slots[] }`)
- `PUT /api/bundles/:id` — Update bundle + replace all slots atomically (DB transaction)
- `DELETE /api/bundles/:id` — Delete bundle (cascades slots + slot products)

### Storefront (public, CORS-enabled, no auth)
- `GET /api/storefront/bundles?shop=xxx&productId=gid://shopify/Product/yyy` — Active bundles for a product (used by Theme Extension JS)
- `GET /api/storefront/product-variants?shop=xxx&productId=gid://shopify/Product/yyy` — Product variants via Shopify Admin API proxy (for variant selection UI)

### OAuth & Webhooks
- `GET /auth?shop=store.myshopify.com` — Start Shopify OAuth
- `GET /auth/callback` — Shopify OAuth callback
- `GET /api/auth/status` — Check if Shopify is configured + authenticated
- `POST /api/webhooks/customers/data_request` — GDPR data request webhook
- `POST /api/webhooks/customers/redact` — GDPR customer redact webhook
- `POST /api/webhooks/shop/redact` — GDPR shop redact webhook

## Key File Structure
```
shared/schema.ts                    - Drizzle schema: shopify_sessions, bundles, bundle_slots, bundle_slot_products
server/db.ts                        - PostgreSQL + Drizzle ORM connection
server/shopify.ts                   - Shopify API SDK config + session storage
server/bundle-db.ts                 - Bundle CRUD with transactional slot/product writes
server/routes.ts                    - Express routes: OAuth, webhooks, bundle API
server/index.ts                     - Express server + CSP headers
client/src/App.tsx                  - wouter Router: admin pages
client/src/pages/
  admin-home.tsx                    - Polaris dashboard home
  admin-bundles.tsx                 - Bundle list + delete table
  admin-bundle-form.tsx             - 3-step create/edit wizard
client/src/components/
  admin-layout.tsx                  - Polaris AppProvider + Frame shell
client/index.html                   - App Bridge ui-nav-menu (Dashboard + Bundles links)
extensions/bundle-picker/
  shopify.extension.toml            - Shopify CLI 3.x extension manifest
  blocks/bundle-picker.liquid       - OS 2.0 App Block (schema + data attributes)
  assets/bundle-picker.js           - Slot-based bundle picker (vanilla JS IIFE)
  assets/bundle-picker.css          - Scoped BEM styles for storefront picker
```

## Shopify Partner Setup (One-Time)
1. Go to https://partners.shopify.com
2. Create a new app (Custom App)
3. Set App URL to `SHOPIFY_APP_URL`
4. Set Allowed Redirection URLs to `SHOPIFY_APP_URL/auth/callback`
5. Copy the Client ID → `SHOPIFY_API_KEY` and `VITE_SHOPIFY_API_KEY`
6. Copy the Client Secret → `SHOPIFY_API_SECRET`
7. Restart the workflow

## Theme
- Admin: Shopify Polaris design system (matches Shopify Admin)
- Storefront: Custom teal (#2A9D8F) branding with BEM CSS
- Font: Plus Jakarta Sans
