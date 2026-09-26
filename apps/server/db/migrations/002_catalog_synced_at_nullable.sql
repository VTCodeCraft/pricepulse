-- catalog_synced_at now means "seen by a full catalogue sync". Products added only through a product-detail lookup
-- (e.g. when an option is tracked) have NULL, so an unsynced catalogue is not mistaken for a loaded one.
alter table products alter column catalog_synced_at drop not null;
alter table products alter column catalog_synced_at drop default;
-- No catalogue sync existed before this migration, so every existing row came from a detail lookup.
update products set catalog_synced_at = null;
