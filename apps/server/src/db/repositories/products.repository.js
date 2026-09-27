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

const escapeLike = text => text.replace(/[\\%_]/g, '\\$&');

// Case-insensitive search on product names: every word must appear; names starting with the query come first.
export async function searchProducts(text, limit) {
  const words = text.trim().split(/\s+/).map(word => `%${escapeLike(word)}%`);
  const conditions = words.map((_, i) => `name ilike $${i + 3}`).join(' and ');
  const { rows } = await query(
    `select store_product_id, name, brand, category, sku from products
     where ${conditions}
     order by (lower(name) like lower($1) || '%') desc, name
     limit $2`,
    [escapeLike(text.trim()), limit, ...words],
  );
  return rows;
}

// One page of the catalogue for browsing, optionally filtered the same way as searchProducts, with the number of
// products that match. option_count is known only for products whose details were fetched (listings carry no options).
export async function listCatalogProducts({ text = '', limit, offset }) {
  const words = text.trim() ? text.trim().split(/\s+/).map(word => `%${escapeLike(word)}%`) : [];
  const where = words.length ? `where ${words.map((_, i) => `name ilike $${i + 1}`).join(' and ')}` : '';
  const prefixFirst = words.length ? `(lower(name) like lower($${words.length + 3}) || '%') desc, ` : '';
  const [count, page] = await Promise.all([
    query(`select count(*)::int as total from products ${where}`, words),
    query(
      `select store_product_id, name, brand, category, sku,
              case when jsonb_typeof(options) = 'array' then jsonb_array_length(options) end as option_count
       from products ${where}
       order by ${prefixFirst}name, store_product_id
       limit $${words.length + 1} offset $${words.length + 2}`,
      [...words, limit, offset, ...(words.length ? [escapeLike(text.trim())] : [])],
    ),
  ]);
  return { total: count.rows[0].total, rows: page.rows };
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
