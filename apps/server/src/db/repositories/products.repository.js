// products: the catalogue (from the listing sync) and product details (from item lookups).
import { json, query } from '../client.js';

// Listing rows from the catalogue sync. Leaves the detail columns (options, specs, reviews) untouched.
export async function upsertCatalogProducts(products) {
  await query(
    `insert into products (store_product_id, name, slug, brand, category, sku, description, catalog_synced_at)
     select id, name, slug, brand, category, sku, description, now()
     from jsonb_to_recordset($1::jsonb) as x(id int, name text, slug text, brand text, category text, sku text, description text)
     on conflict (store_product_id) do update set
       name = excluded.name, slug = excluded.slug, brand = excluded.brand, category = excluded.category,
       sku = excluded.sku, description = excluded.description, catalog_synced_at = now()`,
    [JSON.stringify(products)],
  );
}

// Only products seen by a catalogue sync count; products added through a detail lookup have no sync time.
export async function catalogStatus() {
  const { rows } = await query(
    'select count(catalog_synced_at)::int as count, max(catalog_synced_at) as synced_at from products',
  );
  return rows[0];
}

// Case-insensitive search on product names: every word must appear; names starting with the query come first.
export async function searchProducts(text, limit) {
  const words = text.trim().split(/\s+/).map(word => `%${word.replace(/[\\%_]/g, '\\$&')}%`);
  const conditions = words.map((_, i) => `name ilike $${i + 3}`).join(' and ');
  const { rows } = await query(
    `select store_product_id, name, brand, category, sku from products
     where ${conditions}
     order by (lower(name) like lower($1) || '%') desc, name
     limit $2`,
    [text.trim().replace(/[\\%_]/g, '\\$&'), limit, ...words],
  );
  return rows;
}

// The review_summary column: review count and average rating.
export function reviewSummary(reviews = []) {
  const ratings = reviews.map(review => review.rating).filter(Number.isFinite);
  if (!ratings.length) return null;
  return { count: ratings.length, avgRating: Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 };
}

export async function upsertProduct(item) {
  await query(
    `insert into products (store_product_id, name, slug, brand, category, sku, description, option_axis, options, specs,
                           review_summary, details_fetched_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
     on conflict (store_product_id) do update set
       name = excluded.name, slug = excluded.slug, brand = excluded.brand, category = excluded.category,
       sku = excluded.sku, description = excluded.description, option_axis = excluded.option_axis,
       options = excluded.options, specs = excluded.specs, review_summary = excluded.review_summary,
       details_fetched_at = now()`,
    [item.id, item.name, item.slug, item.brand, item.category, item.sku, item.description, item.optionAxis,
      json(item.options), json(item.specs), json(reviewSummary(item.reviews))],
  );
}
