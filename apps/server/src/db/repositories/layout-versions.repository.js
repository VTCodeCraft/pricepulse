// layout_versions: every store layout manifest the scraper has seen.
import { json, query } from '../client.js';

export async function recordLayoutVersion({ manifestHash, schemaHash, revision, variant, bundlePath = null, manifest, supported }) {
  const { rows } = await query(
    `insert into layout_versions (manifest_hash, schema_hash, revision, variant, bundle_path, manifest, supported)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (manifest_hash) do update set last_seen_at = now(), seen_count = layout_versions.seen_count + 1
     returning id`,
    [manifestHash, schemaHash, revision, variant, bundlePath, json(manifest), supported],
  );
  return rows[0].id;
}

export async function listLayoutVersions(limit) {
  return (await query('select * from layout_versions order by last_seen_at desc, id desc limit $1', [limit])).rows;
}

// The page structure seen most recently, from any layout version, or undefined before the first check.
export async function latestStructure() {
  const { rows } = await query(
    `select id, structure_hash, structure, structure_checked_at from layout_versions
     where structure_hash is not null order by structure_checked_at desc, id desc limit 1`,
  );
  return rows[0];
}

export async function setStructure(layoutVersionId, { hash, signature }) {
  await query(
    'update layout_versions set structure_hash = $2, structure = $3, structure_checked_at = now() where id = $1',
    [layoutVersionId, hash, json(signature)],
  );
}
