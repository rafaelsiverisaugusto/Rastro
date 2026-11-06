-- Minimal stand-in for what a Supabase project provides, so the migrations in
-- supabase/migrations can be applied to a plain PostGIS container in CI.
-- Never run this against a real Supabase database.

-- The postgis/postgis image pre-installs PostGIS in "public". Supabase keeps it
-- in "extensions", which the migrations create explicitly.
drop extension if exists postgis_tiger_geocoder cascade;
drop extension if exists postgis_topology cascade;
drop extension if exists fuzzystrmatch cascade;
drop extension if exists postgis cascade;

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema extensions;

create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
