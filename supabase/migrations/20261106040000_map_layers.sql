-- Phase 1: data for the maps.

-- Outline of the covered region (pilot municipalities), simplified for display
-- (about 50 m). Public data: anyone can read it.
create function public.coverage_outline()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'type', 'Feature',
    'properties', jsonb_build_object(
      'municipalities', (select jsonb_agg(c.name order by c.name) from public.coverage_regions c)),
    'geometry', extensions.st_asgeojson(
      extensions.st_simplifypreservetopology(extensions.st_union(c.geom), 0.0005), 6)::jsonb)
  from public.coverage_regions c
  having count(*) > 0;
$$;

grant execute on function public.coverage_outline() to anon, authenticated;

-- Farm polygon plus the reference layers around it, for the result map.
-- SECURITY INVOKER: the farms RLS policy limits it to the owner's farms.
create function public.farm_map_layers(p_farm_id uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  farm_geom extensions.geometry;
  box extensions.geometry;
  margin double precision;
begin
  select f.geom into farm_geom from public.farms f where f.id = p_farm_id;
  if farm_geom is null then
    return null;
  end if;

  -- Context window: the farm extent plus 60% on each side (at least ~500 m).
  margin := greatest(
    extensions.st_xmax(farm_geom) - extensions.st_xmin(farm_geom),
    extensions.st_ymax(farm_geom) - extensions.st_ymin(farm_geom)) * 0.6 + 0.005;
  box := extensions.st_expand(extensions.st_envelope(farm_geom), margin);

  return jsonb_build_object(
    'farm', extensions.st_asgeojson(farm_geom, 7)::jsonb,
    'bbox', jsonb_build_array(
      extensions.st_xmin(box), extensions.st_ymin(box),
      extensions.st_xmax(box), extensions.st_ymax(box)),
    'deforestation', jsonb_build_object(
      'type', 'FeatureCollection',
      'features', coalesce((
        select jsonb_agg(jsonb_build_object(
          'type', 'Feature',
          'properties', jsonb_build_object(
            'source', d.source, 'class_name', d.class_name,
            'detected_at', d.detected_at, 'prodes_year', d.prodes_year,
            'is_synthetic', d.is_synthetic),
          'geometry', extensions.st_asgeojson(d.geom, 6)::jsonb))
        from (
          select * from public.deforestation d
          where extensions.st_intersects(d.geom, box)
          order by d.detected_at desc nulls last
          limit 1000
        ) d), '[]'::jsonb)),
    'protected_areas', jsonb_build_object(
      'type', 'FeatureCollection',
      'features', coalesce((
        select jsonb_agg(jsonb_build_object(
          'type', 'Feature',
          'properties', jsonb_build_object('kind', p.kind, 'name', p.name),
          'geometry', extensions.st_asgeojson(
            extensions.st_intersection(p.geom, extensions.st_expand(box, 0.01)), 6)::jsonb))
        from public.protected_areas p
        where extensions.st_intersects(p.geom, box)), '[]'::jsonb))
  );
end;
$$;

revoke all on function public.farm_map_layers(uuid) from public, anon;
grant execute on function public.farm_map_layers(uuid) to authenticated, service_role;
