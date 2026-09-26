-- PricePulse schema. Every time column is timestamptz: an absolute instant, read and written as UTC by the app.
-- The server connects with the database owner role; RLS is enabled with no policies so Supabase's public
-- REST API (anon key) cannot read or write any table.

-- Store catalogue and product details cache (search, product info). One row per store product.
create table products (
  store_product_id   integer primary key check (store_product_id > 0),
  name               text not null,
  slug               text,
  brand              text,
  category           text,
  sku                text,
  description        text,
  option_axis        text,
  options            jsonb,
  specs              jsonb,
  review_summary     jsonb,
  catalog_synced_at  timestamptz not null default now(),
  details_fetched_at timestamptz
);

-- One row per product + option being tracked.
create table tracked_products (
  id                       bigint generated always as identity primary key,
  store_product_id         integer not null references products (store_product_id),
  option_id                text not null check (option_id ~ '^o[0-9]+$'),
  option_label             text not null check (option_label <> ''),
  is_active                boolean not null default true,
  scrape_interval_minutes  integer not null default 120 check (scrape_interval_minutes in (60, 120, 240, 360, 720, 1440)),
  next_scrape_at           timestamptz not null default now(),
  price_drop_threshold_pct numeric(5,2) not null default 5 check (price_drop_threshold_pct between 0.5 and 90),
  last_manual_scrape_at    timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (store_product_id, option_id)
);

-- One row per trigger (cron tick, manual scrape, CLI). A tick with nothing due is still recorded (products_due = 0).
create table scrape_runs (
  id              bigint generated always as identity primary key,
  trigger         text not null check (trigger in ('cron', 'manual', 'initial', 'cli')),
  status          text not null default 'running' check (status in ('running', 'completed', 'failed', 'abandoned')),
  started_at      timestamptz not null default now(),
  heartbeat_at    timestamptz not null default now(),
  finished_at     timestamptz,
  products_due    integer not null default 0,
  success_count   integer not null default 0,
  retried_count   integer not null default 0,
  failed_count    integer not null default 0,
  error_message   text,
  host            text,
  fault_injection jsonb,
  check ((status = 'running') = (finished_at is null))
);
-- The run lock: at most one run can be 'running'. A second insert fails with a unique violation.
create unique index scrape_runs_one_running on scrape_runs (status) where status = 'running';
create index scrape_runs_started on scrape_runs (started_at desc);

-- Each distinct store layout manifest seen by the scraper.
create table layout_versions (
  id            bigint generated always as identity primary key,
  manifest_hash text not null unique,
  schema_hash   text not null,
  revision      integer,
  variant       integer,
  bundle_path   text,
  manifest      jsonb not null,
  supported     boolean not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  seen_count    integer not null default 1
);

-- One row per tracked option per run. The single source for history, the scrape log, CSV export and alerts.
create table scrape_attempts (
  id                 bigint generated always as identity primary key,
  run_id             bigint not null references scrape_runs (id),
  tracked_product_id bigint not null references tracked_products (id),
  page_session_id    uuid,
  started_at         timestamptz not null default now(),
  finished_at        timestamptz,
  outcome            text check (outcome in ('success', 'retried', 'failed')),
  price              numeric(12,2) check (price > 0),
  currency           char(3) check (currency ~ '^[A-Z]{3}$'),
  stock              integer check (stock >= 0),
  tries              smallint not null default 0 check (tries between 0 and 10),
  error_code         text,
  error_message      text,
  layout_version_id  bigint references layout_versions (id),
  layout_revision    integer,
  extras             jsonb,
  details            jsonb not null default '{}',
  -- In progress = no outcome and no finish time; finished = both.
  check ((outcome is null) = (finished_at is null)),
  -- Only a successful or retried attempt carries an observation, and then it carries all of it.
  -- Failed and in-progress attempts never carry a price, stock or currency.
  constraint observation_matches_outcome check (
    case
      when outcome in ('success', 'retried') then price is not null and stock is not null and currency is not null
      else price is null and stock is null and currency is null
    end
  )
);
create index scrape_attempts_by_product on scrape_attempts (tracked_product_id, started_at desc);
create index scrape_attempts_finished on scrape_attempts (finished_at);
create index scrape_attempts_observations on scrape_attempts (tracked_product_id, finished_at) where outcome in ('success', 'retried');
create index scrape_attempts_by_run on scrape_attempts (run_id);

-- In-app notifications. (type, dedupe_key) makes each event alert at most once.
create table alerts (
  id                 bigint generated always as identity primary key,
  type               text not null check (type in ('price_drop', 'back_in_stock', 'structure_changed', 'store_app_updated')),
  severity           text not null check (severity in ('info', 'warning')),
  tracked_product_id bigint references tracked_products (id),
  attempt_id         bigint references scrape_attempts (id),
  dedupe_key         text not null,
  title              text not null,
  message            text not null,
  data               jsonb,
  created_at         timestamptz not null default now(),
  read_at            timestamptz,
  email_status       text not null default 'not_configured' check (email_status in ('not_configured', 'pending', 'sent', 'failed')),
  email_error        text,
  unique (type, dedupe_key)
);
create index alerts_created on alerts (created_at desc);
create index alerts_unread on alerts (id) where read_at is null;

alter table products enable row level security;
alter table tracked_products enable row level security;
alter table scrape_runs enable row level security;
alter table layout_versions enable row level security;
alter table scrape_attempts enable row level security;
alter table alerts enable row level security;
alter table schema_migrations enable row level security;
