-- Migration C adds v2 offers, reservations, the redacted marketplace view,
-- and the transactional buyer and seller RPCs.
--
-- GLOBAL LOCK ORDER RULE for every function in this file:
--
--   an offers_v2 row is always locked BEFORE any reservations_v2 row of that
--   offer, never after.
--
-- The expiry sweep, report_stock_mismatch_v2, pause_offer_v2, reserve_offer_v2
-- and cancel_reservation_v2 all walk the pair in that direction. Two writers
-- that walk the same pair in opposite directions deadlock, and Postgres
-- resolves a deadlock by killing one of them with a raw 40P01 that neither
-- the buyer nor the seller contract has an error shape for, so it reaches the
-- caller as unknown rather than as anything actionable.
--
-- Reading a row without a lock first, purely to learn which offer to lock, is
-- allowed as long as nothing is decided on that read and every check is re-run
-- against the locked copies afterwards. cancel_reservation_v2 and
-- approve_stock_adjustment_v2 both do exactly that and say so at the site.
--
-- store_products sits outside this pair. fulfill_reservation_v2 locks its
-- reservation and then the product, publish_offer_v2 and
-- approve_stock_adjustment_v2 lock only the product, and nothing anywhere
-- locks a product before locking a reservations_v2 row, so the product lock
-- joins no cycle today. A future writer that needs both must take them in
-- fulfillment's order, reservation and then product, or the loop closes.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.offers_v2 (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  store_product_id uuid not null references public.store_products (id) on delete cascade,
  title text not null,
  category text not null,
  image_url text,
  contents jsonb not null default '[]'::jsonb,
  offer_price_uzs int not null check (offer_price_uzs > 0),
  reference_price_uzs int,
  quantity_total int not null check (quantity_total > 0),
  quantity_available int not null check (quantity_available >= 0),
  pickup_start timestamptz not null,
  pickup_end timestamptz not null check (pickup_end > pickup_start),
  allergens jsonb not null default '[]'::jsonb,
  dietary_badges jsonb not null default '[]'::jsonb,
  pickup_instructions text,
  cancellation_policy text,
  status text not null default 'live'
    check (status in ('live', 'paused', 'sold_out', 'expired', 'withdrawn')),
  physically_set_aside boolean not null default false,
  last_verified_at timestamptz,
  version int not null default 1,
  publish_idempotency_key text not null,
  approved_by uuid references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  unique (store_id, publish_idempotency_key)
);

create table if not exists public.reservations_v2 (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers_v2 (id) on delete cascade,
  installation_id text not null,
  client_reservation_id text not null,
  status text not null default 'held'
    check (status in (
      'held',
      'fulfilled',
      'cancelled_by_buyer',
      'cancelled_by_seller',
      'expired_no_show',
      'failed_stock_mismatch'
    )),
  pickup_code_hash text not null,
  pickup_code_hint text not null,
  hold_expires_at timestamptz not null,
  offer_snapshot jsonb not null,
  version int not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (installation_id, client_reservation_id)
);

create index if not exists reservations_v2_installation_id_idx
  on public.reservations_v2 (installation_id);

create index if not exists reservations_v2_offer_id_idx
  on public.reservations_v2 (offer_id);

create index if not exists reservations_v2_pickup_code_hash_idx
  on public.reservations_v2 (pickup_code_hash);

create table if not exists public.buyer_idempotency_keys (
  installation_id text not null,
  command text not null,
  key text not null,
  fingerprint text not null,
  outcome jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (installation_id, command, key)
);

create table if not exists public.store_exceptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  kind text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  related_offer_id uuid references public.offers_v2 (id) on delete set null,
  related_store_product_id uuid references public.store_products (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

-- At most one open stock mismatch per offer. The encumbrance arithmetic in
-- publish_offer_v2 asks whether an open mismatch exists for an offer, a
-- question that only has a sane answer while there is exactly one such row.
-- Two open rows would also leave the resolution flow guessing which one a
-- member just closed. related_offer_id is nullable and nulls are distinct
-- in a unique index, so exceptions not tied to an offer are unaffected.
create unique index if not exists store_exceptions_open_stock_mismatch_idx
  on public.store_exceptions (related_offer_id)
  where kind = 'stock_mismatch' and status = 'open';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'offer_allocations_offer_id_fkey'
      and conrelid = 'public.offer_allocations'::regclass
  ) then
    alter table public.offer_allocations
      add constraint offer_allocations_offer_id_fkey
      foreign key (offer_id) references public.offers_v2 (id) on delete cascade;
  end if;
end;
$$;

alter table public.offers_v2 enable row level security;
alter table public.reservations_v2 enable row level security;
alter table public.buyer_idempotency_keys enable row level security;
alter table public.store_exceptions enable row level security;

drop policy if exists "offers_v2_select_members" on public.offers_v2;

create policy "offers_v2_select_members"
  on public.offers_v2
  for select
  to authenticated
  using (public.fn_current_store_role(store_id) is not null);

revoke all on table public.offers_v2 from anon, authenticated;
revoke all on table public.reservations_v2 from anon, authenticated;
revoke all on table public.buyer_idempotency_keys from anon, authenticated;
revoke all on table public.store_exceptions from anon, authenticated;
grant select on table public.offers_v2 to authenticated;

create or replace view public.marketplace_offers_v2_public
with (security_invoker = false)
as
select
  o.id,
  o.version,
  o.store_id,
  s.name as store_name,
  s.address,
  s.latitude,
  s.longitude,
  o.title,
  o.category,
  o.image_url,
  o.contents,
  o.offer_price_uzs,
  o.reference_price_uzs,
  case
    when o.reference_price_uzs is null then null
    else round((1 - o.offer_price_uzs::numeric / o.reference_price_uzs::numeric) * 100)::int
  end as discount_percent,
  o.quantity_available,
  o.pickup_start,
  o.pickup_end,
  o.allergens,
  o.dietary_badges,
  o.pickup_instructions,
  o.cancellation_policy,
  o.last_verified_at,
  o.status
from public.offers_v2 o
join public.stores s on s.id = o.store_id
where o.status in ('live', 'sold_out')
  and o.pickup_end > now();

revoke all on table public.marketplace_offers_v2_public from public;
grant select on table public.marketplace_offers_v2_public to anon, authenticated;

-- The zero argument form is dropped so a database that already ran an
-- earlier version of this migration does not keep a stale overload around
-- next to the scoped one below. A fresh reset never has it, so the drop is
-- a no op there.
drop function if exists public.fn_apply_offer_reservation_expiry_v2();

-- Lazy expiry sweep. p_offer_id null keeps the original global behaviour,
-- used by the two list RPCs whose result sets are global anyway. Every
-- single offer RPC passes its own offer id, which turns a whole table scan
-- that touched arbitrary offers in arbitrary order into a scan bounded by
-- one offer. That matters for lock ordering, a global sweep called from
-- seven entry points takes row locks on whatever happens to be expired at
-- that moment, in whatever order the plan produces, which is exactly the
-- shape that deadlocks under concurrency.
--
-- publish_offer_v2 is the one mutation that stays global, on purpose. It
-- has no offer id yet, and its allocation ceiling sums over every sibling
-- offer of the same product, so a stale held reservation on any of those
-- siblings would inflate the encumbrance and reject a legitimate publish.
-- Correct ceiling arithmetic wins over a narrower sweep on what is a low
-- frequency seller action.
create or replace function public.fn_apply_offer_reservation_expiry_v2(
  p_offer_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired record;
  v_release record;
begin
  set local row_security = off;

  for v_expired in
    update public.offers_v2
      set status = 'expired'
      where status in ('live', 'sold_out', 'paused')
        and pickup_end <= now()
        and (p_offer_id is null or id = p_offer_id)
      returning id
  loop
    -- An offer that leaves the live or sold out pool no longer encumbers
    -- its product, so the allocation row must not stay active forever.
    update public.offer_allocations
      set status = 'released'
      where offer_id = v_expired.id
        and status = 'active';
  end loop;

  -- Releases are grouped per offer and applied in offer id order. The
  -- end state is identical to releasing one unit at a time, one version
  -- bump and one unit per expired hold, but the offer rows are now locked
  -- in a fixed order rather than in whatever order the expired holds came
  -- back in.
  for v_release in
    with expired_holds as (
      update public.reservations_v2
        set status = 'expired_no_show',
            version = version + 1,
            updated_at = now()
        where status = 'held'
          and hold_expires_at <= now()
          and (p_offer_id is null or offer_id = p_offer_id)
        returning offer_id
    )
    select offer_id, count(*)::int as released
      from expired_holds
      group by offer_id
      order by offer_id
  loop
    update public.offers_v2
      set quantity_available = least(
            quantity_available + v_release.released,
            quantity_total
          ),
          version = version + v_release.released,
          status = case
            when status = 'sold_out' and pickup_end > now() then 'live'
            else status
          end
      where id = v_release.offer_id;
  end loop;
end;
$$;

revoke execute on function public.fn_apply_offer_reservation_expiry_v2(uuid) from public;

create or replace function public.publish_offer_v2(
  p_store_id uuid,
  p_input jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_fingerprint text;
  v_claimed_key text;
  v_existing_fingerprint text;
  v_outcome jsonb;
  v_product public.store_products%rowtype;
  v_offer public.offers_v2%rowtype;
  v_store_product_id uuid;
  v_quantity int;
  v_physically_set_aside boolean;
  v_offer_price int;
  v_reference_price int;
  v_pickup_start timestamptz;
  v_pickup_end timestamptz;
  v_allocated int;
  v_max_offerable int;
begin
  set local row_security = off;

  v_role := public.fn_current_store_role(p_store_id);
  if v_role is null or v_role not in ('manager', 'owner') then
    raise exception 'forbidden: role % may not publish offers', coalesce(v_role, 'none');
  end if;

  if coalesce(p_idempotency_key, '') = '' then
    raise exception 'validation_failed: idempotency key is required';
  end if;

  v_fingerprint := encode(extensions.digest(p_input::text, 'sha256'), 'hex');

  -- Bounded claim step. on conflict do nothing does not return straight away
  -- when the conflicting row belongs to a transaction that has not committed
  -- yet, it blocks on that transaction id until it commits or aborts. A rival
  -- that stalls used to pin this caller for as long as the stall lasted, with
  -- no timeout of its own. lock_timeout caps that wait at four seconds and the
  -- handler turns the resulting 55P03 into the contracted idempotency_conflict
  -- shape, so a stalled duplicate costs a bounded wait and an honest error
  -- rather than a hung connection. The timeout is reset immediately afterwards
  -- so the row locks taken further down keep their normal blocking behaviour.
  -- Every claim step in this file follows this same pattern.
  begin
    set local lock_timeout = '4s';

    insert into public.idempotency_keys (store_id, command, key, fingerprint, outcome)
    values (p_store_id, 'publish_offer_v2', p_idempotency_key, v_fingerprint, null)
    on conflict (store_id, command, key) do nothing
    returning key into v_claimed_key;

    set local lock_timeout = default;
  exception when lock_not_available then
    raise exception 'idempotency_conflict: concurrent duplicate command still in flight';
  end;

  if v_claimed_key is null then
    select fingerprint, outcome
      into v_existing_fingerprint, v_outcome
      from public.idempotency_keys
      where store_id = p_store_id
        and command = 'publish_offer_v2'
        and key = p_idempotency_key;

    if v_existing_fingerprint is distinct from v_fingerprint then
      raise exception 'idempotency_conflict: key reused with different input';
    end if;
    if v_outcome is null then
      raise exception 'idempotency_conflict: concurrent duplicate still in flight';
    end if;
    return v_outcome;
  end if;

  -- Global on purpose, see the sweep definition. The allocation ceiling
  -- below reads every sibling offer of this product.
  perform public.fn_apply_offer_reservation_expiry_v2(null::uuid);

  begin
    v_store_product_id := (p_input -> 'allocation' ->> 'storeProductId')::uuid;
    v_quantity := (p_input -> 'allocation' ->> 'quantity')::int;
    v_physically_set_aside := coalesce(
      (p_input -> 'allocation' ->> 'physicallySetAside')::boolean,
      false
    );
    v_offer_price := (p_input ->> 'offerPriceUzs')::int;
    v_reference_price := (p_input ->> 'referencePriceUzs')::int;
    v_pickup_start := (p_input ->> 'pickupStart')::timestamptz;
    v_pickup_end := (p_input ->> 'pickupEnd')::timestamptz;
  exception when others then
    raise exception 'validation_failed: malformed offer input';
  end;

  if v_quantity is null or v_quantity < 1 then
    raise exception 'validation_failed: allocation quantity must be at least one';
  end if;
  if v_offer_price is null or v_offer_price <= 0 then
    raise exception 'validation_failed: offer price must be positive';
  end if;
  if v_reference_price is not null and v_reference_price < v_offer_price then
    raise exception 'validation_failed: reference price must be at least the offer price';
  end if;
  if v_pickup_start is null or v_pickup_end is null or v_pickup_end <= v_pickup_start then
    raise exception 'validation_failed: pickup end must be after pickup start';
  end if;
  if v_pickup_start <= now() then
    raise exception 'validation_failed: pickup window must be in the future';
  end if;
  if coalesce(p_input ->> 'title', '') = '' or coalesce(p_input ->> 'category', '') = '' then
    raise exception 'validation_failed: title and category are required';
  end if;

  select *
    into v_product
    from public.store_products
    where id = v_store_product_id
      and store_id = p_store_id
    for update;

  if not found then
    raise exception 'not_found: product % is not in store %', v_store_product_id, p_store_id;
  end if;

  -- Food safety rule. The comparison is against the end of the pickup
  -- window, not against today. A product that expires while the window is
  -- still open would otherwise be handed over after its expiry date, so a
  -- product must outlast the last moment a buyer can collect it.
  if v_product.expiry_date is not null
     and v_product.expiry_date < (v_pickup_end at time zone 'UTC')::date then
    raise exception 'validation_failed: product % expires on % before pickup ends %',
      v_product.id, v_product.expiry_date, v_pickup_end;
  end if;

  select coalesce(sum(
    case
      when o.status in ('live', 'paused', 'sold_out')
        then o.quantity_available + reservation_counts.held
      else 0
    end
    + reservation_counts.failed_mismatch
  ), 0)::int
    into v_allocated
    from public.offers_v2 o
    cross join lateral (
      select
        count(*) filter (where r.status = 'held')::int as held,
        count(*) filter (
          where r.status = 'failed_stock_mismatch'
            and exists (
              select 1
              from public.store_exceptions e
              where e.related_offer_id = o.id
                and e.kind = 'stock_mismatch'
                and e.status = 'open'
            )
        )::int as failed_mismatch
      from public.reservations_v2 r
      where r.offer_id = o.id
    ) reservation_counts
    where o.store_product_id = v_product.id;

  if v_product.confidence = 'high' then
    v_max_offerable := greatest(0, v_product.on_hand_quantity - v_allocated);
  elsif v_physically_set_aside then
    v_max_offerable := v_quantity;
  else
    v_max_offerable := 0;
  end if;

  if v_quantity > v_max_offerable then
    raise exception 'allocation_exceeded: allocation of % exceeds offerable maximum of %',
      v_quantity, v_max_offerable;
  end if;

  insert into public.offers_v2 (
    store_id,
    store_product_id,
    title,
    category,
    image_url,
    contents,
    offer_price_uzs,
    reference_price_uzs,
    quantity_total,
    quantity_available,
    pickup_start,
    pickup_end,
    allergens,
    dietary_badges,
    pickup_instructions,
    cancellation_policy,
    status,
    physically_set_aside,
    last_verified_at,
    publish_idempotency_key,
    approved_by
  ) values (
    p_store_id,
    v_product.id,
    p_input ->> 'title',
    p_input ->> 'category',
    p_input ->> 'imageUrl',
    coalesce(p_input -> 'contents', '[]'::jsonb),
    v_offer_price,
    v_reference_price,
    v_quantity,
    v_quantity,
    v_pickup_start,
    v_pickup_end,
    coalesce(p_input -> 'allergens', '[]'::jsonb),
    coalesce(p_input -> 'dietaryBadges', '[]'::jsonb),
    p_input ->> 'pickupInstructions',
    p_input ->> 'cancellationPolicy',
    'live',
    v_physically_set_aside,
    coalesce(v_product.last_verified_at, now()),
    p_idempotency_key,
    auth.uid()
  ) returning * into v_offer;

  insert into public.offer_allocations (
    store_id, offer_id, store_product_id, quantity, status
  ) values (
    p_store_id, v_offer.id, v_product.id, v_quantity, 'active'
  );

  v_outcome := to_jsonb(v_offer);

  update public.idempotency_keys
    set outcome = v_outcome
    where store_id = p_store_id
      and command = 'publish_offer_v2'
      and key = p_idempotency_key;

  insert into public.outbox_events (event_type, payload)
  values ('offer_published', jsonb_build_object(
    'storeId', p_store_id,
    'offerId', v_offer.id,
    'quantity', v_quantity
  ));

  insert into public.audit_entries (store_id, actor, command, detail)
  values (p_store_id, auth.uid()::text, 'publish_offer_v2', jsonb_build_object('offerId', v_offer.id));

  return v_outcome;
end;
$$;

revoke execute on function public.publish_offer_v2(uuid, jsonb, text) from public;
grant execute on function public.publish_offer_v2(uuid, jsonb, text) to authenticated;

create or replace function public.reserve_offer_v2(
  p_offer_id uuid,
  p_client_reservation_id text,
  p_installation_id text,
  p_expected_offer_version int,
  p_pickup_code text,
  p_pickup_code_hash text,
  p_pickup_code_hint text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn_reserve_v2$
declare
  v_existing public.reservations_v2%rowtype;
  v_offer public.offers_v2%rowtype;
  v_reservation public.reservations_v2%rowtype;
  v_snapshot jsonb;
  v_computed_hash text;
  v_reservation_json jsonb;
  v_reservation_change_count int;
begin
  set local row_security = off;

  if coalesce(p_installation_id, '') = '' or coalesce(p_client_reservation_id, '') = '' then
    raise exception 'validation_failed: installation and client reservation ids are required';
  end if;
  if p_expected_offer_version is null then
    raise exception 'validation_failed: expected offer version is required';
  end if;
  if coalesce(p_pickup_code, '') = '' or coalesce(p_pickup_code_hint, '') = '' then
    raise exception 'validation_failed: pickup code and hint are required';
  end if;
  if p_pickup_code_hint <> right(p_pickup_code, 2) then
    raise exception 'validation_failed: pickup code hint does not match plaintext code';
  end if;

  v_computed_hash := encode(extensions.digest(p_pickup_code, 'sha256'), 'hex');
  if v_computed_hash is distinct from lower(p_pickup_code_hash) then
    raise exception 'validation_failed: pickup code hash does not match plaintext code';
  end if;

  -- Bounded advisory lock, same shape as the claim steps in the seller
  -- RPCs. This lock serialises duplicates of one command key, so a caller
  -- that stalls mid transaction would otherwise pin every retry behind it
  -- for as long as the stall lasts. Four seconds is far above the time an
  -- honest duplicate needs and turns a hung connection into the contracted
  -- idempotency_conflict shape.
  begin
    set local lock_timeout = '4s';

    perform pg_advisory_xact_lock(hashtextextended(
      p_installation_id || chr(58) || p_client_reservation_id,
      0
    ));

    set local lock_timeout = default;
  exception when lock_not_available then
    raise exception 'idempotency_conflict: concurrent duplicate command still in flight';
  end;

  -- The sweep runs before the replay lookup, not after it. A client that
  -- replays a reservation whose hold has already lapsed has to read
  -- expired_no_show, and it can only do that if the sweep has already
  -- moved the row. Reading first would hand back a stale held.
  perform public.fn_apply_offer_reservation_expiry_v2(p_offer_id);

  select *
    into v_existing
    from public.reservations_v2
    where installation_id = p_installation_id
      and client_reservation_id = p_client_reservation_id;

  if found then
    v_reservation_json := to_jsonb(v_existing)
      - array['pickup_code_hash', 'installation_id', 'client_reservation_id']
      || jsonb_build_object('quantity', 1);
    return jsonb_build_object(
      'reservation', v_reservation_json,
      'pickup_code', null,
      'replayed', true
    );
  end if;

  update public.offers_v2
    set quantity_available = quantity_available - 1,
        version = version + 1,
        status = case
          when quantity_available - 1 = 0 then 'sold_out'
          else status
        end
    where id = p_offer_id
      and status = 'live'
      and quantity_available > 0
    returning * into v_offer;

  if not found then
    select * into v_offer from public.offers_v2 where id = p_offer_id;
    if not found then
      raise exception 'not_found: offer % does not exist', p_offer_id;
    end if;
    if v_offer.status not in ('live', 'sold_out') then
      raise exception 'offer_not_live: offer % is %', p_offer_id, v_offer.status;
    end if;
    if v_offer.quantity_available = 0 then
      raise exception 'sold_out: offer % has no units left', p_offer_id;
    end if;
    raise exception 'version_conflict: offer % expected version % but found %',
      p_offer_id, p_expected_offer_version, v_offer.version;
  end if;

  select count(*)::int
    into v_reservation_change_count
    from public.stock_movements sm
    join public.reservations_v2 r on r.id = sm.ref_id
    where r.offer_id = p_offer_id
      and sm.kind in ('reservation_hold', 'reservation_release');

  -- Monotonic version rule. v_offer.version - 1 is the version this offer
  -- carried when the caller's own reserve landed, so it is the newest
  -- version any honest caller can claim to have read. Anything above that
  -- is a client reporting a version that never existed. Below it, the
  -- caller is stale by exactly the number of bumps it missed, and that gap
  -- is acceptable only while every missed bump can be explained by
  -- reservation traffic, holds and releases, which never change the terms
  -- of the offer the buyer agreed to. A pause, a price edit, or any other
  -- seller change bumps the version without leaving a reservation
  -- movement behind, so it pushes the gap past what the movements explain
  -- and the stale caller is rejected.
  --
  -- The earlier rule accepted only two exact versions, the current one and
  -- the publish era one, which rejected every version in between. That was
  -- not monotonic, a fresher client could be rejected while a staler one
  -- sailed through. An inequality fixes the ordering.
  if p_expected_offer_version > v_offer.version - 1
     or v_offer.version - 1 - p_expected_offer_version > v_reservation_change_count then
    raise exception 'version_conflict: offer % expected version % but found %',
      p_offer_id, p_expected_offer_version, v_offer.version - 1;
  end if;

  select to_jsonb(m)
    into v_snapshot
    from public.marketplace_offers_v2_public m
    where m.id = p_offer_id;

  if v_snapshot is null then
    raise exception 'offer_not_live: offer % is not visible', p_offer_id;
  end if;

  insert into public.reservations_v2 (
    offer_id,
    installation_id,
    client_reservation_id,
    status,
    pickup_code_hash,
    pickup_code_hint,
    hold_expires_at,
    offer_snapshot
  ) values (
    p_offer_id,
    p_installation_id,
    p_client_reservation_id,
    'held',
    v_computed_hash,
    p_pickup_code_hint,
    v_offer.pickup_end,
    v_snapshot
  ) returning * into v_reservation;

  insert into public.stock_movements (store_id, store_product_id, delta, kind, ref_id)
  values (v_offer.store_id, v_offer.store_product_id, 0, 'reservation_hold', v_reservation.id);

  insert into public.outbox_events (event_type, payload)
  values ('reservation_held', jsonb_build_object(
    'storeId', v_offer.store_id,
    'offerId', v_offer.id,
    'reservationId', v_reservation.id
  ));

  insert into public.audit_entries (store_id, actor, command, detail)
  values (
    v_offer.store_id,
    'installation' || chr(58) || p_installation_id,
    'reserve_offer_v2',
    jsonb_build_object('offerId', v_offer.id, 'reservationId', v_reservation.id)
  );

  v_reservation_json := to_jsonb(v_reservation)
    - array['pickup_code_hash', 'installation_id', 'client_reservation_id']
    || jsonb_build_object('quantity', 1);

  return jsonb_build_object(
    'reservation', v_reservation_json,
    'pickup_code', p_pickup_code,
    'replayed', false
  );
end;
$fn_reserve_v2$;

revoke execute on function public.reserve_offer_v2(uuid, text, text, int, text, text, text) from public;
grant execute on function public.reserve_offer_v2(uuid, text, text, int, text, text, text)
  to anon, authenticated;

create or replace function public.cancel_reservation_v2(
  p_reservation_id uuid,
  p_installation_id text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fingerprint text;
  v_claimed_key text;
  v_existing_fingerprint text;
  v_outcome jsonb;
  v_reservation public.reservations_v2%rowtype;
  v_offer public.offers_v2%rowtype;
  v_sweep_offer_id uuid;
begin
  set local row_security = off;

  if coalesce(p_installation_id, '') = '' or coalesce(p_idempotency_key, '') = '' then
    raise exception 'validation_failed: installation and idempotency key are required';
  end if;

  v_fingerprint := p_reservation_id::text;
  -- Bounded claim step, see publish_offer_v2 for why the wait is capped.
  begin
    set local lock_timeout = '4s';

    insert into public.buyer_idempotency_keys (
      installation_id, command, key, fingerprint, outcome
    ) values (
      p_installation_id, 'cancel_reservation_v2', p_idempotency_key, v_fingerprint, null
    )
    on conflict (installation_id, command, key) do nothing
    returning key into v_claimed_key;

    set local lock_timeout = default;
  exception when lock_not_available then
    raise exception 'idempotency_conflict: concurrent duplicate command still in flight';
  end;

  if v_claimed_key is null then
    select fingerprint, outcome
      into v_existing_fingerprint, v_outcome
      from public.buyer_idempotency_keys
      where installation_id = p_installation_id
        and command = 'cancel_reservation_v2'
        and key = p_idempotency_key;
    if v_existing_fingerprint is distinct from v_fingerprint then
      raise exception 'idempotency_conflict: key reused with different input';
    end if;
    if v_outcome is null then
      raise exception 'idempotency_conflict: concurrent duplicate still in flight';
    end if;
    return v_outcome;
  end if;

  -- Resolve the offer first so the sweep can be scoped to it. A reservation
  -- id that matches nothing skips the sweep entirely, the select below
  -- raises not_found for that case anyway and a bogus id is no reason to
  -- scan every offer in the table.
  select offer_id
    into v_sweep_offer_id
    from public.reservations_v2
    where id = p_reservation_id;

  if v_sweep_offer_id is not null then
    perform public.fn_apply_offer_reservation_expiry_v2(v_sweep_offer_id);
  end if;

  -- Lock order: OFFER first, then the reservation. See the global rule at the
  -- top of this file. This path used to take the reservation first and reach
  -- the offer only through its release update, while the expiry sweep and
  -- report_stock_mismatch_v2 both walk offer then reservation, which is a
  -- lock order cycle. Under concurrency Postgres resolves that with a raw
  -- 40P01 deadlock error, a code the buyer contract has no shape for, so it
  -- surfaced to the buyer as unknown.
  --
  -- The offer id came from an unlocked read above, so nothing is decided on
  -- it. Both rows are re-read under their locks below and every check runs
  -- against those locked copies, so a reservation that was fulfilled, expired,
  -- or mismatched while this call waited for the offer is caught rather than
  -- acted on.
  perform 1
    from public.offers_v2
    where id = v_sweep_offer_id
    for update;

  select *
    into v_reservation
    from public.reservations_v2
    where id = p_reservation_id
    for update;

  if not found then
    raise exception 'not_found: reservation % does not exist', p_reservation_id;
  end if;
  if v_reservation.offer_id is distinct from v_sweep_offer_id then
    -- Defensive. offer_id is never reassigned, so this only fires if the
    -- reservation row was replaced underneath this call, in which case the
    -- offer this transaction holds is the wrong one and acting on it would
    -- release a unit of an offer nobody reserved.
    raise exception 'invalid_state: reservation % changed offer while locking', p_reservation_id;
  end if;
  if v_reservation.installation_id <> p_installation_id then
    raise exception 'forbidden: reservation belongs to another installation';
  end if;
  if v_reservation.status <> 'held' then
    raise exception 'invalid_state: reservation % is %', p_reservation_id, v_reservation.status;
  end if;

  update public.reservations_v2
    set status = 'cancelled_by_buyer',
        version = version + 1,
        updated_at = now()
    where id = p_reservation_id
    returning * into v_reservation;

  update public.offers_v2
    set quantity_available = quantity_available + 1,
        version = version + 1,
        status = case
          when status = 'sold_out' and pickup_end > now() then 'live'
          else status
        end
    where id = v_reservation.offer_id
    returning * into v_offer;

  insert into public.stock_movements (store_id, store_product_id, delta, kind, ref_id)
  values (v_offer.store_id, v_offer.store_product_id, 0, 'reservation_release', v_reservation.id);

  insert into public.outbox_events (event_type, payload)
  values ('reservation_cancelled', jsonb_build_object(
    'storeId', v_offer.store_id,
    'offerId', v_offer.id,
    'reservationId', v_reservation.id
  ));

  insert into public.audit_entries (store_id, actor, command, detail)
  values (
    v_offer.store_id,
    'installation' || chr(58) || p_installation_id,
    'cancel_reservation_v2',
    jsonb_build_object('reservationId', v_reservation.id)
  );

  v_outcome := to_jsonb(v_reservation)
    - array['pickup_code_hash', 'installation_id', 'client_reservation_id']
    || jsonb_build_object('quantity', 1);

  update public.buyer_idempotency_keys
    set outcome = v_outcome
    where installation_id = p_installation_id
      and command = 'cancel_reservation_v2'
      and key = p_idempotency_key;

  return v_outcome;
end;
$$;

revoke execute on function public.cancel_reservation_v2(uuid, text, text) from public;
grant execute on function public.cancel_reservation_v2(uuid, text, text) to anon, authenticated;

create or replace function public.get_buyer_reservations_v2(p_installation_id text)
returns table (
  id uuid,
  version int,
  offer_id uuid,
  status text,
  quantity int,
  offer_snapshot jsonb,
  pickup_code_hint text,
  hold_expires_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  set local row_security = off;
  if coalesce(p_installation_id, '') = '' then
    raise exception 'validation_failed: installation id is required';
  end if;
  -- Global, this read is not scoped to one offer either.
  perform public.fn_apply_offer_reservation_expiry_v2(null::uuid);
  return query
    select
      r.id,
      r.version,
      r.offer_id,
      r.status,
      1,
      r.offer_snapshot,
      r.pickup_code_hint,
      r.hold_expires_at,
      r.created_at,
      r.updated_at
    from public.reservations_v2 r
    where r.installation_id = p_installation_id
    order by r.created_at desc, r.id desc;
end;
$$;

revoke execute on function public.get_buyer_reservations_v2(text) from public;
grant execute on function public.get_buyer_reservations_v2(text) to anon, authenticated;

create or replace function public.pause_offer_v2(
  p_store_id uuid,
  p_offer_id uuid,
  p_idempotency_key text,
  p_expected_version int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_fingerprint text;
  v_claimed_key text;
  v_existing_fingerprint text;
  v_outcome jsonb;
  v_offer public.offers_v2%rowtype;
begin
  set local row_security = off;
  v_role := public.fn_current_store_role(p_store_id);
  if v_role is null or v_role not in ('manager', 'owner') then
    raise exception 'forbidden: role % may not pause offers', coalesce(v_role, 'none');
  end if;
  if coalesce(p_idempotency_key, '') = '' or p_expected_version is null then
    raise exception 'validation_failed: idempotency key and expected version are required';
  end if;

  v_fingerprint := p_offer_id::text;
  -- Bounded claim step, see publish_offer_v2 for why the wait is capped.
  begin
    set local lock_timeout = '4s';

    insert into public.idempotency_keys (store_id, command, key, fingerprint, outcome)
    values (p_store_id, 'pause_offer_v2', p_idempotency_key, v_fingerprint, null)
    on conflict (store_id, command, key) do nothing
    returning key into v_claimed_key;

    set local lock_timeout = default;
  exception when lock_not_available then
    raise exception 'idempotency_conflict: concurrent duplicate command still in flight';
  end;

  if v_claimed_key is null then
    select fingerprint, outcome
      into v_existing_fingerprint, v_outcome
      from public.idempotency_keys
      where store_id = p_store_id and command = 'pause_offer_v2' and key = p_idempotency_key;
    if v_existing_fingerprint is distinct from v_fingerprint then
      raise exception 'idempotency_conflict: key reused with different input';
    end if;
    if v_outcome is null then
      raise exception 'idempotency_conflict: concurrent duplicate still in flight';
    end if;
    return v_outcome;
  end if;

  perform public.fn_apply_offer_reservation_expiry_v2(p_offer_id);
  select * into v_offer
    from public.offers_v2
    where id = p_offer_id and store_id = p_store_id
    for update;
  if not found then
    raise exception 'not_found: offer % is not in store %', p_offer_id, p_store_id;
  end if;
  if v_offer.version <> p_expected_version then
    raise exception 'version_conflict: offer % expected version % but found %',
      p_offer_id, p_expected_version, v_offer.version;
  end if;
  if v_offer.status <> 'live' then
    raise exception 'invalid_state: offer % is %', p_offer_id, v_offer.status;
  end if;

  update public.offers_v2
    set status = 'paused', version = version + 1
    where id = p_offer_id
    returning * into v_offer;

  -- A paused offer is out of the live and sold out pool, so it stops
  -- encumbering its product and the allocation row is released.
  update public.offer_allocations
    set status = 'released'
    where offer_id = p_offer_id
      and status = 'active';

  v_outcome := to_jsonb(v_offer);
  update public.idempotency_keys set outcome = v_outcome
    where store_id = p_store_id and command = 'pause_offer_v2' and key = p_idempotency_key;
  insert into public.outbox_events (event_type, payload)
  values ('offer_paused', jsonb_build_object('storeId', p_store_id, 'offerId', p_offer_id));
  insert into public.audit_entries (store_id, actor, command, detail)
  values (p_store_id, auth.uid()::text, 'pause_offer_v2', jsonb_build_object('offerId', p_offer_id));
  return v_outcome;
end;
$$;

revoke execute on function public.pause_offer_v2(uuid, uuid, text, int) from public;
grant execute on function public.pause_offer_v2(uuid, uuid, text, int) to authenticated;

create or replace function public.fulfill_reservation_v2(
  p_store_id uuid,
  p_pickup_code text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_fingerprint text;
  v_claimed_key text;
  v_existing_fingerprint text;
  v_outcome jsonb;
  v_hash text;
  v_reservation public.reservations_v2%rowtype;
  v_offer public.offers_v2%rowtype;
  v_on_hand int;
  v_applied_delta int;
begin
  set local row_security = off;
  v_role := public.fn_current_store_role(p_store_id);
  if v_role is null or v_role not in ('manager', 'owner') then
    raise exception 'forbidden: role % may not fulfill reservations', coalesce(v_role, 'none');
  end if;
  if coalesce(p_pickup_code, '') = '' or coalesce(p_idempotency_key, '') = '' then
    raise exception 'validation_failed: pickup code and idempotency key are required';
  end if;

  v_hash := encode(extensions.digest(p_pickup_code, 'sha256'), 'hex');
  v_fingerprint := v_hash;
  -- Bounded claim step, see publish_offer_v2 for why the wait is capped.
  begin
    set local lock_timeout = '4s';

    insert into public.idempotency_keys (store_id, command, key, fingerprint, outcome)
    values (p_store_id, 'fulfill_reservation_v2', p_idempotency_key, v_fingerprint, null)
    on conflict (store_id, command, key) do nothing
    returning key into v_claimed_key;

    set local lock_timeout = default;
  exception when lock_not_available then
    raise exception 'idempotency_conflict: concurrent duplicate command still in flight';
  end;

  if v_claimed_key is null then
    select fingerprint, outcome into v_existing_fingerprint, v_outcome
      from public.idempotency_keys
      where store_id = p_store_id and command = 'fulfill_reservation_v2' and key = p_idempotency_key;
    if v_existing_fingerprint is distinct from v_fingerprint then
      raise exception 'idempotency_conflict: key reused with different input';
    end if;
    if v_outcome is null then
      raise exception 'idempotency_conflict: concurrent duplicate still in flight';
    end if;
    return v_outcome;
  end if;

  select r.* into v_reservation
    from public.reservations_v2 r
    join public.offers_v2 o on o.id = r.offer_id
    where o.store_id = p_store_id
      and r.pickup_code_hash = v_hash
    order by case
      when r.status = 'held' and r.hold_expires_at > now() then 0
      when r.status = 'held' then 1
      else 2
    end, r.created_at desc
    limit 1
    for update of r;
  if not found then
    raise exception 'not_found: no reservation matches that pickup code in this store';
  end if;
  if v_reservation.hold_expires_at <= now() then
    raise exception 'invalid_state: reservation % expired at %',
      v_reservation.id, v_reservation.hold_expires_at;
  end if;
  if v_reservation.status <> 'held' then
    raise exception 'invalid_state: reservation % is %', v_reservation.id, v_reservation.status;
  end if;

  select * into v_offer from public.offers_v2 where id = v_reservation.offer_id;
  select on_hand_quantity into v_on_hand
    from public.store_products
    where id = v_offer.store_product_id
    for update;
  if not found then
    raise exception 'not_found: product % does not exist', v_offer.store_product_id;
  end if;
  -- Which stock a handover actually comes out of depends on how the offer was
  -- published.
  --
  -- A physically set aside offer is backed by units the seller pulled off the
  -- shelf at publish time, which is exactly why publish_offer_v2 allowed its
  -- allocation to exceed what the ledger claimed to hold. Those units are real
  -- and the buyer standing at the counter is entitled to one, so a ledger that
  -- has already run down to zero is a stale record here, not a reason to
  -- refuse a handover the store can plainly perform. Fulfillment therefore
  -- decrements with a floor at zero and never fails on ledger shortage, and
  -- the stock_movements row carries the delta that was actually applied, 0 or
  -- -1, rather than a fabricated -1, so the movement ledger keeps summing to
  -- the true on_hand.
  --
  -- Every other offer is backed by the ledger and by nothing else, so the
  -- strict guard stays, a negative on_hand would mean the store handed out
  -- stock it never had.
  if v_offer.physically_set_aside then
    v_applied_delta := case when v_on_hand > 0 then -1 else 0 end;
  else
    if v_on_hand - 1 < 0 then
      raise exception 'validation_failed: fulfillment would make stock negative';
    end if;
    v_applied_delta := -1;
  end if;

  update public.reservations_v2
    set status = 'fulfilled', version = version + 1, updated_at = now()
    where id = v_reservation.id
    returning * into v_reservation;
  update public.store_products
    set on_hand_quantity = on_hand_quantity + v_applied_delta, version = version + 1
    where id = v_offer.store_product_id;
  insert into public.stock_movements (store_id, store_product_id, delta, kind, ref_id)
  values (p_store_id, v_offer.store_product_id, v_applied_delta, 'fulfillment', v_reservation.id);

  v_outcome := jsonb_build_object(
    'reservation_id', v_reservation.id,
    'offer_id', v_reservation.offer_id,
    'offer_title', v_reservation.offer_snapshot ->> 'title',
    'status', v_reservation.status,
    'pickup_code_hint', v_reservation.pickup_code_hint,
    'hold_expires_at', v_reservation.hold_expires_at,
    'pickup_start', v_reservation.offer_snapshot ->> 'pickup_start',
    'pickup_end', v_reservation.offer_snapshot ->> 'pickup_end',
    'created_at', v_reservation.created_at,
    'version', v_reservation.version
  );
  update public.idempotency_keys set outcome = v_outcome
    where store_id = p_store_id and command = 'fulfill_reservation_v2' and key = p_idempotency_key;
  insert into public.outbox_events (event_type, payload)
  values ('reservation_fulfilled', jsonb_build_object(
    'storeId', p_store_id,
    'offerId', v_offer.id,
    'reservationId', v_reservation.id
  ));
  insert into public.audit_entries (store_id, actor, command, detail)
  values (p_store_id, auth.uid()::text, 'fulfill_reservation_v2', jsonb_build_object('reservationId', v_reservation.id));
  return v_outcome;
end;
$$;

revoke execute on function public.fulfill_reservation_v2(uuid, text, text) from public;
grant execute on function public.fulfill_reservation_v2(uuid, text, text) to authenticated;

create or replace function public.report_stock_mismatch_v2(
  p_store_id uuid,
  p_offer_id uuid,
  p_observed_quantity int,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_fingerprint text;
  v_claimed_key text;
  v_existing_fingerprint text;
  v_outcome jsonb;
  v_offer public.offers_v2%rowtype;
  v_exception public.store_exceptions%rowtype;
  v_failed record;
begin
  set local row_security = off;
  v_role := public.fn_current_store_role(p_store_id);
  if v_role is null or v_role not in ('manager', 'owner') then
    raise exception 'forbidden: role % may not report stock mismatch', coalesce(v_role, 'none');
  end if;
  if p_observed_quantity is null or p_observed_quantity < 0 or coalesce(p_reason, '') = '' then
    raise exception 'validation_failed: observed quantity and reason are required';
  end if;
  if coalesce(p_idempotency_key, '') = '' then
    raise exception 'validation_failed: idempotency key is required';
  end if;

  v_fingerprint := p_offer_id::text || chr(58) || chr(58) || p_observed_quantity::text || chr(58) || chr(58) || p_reason;
  -- Bounded claim step, see publish_offer_v2 for why the wait is capped.
  begin
    set local lock_timeout = '4s';

    insert into public.idempotency_keys (store_id, command, key, fingerprint, outcome)
    values (p_store_id, 'report_stock_mismatch_v2', p_idempotency_key, v_fingerprint, null)
    on conflict (store_id, command, key) do nothing
    returning key into v_claimed_key;

    set local lock_timeout = default;
  exception when lock_not_available then
    raise exception 'idempotency_conflict: concurrent duplicate command still in flight';
  end;

  if v_claimed_key is null then
    select fingerprint, outcome into v_existing_fingerprint, v_outcome
      from public.idempotency_keys
      where store_id = p_store_id and command = 'report_stock_mismatch_v2' and key = p_idempotency_key;
    if v_existing_fingerprint is distinct from v_fingerprint then
      raise exception 'idempotency_conflict: key reused with different input';
    end if;
    if v_outcome is null then
      raise exception 'idempotency_conflict: concurrent duplicate still in flight';
    end if;
    return v_outcome;
  end if;

  perform public.fn_apply_offer_reservation_expiry_v2(p_offer_id);
  select * into v_offer
    from public.offers_v2
    where id = p_offer_id and store_id = p_store_id
    for update;
  if not found then
    raise exception 'not_found: offer % is not in store %', p_offer_id, p_store_id;
  end if;
  if v_offer.status in ('expired', 'withdrawn') then
    raise exception 'invalid_state: offer % is %', p_offer_id, v_offer.status;
  end if;

  update public.offers_v2
    set status = 'paused', version = version + 1
    where id = p_offer_id
    returning * into v_offer;

  -- A mismatch pauses the offer, so it leaves the live and sold out pool
  -- and its allocation row is released along with it.
  update public.offer_allocations
    set status = 'released'
    where offer_id = p_offer_id
      and status = 'active';

  -- One open stock mismatch per offer, enforced by a partial unique index.
  -- A second report on the same offer under a different idempotency key is
  -- a real case, a member reporting again after finding one more bag
  -- missing, and it must not surface as a raw unique violation. The open
  -- exception is reused, and every other effect here, the pause and the
  -- failing of held reservations, is already idempotent.
  select * into v_exception
    from public.store_exceptions
    where related_offer_id = p_offer_id
      and kind = 'stock_mismatch'
      and status = 'open'
    for update;

  if not found then
    insert into public.store_exceptions (
      store_id, kind, message, status, related_offer_id, related_store_product_id
    ) values (
      p_store_id,
      'stock_mismatch',
      p_reason || ' (observed ' || p_observed_quantity || ')',
      'open',
      p_offer_id,
      v_offer.store_product_id
    ) returning * into v_exception;
  end if;

  for v_failed in
    update public.reservations_v2
      set status = 'failed_stock_mismatch', version = version + 1, updated_at = now()
      where offer_id = p_offer_id and status = 'held'
      returning id
  loop
    insert into public.outbox_events (event_type, payload)
    values ('reservation_failed_stock_mismatch', jsonb_build_object(
      'storeId', p_store_id,
      'offerId', p_offer_id,
      'reservationId', v_failed.id,
      'exceptionId', v_exception.id
    ));
  end loop;

  insert into public.outbox_events (event_type, payload)
  values ('offer_paused', jsonb_build_object(
    'storeId', p_store_id,
    'offerId', p_offer_id,
    'exceptionId', v_exception.id
  ));
  insert into public.audit_entries (store_id, actor, command, detail)
  values (p_store_id, auth.uid()::text, 'report_stock_mismatch_v2', jsonb_build_object(
    'offerId', p_offer_id,
    'exceptionId', v_exception.id,
    'observedQuantity', p_observed_quantity,
    'reason', p_reason
  ));

  v_outcome := jsonb_build_object('offer', to_jsonb(v_offer), 'exception', to_jsonb(v_exception));
  update public.idempotency_keys set outcome = v_outcome
    where store_id = p_store_id and command = 'report_stock_mismatch_v2' and key = p_idempotency_key;
  return v_outcome;
end;
$$;

revoke execute on function public.report_stock_mismatch_v2(uuid, uuid, int, text, text) from public;
grant execute on function public.report_stock_mismatch_v2(uuid, uuid, int, text, text) to authenticated;

create or replace function public.list_seller_pickups_v2(p_store_id uuid)
returns table (
  reservation_id uuid,
  offer_id uuid,
  offer_title text,
  status text,
  pickup_code_hint text,
  hold_expires_at timestamptz,
  pickup_start timestamptz,
  pickup_end timestamptz,
  created_at timestamptz,
  version int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  set local row_security = off;
  v_role := public.fn_current_store_role(p_store_id);
  if v_role is null then
    raise exception 'forbidden: caller is not a member of store %', p_store_id;
  end if;
  -- Global, this read is not scoped to one offer either.
  perform public.fn_apply_offer_reservation_expiry_v2(null::uuid);
  return query
    select
      r.id,
      r.offer_id,
      r.offer_snapshot ->> 'title',
      r.status,
      r.pickup_code_hint,
      r.hold_expires_at,
      (r.offer_snapshot ->> 'pickup_start')::timestamptz,
      (r.offer_snapshot ->> 'pickup_end')::timestamptz,
      r.created_at,
      r.version
    from public.reservations_v2 r
    join public.offers_v2 o on o.id = r.offer_id
    where o.store_id = p_store_id
    order by r.created_at desc, r.id desc;
end;
$$;

revoke execute on function public.list_seller_pickups_v2(uuid) from public;
grant execute on function public.list_seller_pickups_v2(uuid) to authenticated;

notify pgrst, 'reload schema';
