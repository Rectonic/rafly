-- Migration B: the v2 inventory ledger, count sessions, adjustment
-- proposals, append only stock movements, an offer allocation scaffold for
-- Task 6, the audit trail, the transactional outbox, and a shared
-- idempotency keys table. Sorts after the stores, memberships, roles, and
-- app flags migration, which this file depends on for
-- public.fn_current_store_role and public.stores.
--
-- Fix round 1 (review response): reordered the version and status checks
-- in approve_stock_adjustment_v2 to match the fake, added a fingerprint
-- column and a claim then fill in idempotency pattern to close a
-- concurrent duplicate key race, added a row lock plus an explicit non
-- negative check before applying a delta, added statement level truncate
-- triggers next to the existing row level ones, and changed the count
-- line ownership error from validation_failed to not_found to match the
-- fake. Each change is called out in place below.

create table if not exists public.store_products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  product_name text not null,
  barcode text,
  category text,
  on_hand_quantity int not null default 0 check (on_hand_quantity >= 0),
  confidence text not null default 'low' check (confidence in ('high', 'medium', 'low')),
  last_verified_at timestamptz,
  expiry_date date,
  version int not null default 1,
  created_at timestamptz not null default timezone('utc', now())
);

-- id has no default. The client supplies countSessionId, and the primary
-- key on that client supplied value is what gives record_inventory_count_v2
-- its idempotency, a second insert with the same id hits the conflict
-- branch below instead of raising a duplicate key error.
create table if not exists public.count_sessions (
  id uuid primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.stock_adjustment_proposals (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  store_product_id uuid not null references public.store_products (id) on delete cascade,
  current_quantity int not null,
  proposed_quantity int not null,
  delta int not null,
  reason text not null default 'count',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'applied')),
  created_by uuid not null references auth.users (id),
  created_by_role text not null,
  count_session_id uuid references public.count_sessions (id) on delete set null,
  version int not null default 1,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  store_product_id uuid not null references public.store_products (id) on delete cascade,
  delta int not null,
  kind text not null check (
    kind in ('adjustment', 'reservation_hold', 'reservation_release', 'fulfillment', 'mismatch_correction')
  ),
  ref_id uuid,
  created_at timestamptz not null default timezone('utc', now())
);

-- Scaffold for Task 6. offer_id stays a bare uuid with no foreign key for
-- now, offers_v2 does not exist until the next migration, Task 6 can add
-- the constraint additively once that table lands.
create table if not exists public.offer_allocations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  offer_id uuid,
  store_product_id uuid not null references public.store_products (id) on delete cascade,
  quantity int not null check (quantity > 0),
  status text not null default 'active' check (status in ('active', 'released', 'consumed')),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.audit_entries (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores (id) on delete set null,
  actor text not null,
  command text not null,
  detail jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.outbox_events (
  id bigserial primary key,
  event_type text not null,
  payload jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz
);

-- Shared by mutation RPCs that need idempotent replay of a command outcome,
-- starting with approve_stock_adjustment_v2 here. Scoped per store and per
-- command so two different commands, or the same command in two different
-- stores, can never collide on a caller supplied key. fingerprint and a
-- nullable outcome exist for the claim then fill in pattern used by
-- approve_stock_adjustment_v2, see Fix round 1 above, a caller claims the
-- key with a null outcome first, then updates it once the command actually
-- finishes, closing the race where two concurrent callers with the same
-- key both pass a plain select and then both try to insert.
create table if not exists public.idempotency_keys (
  store_id uuid not null references public.stores (id) on delete cascade,
  command text not null,
  key text not null,
  fingerprint text,
  outcome jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (store_id, command, key)
);

-- Backfill safe in case a database somewhere already ran an earlier
-- version of this migration, before the fingerprint column and the
-- nullable outcome existed. A fresh supabase db reset creates the table
-- with both already in place, these two statements are then a clean no op
-- against that fresh table.
alter table if exists public.idempotency_keys
  add column if not exists fingerprint text;

alter table if exists public.idempotency_keys
  alter column outcome drop not null;

alter table public.store_products enable row level security;
alter table public.count_sessions enable row level security;
alter table public.stock_adjustment_proposals enable row level security;
alter table public.stock_movements enable row level security;
alter table public.offer_allocations enable row level security;
alter table public.audit_entries enable row level security;
alter table public.outbox_events enable row level security;
alter table public.idempotency_keys enable row level security;

-- Members select their own store's rows on every inventory table. No
-- insert, update, or delete policy exists for anon or authenticated on any
-- of them, writes only happen through the security definer RPCs below or
-- the service role, both of which bypass row level security entirely.

drop policy if exists "store_products_select_members"
  on public.store_products;

create policy "store_products_select_members"
  on public.store_products
  for select
  to authenticated
  using (public.fn_current_store_role(store_id) is not null);

drop policy if exists "count_sessions_select_members"
  on public.count_sessions;

create policy "count_sessions_select_members"
  on public.count_sessions
  for select
  to authenticated
  using (public.fn_current_store_role(store_id) is not null);

drop policy if exists "stock_adjustment_proposals_select_members"
  on public.stock_adjustment_proposals;

create policy "stock_adjustment_proposals_select_members"
  on public.stock_adjustment_proposals
  for select
  to authenticated
  using (public.fn_current_store_role(store_id) is not null);

drop policy if exists "stock_movements_select_members"
  on public.stock_movements;

create policy "stock_movements_select_members"
  on public.stock_movements
  for select
  to authenticated
  using (public.fn_current_store_role(store_id) is not null);

drop policy if exists "offer_allocations_select_members"
  on public.offer_allocations;

create policy "offer_allocations_select_members"
  on public.offer_allocations
  for select
  to authenticated
  using (public.fn_current_store_role(store_id) is not null);

-- audit_entries, outbox_events, and idempotency_keys get row level security
-- enabled and no policies at all, for anon or authenticated, select
-- included. They are internal book keeping, readable only by the service
-- role until a later task adds an operator facing surface.

-- Append only enforcement, belt and braces on top of the missing update and
-- delete policies above. Even the service role, which bypasses row level
-- security, cannot get past these triggers, since triggers fire regardless
-- of who owns the statement. Two trigger levels on purpose. Row level
-- triggers (before update or delete, for each row) catch ordinary
-- statements. They do NOT fire for TRUNCATE, Postgres skips row level
-- triggers entirely for that command, so a separate statement level
-- trigger (before truncate, for each statement) is required to close that
-- gap, added in Fix round 1 after review caught the original comment here
-- overclaiming truncate was already covered.
create or replace function public.fn_reject_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'invalid_state: % rows are append only, % is not permitted', tg_table_name, lower(tg_op);
end;
$$;

drop trigger if exists stock_movements_append_only on public.stock_movements;

create trigger stock_movements_append_only
  before update or delete on public.stock_movements
  for each row execute function public.fn_reject_mutation();

drop trigger if exists stock_movements_reject_truncate on public.stock_movements;

create trigger stock_movements_reject_truncate
  before truncate on public.stock_movements
  for each statement execute function public.fn_reject_mutation();

drop trigger if exists audit_entries_append_only on public.audit_entries;

create trigger audit_entries_append_only
  before update or delete on public.audit_entries
  for each row execute function public.fn_reject_mutation();

drop trigger if exists audit_entries_reject_truncate on public.audit_entries;

create trigger audit_entries_reject_truncate
  before truncate on public.audit_entries
  for each statement execute function public.fn_reject_mutation();

-- Deterministic confidence read model. The brief calls for an immutable
-- function, but it reads now(), and Postgres rejects immutable for anything
-- clock dependent since the result is not actually constant for fixed
-- input. Declared stable instead, the correct volatility for a function
-- that only reads the current transaction's timestamp and does no writes.
-- The stored confidence column on store_products still reflects the last
-- written value, this function is for read time recompute, Task 7's
-- summary view is the first consumer.
create or replace function public.fn_stock_confidence(last_verified_at timestamptz)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when last_verified_at is null then 'low'
    when last_verified_at >= now() - interval '72 hours' then 'high'
    when last_verified_at >= now() - interval '7 days' then 'medium'
    else 'low'
  end;
$$;

grant execute on function public.fn_stock_confidence(timestamptz) to anon, authenticated;

-- Records a physical count. Any staff, manager, or owner member may call
-- this, operator is excluded on purpose, counting is a floor task. Idempotent
-- on count_session_id, a client supplied uuid, a second call with the same
-- id returns the proposals the first call created without doing any of the
-- work again, no matter which member of the store makes that second call.
create or replace function public.record_inventory_count_v2(
  p_store_id uuid,
  p_count_session_id uuid,
  p_lines jsonb
)
returns setof public.stock_adjustment_proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_inserted_session_id uuid;
  v_line jsonb;
  v_store_product_id uuid;
  v_observed_quantity int;
  v_current_quantity int;
begin
  set local row_security = off;

  v_role := public.fn_current_store_role(p_store_id);
  if v_role is null or v_role not in ('staff', 'manager', 'owner') then
    raise exception 'forbidden: role % may not record inventory counts', coalesce(v_role, 'none');
  end if;

  insert into public.count_sessions (id, store_id, created_by)
  values (p_count_session_id, p_store_id, auth.uid())
  on conflict (id) do nothing
  returning id into v_inserted_session_id;

  if v_inserted_session_id is null then
    -- Replay branch. Filtering on store_id too, not just count_session_id,
    -- means a caller who reuses a session id under the wrong store gets an
    -- empty result instead of a peek at another store's proposals. count
    -- session ids are client supplied uuids, cheap insurance against a
    -- collision or a caller passing the wrong store_id for a real session.
    return query
      select *
      from public.stock_adjustment_proposals
      where count_session_id = p_count_session_id
        and store_id = p_store_id
      order by created_at, id;
    return;
  end if;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_store_product_id := (v_line ->> 'storeProductId')::uuid;
    v_observed_quantity := (v_line ->> 'observedQuantity')::int;

    select on_hand_quantity
      into v_current_quantity
      from public.store_products
      where id = v_store_product_id
        and store_id = p_store_id;

    if not found then
      -- Fix round 1: this used to be validation_failed. The fake, the
      -- behavioral oracle for this RPC, raises not_found for a count line
      -- whose product is not in the store, review ruled the fake wins,
      -- matching it here.
      raise exception 'not_found: product % does not belong to store %', v_store_product_id, p_store_id;
    end if;

    if v_observed_quantity <> v_current_quantity then
      insert into public.stock_adjustment_proposals (
        store_id,
        store_product_id,
        current_quantity,
        proposed_quantity,
        delta,
        reason,
        status,
        created_by,
        created_by_role,
        count_session_id,
        version
      ) values (
        p_store_id,
        v_store_product_id,
        v_current_quantity,
        v_observed_quantity,
        v_observed_quantity - v_current_quantity,
        'count',
        'pending',
        auth.uid(),
        v_role,
        p_count_session_id,
        1
      );
    end if;

    update public.store_products
      set last_verified_at = now(),
          confidence = 'high',
          version = version + 1
      where id = v_store_product_id;
  end loop;

  insert into public.audit_entries (store_id, actor, command, detail)
  values (
    p_store_id,
    auth.uid()::text,
    'record_inventory_count_v2',
    jsonb_build_object('countSessionId', p_count_session_id, 'lineCount', jsonb_array_length(p_lines))
  );

  return query
    select *
    from public.stock_adjustment_proposals
    where count_session_id = p_count_session_id
      and store_id = p_store_id
    order by created_at, id;
end;
$$;

grant execute on function public.record_inventory_count_v2(uuid, uuid, jsonb) to authenticated;

-- Approves or rejects a pending proposal. Manager or owner only, staff gets
-- forbidden.
--
-- Fix round 1 rewrote most of this function after review:
--
-- 1. Idempotency is now a claim then fill in pattern instead of select then
--    insert. This function first tries to insert a row with a null outcome,
--    on conflict do nothing. Winning that insert means this call does the
--    real work and fills the outcome in at the end. Losing it means either
--    a concurrent duplicate is still in flight, in which case this call
--    waits briefly and polls for the outcome, or an earlier call already
--    finished, in which case the wait resolves immediately. This closes a
--    race where two concurrent callers with the same key both passed a
--    plain select finding nothing, both did the real work, and the second
--    one to insert its result hit a raw duplicate key error instead of a
--    contracted one.
-- 2. A fingerprint computed from (proposal_id, decision) is stored with the
--    claim. A caller reusing a key with a different fingerprint has reused
--    it for different input, not retried the same command, and gets
--    idempotency_conflict rather than a wrong replay or a silent redo.
-- 3. Expected version is now checked before status, matching the fake. A
--    stale expected_version against an already decided proposal reports
--    version_conflict, not invalid_state, since the caller's real problem
--    is that they were looking at an old version, the status is beside the
--    point in that case. A fresh, correct expected_version against an
--    already decided proposal still reports invalid_state, both proposal
--    reads below are locked with for update, closing the found bug where
--    two concurrent approvals on the very same proposal under different
--    idempotency keys could both pass their status and version checks
--    before either committed, then both apply, double counting the delta.
--    That specific race was not named in the review findings, it shares
--    the same root cause as the on hand race below, checking a value
--    before locking the row that value lives on, so it is closed here as
--    part of the same fix rather than left half done.
-- 4. Before applying an approved delta, the product row is locked with for
--    update and the resulting on_hand_quantity is checked against zero in
--    application code. Two pending proposals against the same product,
--    both computed before either was reviewed, can together drive on hand
--    negative even though neither alone would. Without the lock and the
--    check, the second approval would hit the raw on_hand_quantity check
--    constraint and leak a raw Postgres error instead of the contracted
--    validation_failed shape. The lock makes the second approval wait for
--    the first to finish and read the true current value instead of a
--    stale one, so the check is accurate rather than racy.
create or replace function public.approve_stock_adjustment_v2(
  p_store_id uuid,
  p_proposal_id uuid,
  p_decision text,
  p_idempotency_key text,
  p_expected_version int
)
returns public.stock_adjustment_proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_fingerprint text;
  v_claimed_key text;
  v_existing_fingerprint text;
  v_existing_outcome jsonb;
  v_wait_attempt int;
  v_proposal public.stock_adjustment_proposals%rowtype;
  v_current_on_hand int;
  v_result public.stock_adjustment_proposals%rowtype;
begin
  set local row_security = off;

  v_role := public.fn_current_store_role(p_store_id);
  if v_role is null or v_role not in ('manager', 'owner') then
    raise exception 'forbidden: role % may not approve stock adjustments', coalesce(v_role, 'none');
  end if;

  if p_decision not in ('approve', 'reject') then
    raise exception 'validation_failed: decision must be approve or reject';
  end if;

  v_fingerprint := p_proposal_id::text || '::' || p_decision;

  -- Claim step. Only one caller can win this insert for a given
  -- (store_id, command, key), on conflict do nothing means a raced
  -- concurrent duplicate never sees a raw unique violation, it falls into
  -- the losing branch below instead.
  insert into public.idempotency_keys (store_id, command, key, fingerprint, outcome)
  values (p_store_id, 'approve_stock_adjustment_v2', p_idempotency_key, v_fingerprint, null)
  on conflict (store_id, command, key) do nothing
  returning key into v_claimed_key;

  if v_claimed_key is null then
    select fingerprint
      into v_existing_fingerprint
      from public.idempotency_keys
      where store_id = p_store_id
        and command = 'approve_stock_adjustment_v2'
        and key = p_idempotency_key;

    if v_existing_fingerprint is distinct from v_fingerprint then
      raise exception 'idempotency_conflict: key reused with different input';
    end if;

    v_existing_outcome := null;
    for v_wait_attempt in 1..50 loop
      select outcome
        into v_existing_outcome
        from public.idempotency_keys
        where store_id = p_store_id
          and command = 'approve_stock_adjustment_v2'
          and key = p_idempotency_key;

      exit when v_existing_outcome is not null;

      perform pg_sleep(0.1);
    end loop;

    if v_existing_outcome is null then
      raise exception 'idempotency_conflict: concurrent duplicate still in flight';
    end if;

    v_result := jsonb_populate_record(null::public.stock_adjustment_proposals, v_existing_outcome);
    return v_result;
  end if;

  select *
    into v_proposal
    from public.stock_adjustment_proposals
    where id = p_proposal_id
      and store_id = p_store_id
    for update;

  if not found then
    raise exception 'not_found: proposal % not found', p_proposal_id;
  end if;

  if v_proposal.version <> p_expected_version then
    raise exception 'version_conflict: proposal % expected version % but found %',
      p_proposal_id, p_expected_version, v_proposal.version;
  end if;

  if v_proposal.status <> 'pending' then
    raise exception 'invalid_state: proposal % is already %', p_proposal_id, v_proposal.status;
  end if;

  if p_decision = 'approve' then
    select on_hand_quantity
      into v_current_on_hand
      from public.store_products
      where id = v_proposal.store_product_id
      for update;

    if v_current_on_hand + v_proposal.delta < 0 then
      raise exception 'validation_failed: adjustment would make stock negative';
    end if;

    update public.store_products
      set on_hand_quantity = on_hand_quantity + v_proposal.delta,
          version = version + 1
      where id = v_proposal.store_product_id;

    insert into public.stock_movements (store_id, store_product_id, delta, kind, ref_id)
    values (p_store_id, v_proposal.store_product_id, v_proposal.delta, 'adjustment', v_proposal.id);

    update public.stock_adjustment_proposals
      set status = 'applied',
          version = version + 1
      where id = v_proposal.id
      returning * into v_result;
  else
    update public.stock_adjustment_proposals
      set status = 'rejected',
          version = version + 1
      where id = v_proposal.id
      returning * into v_result;
  end if;

  update public.idempotency_keys
    set outcome = to_jsonb(v_result)
    where store_id = p_store_id
      and command = 'approve_stock_adjustment_v2'
      and key = p_idempotency_key;

  insert into public.audit_entries (store_id, actor, command, detail)
  values (
    p_store_id,
    auth.uid()::text,
    'approve_stock_adjustment_v2',
    jsonb_build_object('proposalId', p_proposal_id, 'decision', p_decision)
  );

  insert into public.outbox_events (event_type, payload)
  values (
    'stock_adjustment_decided',
    jsonb_build_object('storeId', p_store_id, 'proposalId', p_proposal_id, 'decision', p_decision)
  );

  return v_result;
end;
$$;

grant execute on function public.approve_stock_adjustment_v2(uuid, uuid, text, text, int) to authenticated;

notify pgrst, 'reload schema';
