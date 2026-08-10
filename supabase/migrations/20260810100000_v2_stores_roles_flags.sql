-- Migration A: stores, memberships, roles, and app flags.
-- Adds the multi tenant foundation the verified offer beta builds on.
-- Sorts after the v1 baseline and the existing reservation lifecycle rpcs
-- migration, both of which stay untouched by this file.

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  latitude double precision,
  longitude double precision,
  pilot_mode_enabled boolean not null default false,
  shop_seller_beta_enabled boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.store_memberships (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('staff', 'manager', 'owner', 'operator')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (store_id, user_id)
);

create table if not exists public.app_flags (
  id text primary key,
  value jsonb not null,
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.app_flags (id, value)
values ('marketplace_mode', '{"mode": "demo"}'::jsonb)
on conflict (id) do nothing;

alter table public.stores enable row level security;
alter table public.store_memberships enable row level security;
alter table public.app_flags enable row level security;

-- Returns the caller's role in a store, or null when they are not a member.
-- Security definer so it can read store_memberships on the caller's behalf
-- while row security stays enabled on that table for direct client access.
-- The stores select policy below calls this function, so it reads with row
-- security off rather than relying on the caller's own visibility into
-- store_memberships, which keeps the lookup correct no matter which policy
-- ends up calling it. Left volatile (the default) on purpose, Postgres
-- rejects a local SET inside a stable or immutable function.
create or replace function public.fn_current_store_role(p_store_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  set local row_security = off;

  select role
    into v_role
    from public.store_memberships
    where store_id = p_store_id
      and user_id = auth.uid()
    limit 1;

  return v_role;
end;
$$;

grant execute on function public.fn_current_store_role(uuid) to anon, authenticated;

drop policy if exists "stores_select_members"
  on public.stores;

create policy "stores_select_members"
  on public.stores
  for select
  to authenticated
  using (public.fn_current_store_role(id) is not null);

drop policy if exists "store_memberships_select_own"
  on public.store_memberships;

create policy "store_memberships_select_own"
  on public.store_memberships
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "app_flags_select_all"
  on public.app_flags;

create policy "app_flags_select_all"
  on public.app_flags
  for select
  to anon, authenticated
  using (true);

-- No insert, update, or delete policies for anon or authenticated on any of
-- the three tables above. Row level security defaults to deny when a
-- command type has no matching policy, so writes are only possible through
-- the service role, which bypasses row level security entirely. The public
-- read of store id, name, address, latitude, and longitude through a
-- redacted view belongs to a later migration, not this one.

notify pgrst, 'reload schema';
