# Shopify Bundle Builder Tool

## Overview
A Shopify-inspired bundle builder web application that allows customers to create custom product bundles with tiered discounts. Built as a standalone demo tool using React + Express.

## Architecture
- **Frontend**: React with TypeScript, TailwindCSS, shadcn/ui components, Framer Motion animations
- **Backend**: Express.js with in-memory storage (sample product data)
- **Routing**: wouter for client-side routing
- **State Management**: TanStack React Query for server state, React useState for UI state

## Key Features
- **Bundle Tiers**: Pick 3 (10% off), Pick 5 (15% off), Pick 7 (20% off)
- **Product Selection**: 12 products across 3 categories (Deodorant, Body Wash, Body Cream)
- **Live Pricing**: Real-time subtotal, discount, and total calculations
- **Category Filtering**: Filter products by category
- **Responsive Design**: Desktop sidebar summary + mobile bottom bar with sheet drawer
- **AJAX Cart**: Add bundle to cart without page reload
- **Validation**: Prevents over-selection, disables out-of-stock items

## File Structure
```
shared/schema.ts          - TypeScript interfaces (Product, BundleTier, CartBundle)
server/storage.ts         - In-memory storage with sample product data
server/routes.ts          - API endpoints (GET /api/products, GET /api/tiers, POST /api/cart/bundle)
client/src/App.tsx        - Router setup
client/src/pages/
  bundle-builder.tsx      - Main bundle builder page
client/src/components/
  tier-selector.tsx       - Bundle size selection cards
  product-card.tsx        - Individual product cards with selection state
  bundle-summary.tsx      - Summary sidebar + mobile bottom bar
```

## API Endpoints
- `GET /api/products` - Returns all products
- `GET /api/tiers` - Returns bundle tier configurations
- `POST /api/cart/bundle` - Adds a bundle to cart (validates tier + product count)

## Theme
- Primary color: Teal (162 hue)
- Font: Plus Jakarta Sans
- Design: Clean, modern e-commerce aesthetic with gradient product visuals
