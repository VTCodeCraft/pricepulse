-- Page-structure fingerprint: the normalized shape of the store's price panel (see pageStructure in
-- src/scraper/layout.js), kept on the layout version it was seen with. NULL on versions recorded before this
-- migration and on versions no successful scrape has used yet.
alter table layout_versions
  add column structure_hash text,
  add column structure jsonb,
  add column structure_checked_at timestamptz,
  add constraint structure_complete check (
    (structure_hash is null) = (structure is null) and (structure is null) = (structure_checked_at is null)
  );
create index layout_versions_structure_checked on layout_versions (structure_checked_at desc) where structure_hash is not null;
