-- Data versions use the Brasília date (America/Sao_Paulo), not UTC: an import
-- run at 22h on 2026-11-05 must read as 2026-11-05. Same function otherwise.
-- create or replace keeps the existing grants.

create or replace function public.compliance_facts(
  farm_geom extensions.geometry,
  border_tolerance_m double precision default 10
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  farm extensions.geometry;
  analysis extensions.geometry;
  tolerance_applied boolean := true;
  farm_area_ha double precision;
  analysis_area_ha double precision;
  covered_ha double precision;
  municipality jsonb;
  deforestation jsonb;
  protected jsonb;
  versions jsonb;
begin
  if farm_geom is null then
    raise exception 'farm_geom is required';
  end if;
  farm := case when extensions.st_srid(farm_geom) = 0
               then extensions.st_setsrid(farm_geom, 4326) else farm_geom end;
  if extensions.st_srid(farm) <> 4326 then
    raise exception 'farm_geom must be EPSG:4326, got %', extensions.st_srid(farm);
  end if;

  farm_area_ha := extensions.st_area(farm::extensions.geography) / 10000;

  -- Inner buffer: ignore a strip of border_tolerance_m along the border. If it
  -- empties the polygon (very thin farm), use the original polygon.
  analysis := extensions.st_buffer(farm::extensions.geography, -border_tolerance_m)::extensions.geometry;
  if analysis is null or extensions.st_isempty(analysis)
     or extensions.st_area(analysis::extensions.geography) = 0 then
    analysis := farm;
    tolerance_applied := false;
  end if;
  analysis_area_ha := extensions.st_area(analysis::extensions.geography) / 10000;

  -- Coverage: area of the analysis polygon inside the pilot municipalities.
  select coalesce(sum(extensions.st_area(
           extensions.st_intersection(c.geom, analysis)::extensions.geography)), 0) / 10000
    into covered_ha
    from public.coverage_regions c
   where extensions.st_intersects(c.geom, analysis);

  select jsonb_build_object('name', c.name, 'geocode', c.mun_geocode)
    into municipality
    from public.coverage_regions c
   where extensions.st_intersects(c.geom, farm)
   order by extensions.st_area(extensions.st_intersection(c.geom, farm)::extensions.geography) desc
   limit 1;

  -- Deforestation overlaps. Rows with the same source, class, date and
  -- geometry are counted once (DETER gid may change between _curr and _hist).
  select coalesce(jsonb_agg(to_jsonb(x) order by x.detected_at desc nulls last, x.id), '[]'::jsonb)
    into deforestation
    from (
      select distinct on (d.source, d.class_name, d.detected_at, d.prodes_year,
                          md5(extensions.st_asbinary(d.geom)))
             d.id, d.source, d.external_id, d.class_name, d.detected_at, d.prodes_year,
             d.is_synthetic,
             extensions.st_area(extensions.st_intersection(d.geom, analysis)::extensions.geography)
               / 10000 as overlap_ha
        from public.deforestation d
       where extensions.st_intersects(d.geom, analysis)
       order by d.source, d.class_name, d.detected_at, d.prodes_year,
                md5(extensions.st_asbinary(d.geom)), d.id desc
    ) x
   where x.overlap_ha > 0;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.overlap_ha desc), '[]'::jsonb)
    into protected
    from (
      select p.id, p.kind, p.external_id, p.name, p.category,
             extensions.st_area(extensions.st_intersection(p.geom, analysis)::extensions.geography)
               / 10000 as overlap_ha
        from public.protected_areas p
       where extensions.st_intersects(p.geom, analysis)
    ) x
   where x.overlap_ha > 0;

  -- Versions of the reference data (latest import of each source).
  select jsonb_build_object(
           'DETER', (select s.details ->> 'latest_view_date' from public.data_snapshots s
                      where s.source = 'DETER' order by s.synced_at desc limit 1),
           'PRODES', (select s.details ->> 'latest_year' from public.data_snapshots s
                       where s.source = 'PRODES' order by s.synced_at desc limit 1),
           'TI', (select to_char(s.synced_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')
                   from public.data_snapshots s
                   where s.source = 'TI' order by s.synced_at desc limit 1),
           'UC', (select s.details ->> 'edition' from public.data_snapshots s
                   where s.source = 'UC' order by s.synced_at desc limit 1))
    into versions;

  return jsonb_build_object(
    'farm_area_ha', farm_area_ha,
    'analysis_area_ha', analysis_area_ha,
    'outside_coverage_ha', greatest(analysis_area_ha - covered_ha, 0),
    'municipality', municipality,
    'border_tolerance_m', border_tolerance_m,
    'border_tolerance_applied', tolerance_applied,
    'deforestation', deforestation,
    'protected_areas', protected,
    'data_versions', versions
  );
end;
$$;
