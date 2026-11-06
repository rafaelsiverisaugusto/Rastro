-- Phase 1: demo farms cannot be edited or deleted by whoever uses the shared
-- demo account (docs/decisoes.md D-017). Only the service role (seed) changes them.

alter table public.farms
  add column is_locked boolean not null default false,
  add column is_demo boolean not null default false;

comment on column public.farms.is_locked is
  'Locked farms (demo) cannot be updated or deleted by their owner; only the service role changes them.';
comment on column public.farms.is_demo is
  'Fictitious demonstration farm created by npm run data:seed.';

drop policy "owner updates farms" on public.farms;
drop policy "owner deletes farms" on public.farms;

create policy "owner updates unlocked farms" on public.farms
  for update to authenticated
  using (owner_id = (select auth.uid()) and not is_locked)
  with check (owner_id = (select auth.uid()) and not is_locked and not is_demo);

create policy "owner deletes unlocked farms" on public.farms
  for delete to authenticated using (owner_id = (select auth.uid()) and not is_locked);

-- Users cannot create farms that pretend to be locked demo farms.
drop policy "owner creates farms" on public.farms;
create policy "owner creates farms" on public.farms
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and not is_locked and not is_demo);
