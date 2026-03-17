# Shopify Bundle Builder App

## Overview
A full Shopify embedded app that allows merchants to create and manage product bundles with progressive volume discounts. This app will eventually be listed on the Shopify App Store, similar to Wolfpack Product Bundles.

## Architecture
- **Frontend**: React + TypeScript, Tailwind CSS, shadcn/ui, Shopify Polaris, App Bridge React
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL via Drizzle ORM (Shopify session storage)
- **Shopify SDK**: `@shopify/shopify-api` v13 (OAuth, webhooks, session management)
- **Routing**: wouter for client-side routing

## Project Status (Build Roadmap)
1. **Task 1 — App Foundation & OAuth** ✅ COMPLETE
   - Shopify OAuth install flow (`/auth`, `/auth/callback`)
   - PostgreSQL session storage with Drizzle ORM
   - Polaris + App Bridge embedded admin shell
   - GDPR webhook endpoints
2. **Task 2 — Bundle Admin UI** ⏳ Pending
3. **Task 3 — Theme App Extension** ⏳ Pending
4. **Task 4 — Shopify Functions (Real Discounts)** ⏳ Pending
5. **Task 5 — Billing & Subscriptions** ⏳ Pending

## Required Environment Variables
Set these in Replit Secrets before enabling Shopify OAuth:
- `SHOPIFY_API_KEY` — from your Shopify Partner Dashboard
- `SHOPIFY_API_SECRET` — from your Shopify Partner Dashboard (secret)
- `SHOPIFY_APP_URL` — your app's public HTTPS URL (e.g., `https://yourrepl.yourusername.replit.app`)
- `VITE_SHOPIFY_API_KEY` — same value as SHOPIFY_API_KEY (exposed to browser for App Bridge)
- `SCOPES` — OAuth scopes (default: `read_products,write_products,read_orders,write_discounts,read_draft_orders,write_draft_orders`)

## File Structure
```
shared/schema.ts                    - Drizzle ORM schema (shopify_sessions table) + TypeScript types
server/db.ts                        - PostgreSQL + Drizzle ORM connection
server/shopify.ts                   - Shopify API SDK config + session storage implementation
server/storage.ts                   - In-memory mock data (legacy bundle builder preview)
server/routes.ts                    - API + OAuth routes (/auth, /auth/callback, webhooks)
server/index.ts                     - Express server + CSP headers for Shopify admin embedding
client/src/App.tsx                  - Router: / → AdminHome, /bundle-preview → BundleBuilder
client/src/pages/
  admin-home.tsx                    - Polaris-based embedded admin home page
  bundle-builder.tsx                - Legacy bundle builder preview UI (for testing)
assets/bundle-builder.css           - Shopify Dawn theme CSS (for Theme App Extension later)
assets/bundle-builder.js            - Shopify Dawn theme JS (for Theme App Extension later)
sections/bundle-builder.liquid      - Shopify Dawn Liquid section (for Theme App Extension later)
```

## API Endpoints
- `GET /auth?shop=store.myshopify.com` — Start Shopify OAuth
- `GET /auth/callback` — Shopify OAuth callback
- `GET /api/auth/status` — Check if Shopify is configured + authenticated
- `POST /api/webhooks` — Generic webhook handler (HMAC verified)
- `POST /api/webhooks/customers/data_request` — GDPR data request webhook
- `POST /api/webhooks/customers/redact` — GDPR customer redact webhook
- `POST /api/webhooks/shop/redact` — GDPR shop redact webhook
- `GET /api/products` — Mock products (legacy)
- `GET /api/categories` — Mock categories (legacy)
- `GET /api/discount-tiers` — Mock discount tiers (legacy)
- `POST /api/cart/bundle` — Mock cart bundle (legacy)

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
