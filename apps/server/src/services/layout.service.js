// Page-structure change detection. Each successful scrape reports the structure of the price panel it read
// (pageStructure); it is compared with the last structure seen, stored on the attempt's layout version, and a change
// raises a structure_changed alert.
import { insertAlert, listAlerts } from '../db/repositories/alerts.repository.js';
import { latestStructure, setStructure } from '../db/repositories/layout-versions.repository.js';

// Returns 'first_seen', 'unchanged' or 'changed'.
export async function checkPageStructure({ structure, layoutVersionId, attemptId }) {
  const previous = await latestStructure();
  // Without a layout version the structure cannot be stored; it is still compared, so a change is not missed.
  if (layoutVersionId) await setStructure(layoutVersionId, structure);
  if (!previous) return 'first_seen';
  if (previous.structure_hash === structure.hash) return 'unchanged';

  const changed = Object.keys(structure.signature).filter(key => JSON.stringify(previous.structure[key]) !== JSON.stringify(structure.signature[key]));
  await insertAlert({
    type: 'structure_changed',
    severity: 'warning',
    attemptId,
    dedupeKey: `attempt:${attemptId}`,
    title: 'Store page structure changed',
    message: `The price panel changed: ${changed.join(', ')}. Scrapes still validate every value; check the scrape log.`,
    data: { changed, previousHash: previous.structure_hash, currentHash: structure.hash, previous: previous.structure, current: structure.signature },
  });
  return 'changed';
}

// For the API: the current structure and whether a change is waiting to be acknowledged (an unread alert).
export async function structureStatus() {
  const [current, [lastChange]] = await Promise.all([latestStructure(), listAlerts({ unreadOnly: false, limit: 1, types: ['structure_changed'] })]);
  if (!current) return { status: 'unknown', hash: null, signature: null, checkedAt: null, lastChange: lastChange ?? null };
  return {
    status: lastChange && !lastChange.read_at ? 'changed' : 'unchanged',
    hash: current.structure_hash,
    signature: current.structure,
    checkedAt: current.structure_checked_at,
    lastChange: lastChange ?? null,
  };
}
