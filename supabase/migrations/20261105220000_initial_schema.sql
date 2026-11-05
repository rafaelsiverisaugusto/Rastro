-- Rastro: initial schema (Phase 0)
-- Geometries are stored in EPSG:4326. Areas are always computed with geography:
-- hectares = ST_Area(geom::geography) / 10000.
-- PostGIS lives in the "extensions" schema (Supabase recommendation), so every
-- PostGIS type and function is schema-qualified below.

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------------
-- Reference layers (imported from official open sources, written only by the
-- service role in import scripts and cron jobs)
-- ---------------------------------------------------------------------------

create table public.deforestation (
  id bigserial primary key,
  source text not null check (source in ('DETER', 'PRODES')),
  external_id text,          -- DETER: gid as text, e.g. '42436_hist'
  class_name text,           -- DETER: classname
  detected_at date,          -- DETER: view_date
  prodes_year int,           -- PRODES: labelled year (Aug of previous year to Jul)
  satellite text,            -- DETER: satellite
  sensor text,               -- DETER: sensor
  municipality text,         -- DETER: municipali
  mun_geocode text,          -- DETER: mun_geocod
  published_month date,      -- DETER: publish_mo
  area_ha numeric,
  geom extensions.geometry(MultiPolygon, 4326) not null,
  is_synthetic boolean not null default false,  -- demo alert simulation only
  imported_at timestamptz not null default now(),
  unique (source, external_id)
);

create index deforestation_geom_idx on public.deforestation using gist (geom);
create index deforestation_source_date_idx on public.deforestation (source, detected_at);

create table public.protected_areas (
  id bigserial primary key,
  kind text not null check (kind in ('TI', 'UC')),
  name text,
  geom extensions.geometry(MultiPolygon, 4326) not null,
  imported_at timestamptz not null default now()
);

create index protected_areas_geom_idx on public.protected_areas using gist (geom);

create table public.coverage_regions (
  id serial primary key,
  name text not null,
  geom extensions.geometry(MultiPolygon, 4326) not null
);

create index coverage_regions_geom_idx on public.coverage_regions using gist (geom);

create table public.data_snapshots (
  id serial primary key,
  source text not null,
  synced_at timestamptz not null,
  details jsonb
);

create index data_snapshots_source_idx on public.data_snapshots (source, synced_at desc);

-- ---------------------------------------------------------------------------
-- User data
-- ---------------------------------------------------------------------------

create table public.farms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  commodity text not null,
  municipality text,
  geom extensions.geometry(Polygon, 4326) not null,
  area_ha numeric not null,
  capture_method text check (capture_method in ('draw', 'gps', 'upload')),
  created_at timestamptz not null default now(),
  constraint farms_geom_valid check (extensions.st_isvalid(geom))
);

create index farms_geom_idx on public.farms using gist (geom);
create index farms_owner_idx on public.farms (owner_id);

-- area_ha is always derived from the geometry on the server, never trusted from
-- the client.
create function public.set_farm_area()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.area_ha := extensions.st_area(new.geom::extensions.geography) / 10000;
  return new;
end;
$$;

create trigger farms_set_area
before insert or update of geom on public.farms
for each row execute function public.set_farm_area();

create table public.checks (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  status text not null check (status in ('COMPLIANT', 'ATTENTION', 'NON_COMPLIANT', 'NO_COVERAGE')),
  result jsonb not null,     -- findings, areas, dates, sources and data versions
  created_at timestamptz not null default now()
);

create index checks_farm_idx on public.checks (farm_id, created_at desc);

create table public.imagery (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  period text not null check (period in ('before', 'after')),  -- "window" is reserved
  stac_item_id text not null,
  acquired_at date not null,
  cloud_cover numeric,
  storage_path text not null,
  corners jsonb not null     -- 4 corners in EPSG:4326 to position the image on the map
);

create index imagery_farm_idx on public.imagery (farm_id);

create table public.dossiers (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references public.checks (id),
  narrative jsonb not null,  -- pt/en texts written by the AI
  payload jsonb not null,    -- canonical content that produces the hash
  sha256 text not null,
  pdf_path text,
  geojson_path text,
  created_at timestamptz not null default now()
);

create index dossiers_check_idx on public.dossiers (check_id);

create table public.lots (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id),
  dossier_id uuid not null references public.dossiers (id),
  public_code text unique not null,  -- short, non-sequential
  commodity text not null,
  quantity numeric,
  unit text,
  buyer_email text,
  created_at timestamptz not null default now()
);

create index lots_farm_idx on public.lots (farm_id);
create index lots_dossier_idx on public.lots (dossier_id);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  deforestation_id bigint references public.deforestation (id),
  overlap_ha numeric,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

create index alerts_farm_idx on public.alerts (farm_id);
create index alerts_deforestation_idx on public.alerts (deforestation_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Reference layers: readable by everyone (public open data), written only by
-- the service role (which bypasses RLS).
-- Farms: the owner can create, read, edit and delete their own farms.
-- Checks, imagery, dossiers, lots and alerts: the owner can only READ. They are
-- produced on the server (service role) so that a client can never forge a
-- verdict, a hash or a lot.
-- ---------------------------------------------------------------------------

alter table public.deforestation enable row level security;
alter table public.protected_areas enable row level security;
alter table public.coverage_regions enable row level security;
alter table public.data_snapshots enable row level security;
alter table public.farms enable row level security;
alter table public.checks enable row level security;
alter table public.imagery enable row level security;
alter table public.dossiers enable row level security;
alter table public.lots enable row level security;
alter table public.alerts enable row level security;

create policy "reference data is public" on public.deforestation
  for select to anon, authenticated using (true);
create policy "reference data is public" on public.protected_areas
  for select to anon, authenticated using (true);
create policy "reference data is public" on public.coverage_regions
  for select to anon, authenticated using (true);
create policy "reference data is public" on public.data_snapshots
  for select to anon, authenticated using (true);

create policy "owner reads farms" on public.farms
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner creates farms" on public.farms
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "owner updates farms" on public.farms
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "owner deletes farms" on public.farms
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "owner reads checks" on public.checks
  for select to authenticated using (
    exists (
      select 1 from public.farms f
      where f.id = checks.farm_id and f.owner_id = (select auth.uid())
    )
  );

create policy "owner reads imagery" on public.imagery
  for select to authenticated using (
    exists (
      select 1 from public.farms f
      where f.id = imagery.farm_id and f.owner_id = (select auth.uid())
    )
  );

create policy "owner reads dossiers" on public.dossiers
  for select to authenticated using (
    exists (
      select 1 from public.checks c
      join public.farms f on f.id = c.farm_id
      where c.id = dossiers.check_id and f.owner_id = (select auth.uid())
    )
  );

create policy "owner reads lots" on public.lots
  for select to authenticated using (
    exists (
      select 1 from public.farms f
      where f.id = lots.farm_id and f.owner_id = (select auth.uid())
    )
  );

create policy "owner reads alerts" on public.alerts
  for select to authenticated using (
    exists (
      select 1 from public.farms f
      where f.id = alerts.farm_id and f.owner_id = (select auth.uid())
    )
  );

-- Explicit table privileges (RLS policies above still apply on top of these).
grant select on public.deforestation, public.protected_areas,
  public.coverage_regions, public.data_snapshots to anon, authenticated;
grant select, insert, update, delete on public.farms to authenticated;
grant select on public.checks, public.imagery, public.dossiers,
  public.lots, public.alerts to authenticated;
