-- Phase 1: keys and metadata for idempotent imports of the reference layers.
-- See docs/decisoes.md (D-008, D-013).

-- DETER: gid is not unique in the INPE layer, so external_id is
-- 'gid|view_date|classname|mun_geocod'. PRODES: external_id is the layer uuid.
comment on column public.deforestation.external_id is
  'DETER: gid|view_date|classname|mun_geocod (gid alone is not unique). PRODES: uuid.';
comment on column public.deforestation.class_name is
  'DETER: classname. PRODES: class_name (d<year>).';
comment on column public.deforestation.detected_at is
  'DETER: view_date. PRODES: image_date.';

create index deforestation_source_year_idx on public.deforestation (source, prodes_year);

-- Protected areas: stable id from the source so imports can be re-run.
alter table public.protected_areas
  add column external_id text,
  add column category text,   -- TI: fase_ti; UC: categoria
  add column source_date text; -- TI: data_atual; UC: shapefile edition

update public.protected_areas set external_id = id::text where external_id is null;

alter table public.protected_areas
  alter column external_id set not null,
  add constraint protected_areas_kind_external_id_key unique (kind, external_id);

-- Coverage: one row per pilot municipality (union = covered region). The
-- municipality of a farm can be read from here.
alter table public.coverage_regions
  add column mun_geocode text;

alter table public.coverage_regions
  add constraint coverage_regions_mun_geocode_key unique (mun_geocode);
