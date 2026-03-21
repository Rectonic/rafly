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
  source text not null default 'seller',
  business_type text not null default 'restaurant',
  latitude double precision not null,
  longitude double precision not null,
  address text not null,
  rating numeric(2,1) not null default 0,
  reviews integer not null default 0,
  status text not null default 'published' check (status in ('draft', 'published', 'sold_out')),
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

create policy "seller_profiles_select_own"
  on public.seller_profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "seller_profiles_update_own"
  on public.seller_profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "inventory_items_manage_own"
  on public.inventory_items
  for all
  to authenticated
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

create policy "seller_offers_manage_own"
  on public.seller_offers
  for all
  to authenticated
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

create policy "pickup_orders_manage_own"
  on public.pickup_orders
  for all
  to authenticated
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);
