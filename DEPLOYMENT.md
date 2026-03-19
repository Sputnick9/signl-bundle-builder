# SiGNL Bundle Builder — Shopify CLI Deployment Guide

This guide walks you through deploying the **Theme App Extension** (the bundle picker blocks that appear in your store's theme editor) and the **Shopify Function** (the checkout discount engine) to Shopify.

> **Why is this needed?** The app admin UI runs from the Replit server and Shopify just iframes it — that part works without any deployment step. But the theme extension blocks and the Shopify Function must be pushed to Shopify's own infrastructure via the CLI before they are visible inside any store.

---

## Prerequisites

Before you start, make sure you have:

- **Node.js 18 or later** — check with `node --version`
- A **Shopify Partner account** at [partners.shopify.com](https://partners.shopify.com)
- The **SiGNL Bundle Builder app already created** in your Partner Dashboard (you'll need the Client ID / API key)
- Git installed — to clone this repository

---

## Step 1 — Install Shopify CLI

Install the Shopify CLI and the app package globally:

```bash
npm install -g @shopify/cli @shopify/app
```

Verify the install:

```bash
shopify version
```

You should see a version number (3.x or later).

---

## Step 2 — Clone this repository locally

```bash
git clone https://github.com/Sputnick9/signl-bundle-builder.git
cd signl-bundle-builder
```

---

## Step 3 — Install project dependencies

```bash
npm install
```

---

## Step 4 — Fill in your app credentials in `shopify.app.toml`

Open `shopify.app.toml` in any text editor and replace the two placeholder values:

| Placeholder | Replace with |
|-------------|-------------|
| `YOUR_SHOPIFY_API_KEY` | Your API key (Client ID) from the Partner Dashboard → Apps → SiGNL Bundle Builder → App setup |
| `YOUR_SHOPIFY_APP_URL` | Your public Replit app URL, e.g. `https://signl-bundle-builder.replit.app` |

The `redirect_urls` section also contains the same `YOUR_SHOPIFY_APP_URL` placeholder — replace those too.

---

## Step 5 — Link the project to your Partner Dashboard app

Run the following command and follow the interactive prompts:

```bash
shopify app link
```

The CLI will ask you to:
1. Log in to your Shopify Partner account (opens a browser)
2. Choose the **SiGNL Bundle Builder** app from your Partner Dashboard

After linking, the CLI may update `client_id` in `shopify.app.toml` automatically — that's expected.

---

## Step 6 — Deploy to Shopify

```bash
shopify app deploy
```

This command does three things:
1. Pushes the **Theme App Extension** (`extensions/bundle-picker/`) to Shopify's CDN — the two blocks (`Bundle Picker` for product pages and `SiGNL Bundle Builder` for any page) become available in the theme editor.
2. Compiles and deploys the **Shopify Function** (`extensions/bundle-discount/`) — the checkout discount engine activates and applies bundle discounts at checkout.
3. Registers any unregistered webhooks for stores that have installed your app.

The deploy command will show you a confirmation prompt listing what will be deployed. Type `yes` to confirm.

---

## Step 7 — Enable the blocks in your store's theme

After deployment, the blocks are available but not yet added to any theme. To use them:

1. Go to your **Shopify Admin → Online Store → Themes**
2. Click **Customize** on your active theme
3. Navigate to the page where you want the bundle picker to appear (a product page or any page)
4. Click **Add section** (or **Add block** depending on your theme)
5. Under the **Apps** tab, you'll find:
   - **Bundle Picker** — for product pages (auto-detects which bundles apply to the current product)
   - **SiGNL Bundle Builder** — for any page (you specify a Bundle ID from your app)
6. Configure the block settings — paste your app URL and (for the page section) the Bundle ID
7. Save the theme

---

## Step 8 — Verify the discount function is active

1. In your Shopify Admin, go to **Discounts**
2. You should see an automatic discount created by the **SiGNL Bundle Discount** function
3. If not, you may need to create a new automatic discount and select the **SiGNL Bundle Discount** function from the discount type dropdown

---

## Re-deploying after changes

Any time you update the extension code (Liquid templates, the Function's JS logic, or CSS), run:

```bash
shopify app deploy
```

Changes go live immediately for all stores with your app installed.

---

## Troubleshooting

**"Command not found: shopify"** — Run `npm install -g @shopify/cli @shopify/app` again, then restart your terminal.

**"No app found" during `shopify app link`** — Make sure you're logged into the correct Shopify Partner account that owns the SiGNL Bundle Builder app.

**Blocks don't appear in theme editor** — Confirm the deploy completed without errors. Some themes require you to look under "Apps" within the section/block picker rather than the main section list.

**Discount isn't applying at checkout** — Check that the automatic discount exists in Shopify Admin → Discounts and that the function is the one selected. If needed, delete and recreate the discount after deployment.
