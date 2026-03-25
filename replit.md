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
3. **Task 3 — Theme App Extension** ✅ COMPLETE
   - `extensions/bundle-picker/` directory with `shopify.extension.toml`
   - `blocks/bundle-picker.liquid` — Shopify OS 2.0 App Block (target: section)
   - `assets/bundle-picker.js` — slot-based picker (fetches API, variant picker modal, AJAX cart)
   - `assets/bundle-picker.css` — scoped BEM-style CSS matching `#2A9D8F` brand
   - `GET /api/storefront/bundles` — public CORS endpoint with server-side variant enrichment
4. **Task 4 — Shopify Functions (Real Discounts)** ✅ COMPLETE
   - `extensions/bundle-discount/` — Shopify Function extension (type: `product_discounts`)
   - `GET/POST/DELETE /api/shop/discount` — manage discount registration per shop
   - Auto-registers discount in OAuth callback when `SHOPIFY_FUNCTION_ID` env var is set
5. **Task 5 — Billing & Subscriptions** ✅ COMPLETE (superseded by Task 11)
   - `server/billing.ts` — Shopify Billing API integration
   - `GET /api/billing/status`, `POST /api/billing/subscribe`, `GET /billing/return`
   - `client/src/pages/billing.tsx` — 3-tier pricing comparison table
6. **Task 6 — Navigation & App Shell Revamp** ✅ COMPLETE
   - `client/src/components/admin-layout.tsx` — Polaris Frame + Navigation with 5 items: Bundles, Analytics, Settings, Pricing, Support (Dashboard removed)
   - `NavMenu` from `@shopify/app-bridge-react` registers nav in Shopify Admin sidebar
   - `/` now redirects to `/admin/bundles` (no more Dashboard route)
   - `client/src/pages/admin-bundles.tsx` — Rebuilt as the app hub: stat cards (Total/Active Bundles), Create/Preview buttons, bundle list, Discount Function card, collapsible How-to Guide, collapsible FAQ
   - `client/src/pages/analytics-stub.tsx` — Analytics page (coming soon stub) at `/analytics`
   - `client/src/pages/settings-stub.tsx` — Settings page (coming soon stub) at `/settings`
   - `client/src/pages/support.tsx` — Support page at `/support` with contact info, resources, FAQ
11. **Task 11 — Three-Tier Pricing (Free / Essential / Pro)** ✅ COMPLETE
    - `PLANS` constant in `server/billing.ts` defines Free ($0, 2 bundles), Essential ($29, 7-day trial), Pro ($49, 14-day trial)
    - `planTier` column added to `shop_subscriptions` schema
    - New installs are auto-enrolled in Free tier (no billing redirect required)
    - `GET /api/billing/features` — returns planTier + feature flags per shop
    - `POST /api/billing/subscribe?plan=essential|pro` — creates the correct Shopify subscription
    - `requireBilling` middleware updated: Free tier ("active" DB row, no chargeId) passes the DB check
    - `client/src/pages/billing.tsx` — Full rewrite: 3-column InlineGrid pricing table with feature checklists, Pro "Most Popular" highlight, per-plan CTA buttons

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
Each slot = one collection tab customers browse in the bundle builder (e.g. "T-Shirts", "Pants").
| Column | Type | Description |
|---|---|---|
| id | serial PK | |
| bundleId | integer FK → bundles.id | |
| name | text | Slot/tab label (shown to customer) |
| imageUrl | text | Optional tab icon image URL |
| shopifyCollectionId | text | Shopify Collection GID (linked collection, optional) |
| shopifyCollectionTitle | text | Linked collection title for display (optional) |
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
Tracks Shopify Billing API subscription status per shop (updated for 3-tier pricing in Task 11).
| Column | Type | Description |
|---|---|---|
| id | serial PK | |
| shop | text UNIQUE | myshopify domain |
| chargeId | text | Shopify subscription GID (null for Free tier) |
| status | text | `active`, `pending`, `declined`, `cancelled`, `expired`, `frozen` |
| planTier | text | `free`, `essential`, or `pro` (default: `free`) |
| trialDays | integer | Free trial days (0 for Free, 7 for Essential, 14 for Pro) |
| planName | text | Plan display name |
| planPrice | text | Monthly price string (`0`, `29`, or `49`) |
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
- `GET /api/shopify/collection-products?collectionId=gid://shopify/Collection/123` — Fetch products from a Shopify collection via Admin API (used by collection slot import)

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
shared/schema.ts                    - Drizzle schema: all tables + types
server/db.ts                        - PostgreSQL + Drizzle ORM connection
server/migrate.ts                   - Auto-migration: CREATE TABLE IF NOT EXISTS for all tables
server/shopify.ts                   - Shopify API SDK config + session storage
server/bundle-db.ts                 - Bundle CRUD with transactional slot/product writes
server/routes.ts                    - Express routes: OAuth, webhooks, bundle API
server/index.ts                     - Express server + CSP headers
client/src/App.tsx                  - wouter Router: admin pages
client/src/pages/
  admin-bundles.tsx                 - Bundles hub: stats, create/preview, list, how-to, FAQ
  admin-bundle-form.tsx             - 3-step create/edit wizard
  discount-templates.tsx            - Discount Templates CRUD page (Task 16)
  setup-guide.tsx                   - Theme Bundle Builder setup guide (Task 16)
  analytics.tsx                     - Analytics page
  settings-stub.tsx                 - Settings page
  support.tsx                       - Support page with contact, resources, FAQ
  billing.tsx                       - Subscription pricing page
client/src/components/
  admin-layout.tsx                  - Polaris Frame shell + NavMenu (7 nav items)
extensions/bundle-picker/
  shopify.extension.toml            - Shopify CLI 3.x extension manifest
  blocks/bundle-picker.liquid       - OS 2.0 App Block (target: section)
  sections/bundle-builder.liquid    - NEW: theme-editor-native section with category blocks (Task 16)
  assets/bundle-picker.js           - Original: slot-based bundle picker (fetches app API)
  assets/bundle-builder.js          - NEW: theme-native bundle builder (reads DOM + public Shopify API) (Task 16)
  assets/bundle-picker.css          - Scoped BEM styles (shared by both JS scripts)
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
