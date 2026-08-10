create extension if not exists pgcrypto;

create table if not exists public.seller_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  business_name text not null,
  business_type text not null check (business_type in ('restaurant', 'shop')),
  category text not null,
  address text not null,
  latitude double precision not null,
  longitude double precision not null,
  rating numeric(2,1) not null default 0,
  reviews integer not null default 0,
  translations jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles (id) on delete cascade,
  product_name text not null,
  barcode text not null,
  expiry_date date not null,
  quantity integer not null check (quantity > 0),
  source text not null check (source in ('manual', 'camera', 'image')),
  ocr_text text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.seller_offers (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles (id) on delete cascade,
  title text not null,
  business_name text not null,
  category text not null,
  image text,
  old_price numeric(10,2) not null,
  new_price numeric(10,2) not null,
  discount integer not null default 0,
  distance_text text not null default '0.0 km',
  pickup_start time,
  pickup_end time not null,
  quantity_available integer not null check (quantity_available >= 0),
  contents jsonb not null default '[]'::jsonb,
  allergens jsonb not null default '[]'::jsonb,
  cancellation_policy text,
  dietary_badges jsonb not null default '[]'::jsonb,
  pickup_instructions text,
  source text not null default 'seller',
  business_type text not null default 'restaurant',
  latitude double precision not null,
  longitude double precision not null,
  address text not null,
  rating numeric(2,1) not null default 0,
  reviews integer not null default 0,
  status text not null default 'published' check (status in ('draft', 'published', 'sold_out')),
  translations jsonb not null default '{}'::jsonb,
  published_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.pickup_orders (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles (id) on delete cascade,
  offer_id uuid references public.seller_offers (id) on delete set null,
  customer_name text not null,
  reservation_code text not null unique,
  pickup_window text not null,
  total numeric(10,2) not null,
  status text not null default 'pending' check (status in ('pending', 'collected', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.seller_profiles enable row level security;
alter table public.inventory_items enable row level security;
alter table public.seller_offers enable row level security;
alter table public.pickup_orders enable row level security;

alter table if exists public.seller_profiles
  add column if not exists translations jsonb not null default '{}'::jsonb;

alter table if exists public.seller_offers
  add column if not exists translations jsonb not null default '{}'::jsonb;

alter table if exists public.seller_offers
  add column if not exists allergens jsonb not null default '[]'::jsonb;

alter table if exists public.seller_offers
  add column if not exists cancellation_policy text;

alter table if exists public.seller_offers
  add column if not exists dietary_badges jsonb not null default '[]'::jsonb;

alter table if exists public.seller_offers
  add column if not exists pickup_instructions text;

drop policy if exists "seller_profiles_select_own"
  on public.seller_profiles;

create policy "seller_profiles_select_own"
  on public.seller_profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "seller_profiles_insert_own"
  on public.seller_profiles;

create policy "seller_profiles_insert_own"
  on public.seller_profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "seller_profiles_update_own"
  on public.seller_profiles;

create policy "seller_profiles_update_own"
  on public.seller_profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "inventory_items_manage_own"
  on public.inventory_items;

create policy "inventory_items_manage_own"
  on public.inventory_items
  for all
  to authenticated
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

drop policy if exists "seller_offers_manage_own"
  on public.seller_offers;

create policy "seller_offers_manage_own"
  on public.seller_offers
  for all
  to authenticated
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

drop policy if exists "seller_offers_select_published"
  on public.seller_offers;

create policy "seller_offers_select_published"
  on public.seller_offers
  for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "pickup_orders_manage_own"
  on public.pickup_orders;

create policy "pickup_orders_manage_own"
  on public.pickup_orders
  for all
  to authenticated
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

drop policy if exists "pickup_orders_insert_public_reservations"
  on public.pickup_orders;

create or replace function public.reserve_seller_offer(
  p_offer_id uuid,
  p_reservation_code text,
  p_pickup_window text,
  p_customer_name text default 'Mobile customer'
)
returns table (
  pickup_order_id uuid,
  seller_id uuid,
  offer_id uuid,
  reservation_code text,
  pickup_window text,
  total numeric,
  status text,
  quantity_available integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text;
  existing_order public.pickup_orders%rowtype;
  reserved_offer public.seller_offers%rowtype;
  created_order public.pickup_orders%rowtype;
begin
  normalized_code := nullif(trim(p_reservation_code), '');

  if normalized_code is null then
    raise exception 'Reservation code is required.';
  end if;

  select po.*
    into existing_order
    from public.pickup_orders po
    where po.reservation_code = normalized_code;

  if found then
    if existing_order.offer_id is distinct from p_offer_id then
      raise exception 'Reservation code already belongs to another offer.';
    end if;

    select so.quantity_available
      into quantity_available
      from public.seller_offers so
      where so.id = existing_order.offer_id;

    pickup_order_id := existing_order.id;
    seller_id := existing_order.seller_id;
    offer_id := existing_order.offer_id;
    reservation_code := existing_order.reservation_code;
    pickup_window := existing_order.pickup_window;
    total := existing_order.total;
    status := existing_order.status;
    return next;
    return;
  end if;

  update public.seller_offers so
    set
      quantity_available = so.quantity_available - 1,
      status = case
        when so.quantity_available - 1 <= 0 then 'sold_out'
        else so.status
      end
    where so.id = p_offer_id
      and so.status = 'published'
      and so.quantity_available > 0
    returning so.*
    into reserved_offer;

  if not found then
    raise exception 'Offer is no longer available.';
  end if;

  insert into public.pickup_orders (
    seller_id,
    offer_id,
    customer_name,
    reservation_code,
    pickup_window,
    total,
    status
  )
  values (
    reserved_offer.seller_id,
    reserved_offer.id,
    coalesce(nullif(trim(p_customer_name), ''), 'Mobile customer'),
    normalized_code,
    p_pickup_window,
    reserved_offer.new_price,
    'pending'
  )
  returning *
  into created_order;

  pickup_order_id := created_order.id;
  seller_id := created_order.seller_id;
  offer_id := created_order.offer_id;
  reservation_code := created_order.reservation_code;
  pickup_window := created_order.pickup_window;
  total := created_order.total;
  status := created_order.status;
  quantity_available := reserved_offer.quantity_available;
  return next;
end;
$$;

create or replace function public.cancel_seller_reservation(
  p_offer_id uuid,
  p_reservation_code text
)
returns table (
  pickup_order_id uuid,
  seller_id uuid,
  offer_id uuid,
  reservation_code text,
  status text,
  quantity_available integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text;
  target_order public.pickup_orders%rowtype;
begin
  normalized_code := nullif(trim(p_reservation_code), '');

  if normalized_code is null then
    raise exception 'Reservation code is required.';
  end if;

  select po.*
    into target_order
    from public.pickup_orders po
    where po.offer_id = p_offer_id
      and po.reservation_code = normalized_code;

  if not found then
    raise exception 'Seller pickup order is no longer pending.';
  end if;

  if target_order.status = 'cancelled' then
    select so.quantity_available
      into quantity_available
      from public.seller_offers so
      where so.id = target_order.offer_id;
  elsif target_order.status = 'pending' then
    update public.pickup_orders po
      set status = 'cancelled'
      where po.id = target_order.id
      returning po.*
      into target_order;

    update public.seller_offers so
      set
        quantity_available = so.quantity_available + 1,
        status = case
          when so.status = 'sold_out' then 'published'
          else so.status
        end
      where so.id = target_order.offer_id
      returning so.quantity_available
      into quantity_available;
  else
    raise exception 'Seller pickup order is no longer pending.';
  end if;

  pickup_order_id := target_order.id;
  seller_id := target_order.seller_id;
  offer_id := target_order.offer_id;
  reservation_code := target_order.reservation_code;
  status := target_order.status;
  return next;
end;
$$;

grant execute on function public.reserve_seller_offer(
  uuid,
  text,
  text,
  text
) to anon, authenticated;

grant execute on function public.cancel_seller_reservation(
  uuid,
  text
) to anon, authenticated;

notify pgrst, 'reload schema';
