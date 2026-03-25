import { Pool } from "pg";

function migrateLog(msg: string) {
  const t = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
  console.log(`${t} [migrate] ${msg}`);
}

/**
 * Runs CREATE TABLE IF NOT EXISTS for every table in the schema.
 * Safe to run on every startup — does nothing if tables already exist.
 * This ensures Render (and any fresh deployment) has a working DB immediately.
 */
export async function autoMigrate(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    migrateLog("Running auto-migration (CREATE TABLE IF NOT EXISTS)...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS shopify_sessions (
        id TEXT PRIMARY KEY,
        shop TEXT NOT NULL,
        state TEXT,
        is_online BOOLEAN NOT NULL DEFAULT false,
        scope TEXT,
        expires TIMESTAMPTZ,
        access_token TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bundles (
        id SERIAL PRIMARY KEY,
        shop TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        discount_type TEXT NOT NULL DEFAULT 'percentage',
        discount_tiers JSONB NOT NULL DEFAULT '[]',
        discount_enabled BOOLEAN NOT NULL DEFAULT true,
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bundle_slots (
        id SERIAL PRIMARY KEY,
        bundle_id INTEGER NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        image_url TEXT,
        shopify_collection_id TEXT,
        shopify_collection_title TEXT,
        position INTEGER NOT NULL DEFAULT 0,
        min_qty INTEGER NOT NULL DEFAULT 1,
        max_qty INTEGER
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bundle_slot_products (
        id SERIAL PRIMARY KEY,
        slot_id INTEGER NOT NULL REFERENCES bundle_slots(id) ON DELETE CASCADE,
        shopify_product_id TEXT NOT NULL,
        shopify_variant_id TEXT,
        product_title TEXT NOT NULL,
        variant_title TEXT,
        product_image TEXT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS shop_subscriptions (
        id SERIAL PRIMARY KEY,
        shop TEXT NOT NULL UNIQUE,
        charge_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        plan_tier TEXT NOT NULL DEFAULT 'free',
        trial_days INTEGER NOT NULL DEFAULT 0,
        plan_name TEXT NOT NULL DEFAULT 'Free',
        plan_price TEXT NOT NULL DEFAULT '0',
        activated_at TIMESTAMPTZ,
        cancelled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE bundle_event_type AS ENUM ('view', 'add_to_cart', 'order');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bundle_events (
        id SERIAL PRIMARY KEY,
        shop TEXT NOT NULL,
        bundle_id INTEGER NOT NULL,
        event_type bundle_event_type NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS bundle_events_shop_bundle_created_idx
        ON bundle_events(shop, bundle_id, created_at);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS shop_settings (
        id SERIAL PRIMARY KEY,
        shop TEXT NOT NULL UNIQUE,
        button_primary TEXT,
        button_secondary TEXT,
        theme_accent TEXT,
        border_color TEXT,
        font_color TEXT,
        sticky_cart_bg TEXT,
        sticky_cart_text TEXT,
        progress_bar_fill TEXT,
        progress_bar_bg TEXT,
        custom_css TEXT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS discount_templates (
        id SERIAL PRIMARY KEY,
        shop TEXT NOT NULL,
        name TEXT NOT NULL,
        key TEXT NOT NULL,
        discount_type TEXT NOT NULL DEFAULT 'percentage',
        tiers JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (shop, key)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS discount_templates_shop_idx
        ON discount_templates(shop);
    `);

    migrateLog("Auto-migration complete — all tables ready.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    migrateLog(`Auto-migration error: ${msg}`);
    throw err;
  } finally {
    client.release();
  }
}
