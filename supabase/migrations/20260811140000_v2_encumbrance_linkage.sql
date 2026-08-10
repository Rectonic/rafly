-- Links each failed reservation to the exception that owns its encumbrance.
-- Also closes the remaining CSV matching, digest, and watchlist integrity gaps.

alter table public.reservations_v2
  add column if not exists failed_exception_id uuid
    references public.store_exceptions (id) on delete set null;

create index if not exists reservations_v2_failed_exception_idx
  on public.reservations_v2 (failed_exception_id)
  where status = 'failed_stock_mismatch';

-- Historical failures can only be linked honestly when their offer still has
-- an open mismatch. Resolved historical failures remain null and never
-- encumber again.
update public.reservations_v2 as reservation
set failed_exception_id = exception.id
from public.store_exceptions as exception
where reservation.status = 'failed_stock_mismatch'
  and reservation.failed_exception_id is null
  and exception.related_offer_id = reservation.offer_id
  and exception.kind = 'stock_mismatch'
  and exception.status = 'open';

create or replace function public.fn_failed_mismatch_encumbrance_v2(p_offer_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.reservations_v2 as reservation
  join public.store_exceptions as exception
    on exception.id = reservation.failed_exception_id
   and exception.kind = 'stock_mismatch'
   and exception.status = 'open'
  where reservation.offer_id = p_offer_id
    and reservation.status = 'failed_stock_mismatch';
$$;

revoke execute on function public.fn_failed_mismatch_encumbrance_v2(uuid)
  from public, anon, authenticated;

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
as $report_mismatch$
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

  v_fingerprint := p_offer_id::text || chr(58) || chr(58)
    || p_observed_quantity::text || chr(58) || chr(58) || p_reason;

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
    where store_id = p_store_id
      and command = 'report_stock_mismatch_v2'
      and key = p_idempotency_key;
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

  update public.offer_allocations
  set status = 'released'
  where offer_id = p_offer_id and status = 'active';

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
    set status = 'failed_stock_mismatch',
        failed_exception_id = v_exception.id,
        version = version + 1,
        updated_at = now()
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
  where store_id = p_store_id
    and command = 'report_stock_mismatch_v2'
    and key = p_idempotency_key;
  return v_outcome;
end;
$report_mismatch$;

create or replace function public.resolve_store_exception_v2(
  p_store_id uuid,
  p_exception_id uuid,
  p_resolution_note text,
  p_idempotency_key text
)
returns public.store_exceptions
language plpgsql
security definer
set search_path = public
as $resolve_exception$
declare
  v_role text;
  v_fingerprint text;
  v_claimed_key text;
  v_existing_fingerprint text;
  v_outcome jsonb;
  v_exception public.store_exceptions%rowtype;
begin
  set local row_security = off;
  v_role := public.fn_current_store_role(p_store_id);
  if v_role is null or v_role not in ('manager', 'owner') then
    raise exception 'forbidden: role % may not resolve store exceptions', coalesce(v_role, 'none');
  end if;
  if btrim(coalesce(p_resolution_note, '')) = '' then
    raise exception 'validation_failed: resolution note is required';
  end if;
  if coalesce(p_idempotency_key, '') = '' then
    raise exception 'validation_failed: idempotency key is required';
  end if;

  v_fingerprint := encode(
    extensions.digest(p_exception_id::text || chr(58) || chr(58) || btrim(p_resolution_note), 'sha256'),
    'hex'
  );

  begin
    set local lock_timeout = '4s';
    insert into public.idempotency_keys (store_id, command, key, fingerprint, outcome)
    values (p_store_id, 'resolve_store_exception_v2', p_idempotency_key, v_fingerprint, null)
    on conflict (store_id, command, key) do nothing
    returning key into v_claimed_key;
    set local lock_timeout = default;
  exception when lock_not_available then
    raise exception 'idempotency_conflict: concurrent duplicate command still in flight';
  end;

  if v_claimed_key is null then
    select fingerprint, outcome into v_existing_fingerprint, v_outcome
    from public.idempotency_keys
    where store_id = p_store_id
      and command = 'resolve_store_exception_v2'
      and key = p_idempotency_key;
    if v_existing_fingerprint is distinct from v_fingerprint then
      raise exception 'idempotency_conflict: key reused with different input';
    end if;
    if v_outcome is null then
      raise exception 'idempotency_conflict: concurrent duplicate still in flight';
    end if;
    v_exception := jsonb_populate_record(null::public.store_exceptions, v_outcome);
    return v_exception;
  end if;

  select * into v_exception
  from public.store_exceptions
  where id = p_exception_id and store_id = p_store_id
  for update;
  if not found then
    raise exception 'not_found: exception % is not in store %', p_exception_id, p_store_id;
  end if;
  if v_exception.status <> 'open' then
    raise exception 'invalid_state: exception % is already %', p_exception_id, v_exception.status;
  end if;

  update public.store_exceptions
  set status = 'resolved', resolution_note = p_resolution_note, resolved_at = now()
  where id = p_exception_id
  returning * into v_exception;

  v_outcome := to_jsonb(v_exception);
  update public.idempotency_keys set outcome = v_outcome
  where store_id = p_store_id
    and command = 'resolve_store_exception_v2'
    and key = p_idempotency_key;

  insert into public.audit_entries (store_id, actor, command, detail)
  values (p_store_id, auth.uid()::text, 'resolve_store_exception_v2', jsonb_build_object(
    'exceptionId', v_exception.id,
    'resolutionNote', p_resolution_note
  ));
  insert into public.outbox_events (event_type, payload)
  values ('exception_resolved', jsonb_build_object(
    'storeId', p_store_id,
    'exceptionId', v_exception.id,
    'relatedOfferId', v_exception.related_offer_id,
    'relatedStoreProductId', v_exception.related_store_product_id
  ));
  return v_exception;
end;
$resolve_exception$;

create or replace function public.list_store_inventory_v2(p_store_id uuid)
returns table (
  store_product_id uuid,
  store_id uuid,
  product_name text,
  barcode text,
  category text,
  on_hand_quantity int,
  confidence text,
  last_verified_at timestamptz,
  max_offerable_quantity int,
  allocated_quantity int,
  expiry_date date,
  has_open_exceptions boolean,
  version int
)
language plpgsql
security definer
set search_path = public
as $list_inventory$
declare
  v_role text;
begin
  set local row_security = off;
  v_role := public.fn_current_store_role(p_store_id);
  if v_role is null then
    raise exception 'forbidden: caller is not a member of store %', p_store_id;
  end if;
  perform public.fn_apply_offer_reservation_expiry_v2(null::uuid);

  return query
  select
    product.id,
    product.store_id,
    product.product_name,
    product.barcode,
    product.category,
    product.on_hand_quantity,
    product.confidence,
    product.last_verified_at,
    case when product.confidence = 'high'
      then greatest(0, product.on_hand_quantity - allocation.allocated)
      else 0
    end::int,
    allocation.allocated,
    product.expiry_date,
    exists (
      select 1
      from public.store_exceptions as exception
      where exception.store_id = p_store_id
        and exception.related_store_product_id = product.id
        and exception.status = 'open'
    ),
    product.version
  from public.store_products as product
  cross join lateral (
    select coalesce(sum(
      case when offer.status in ('live', 'paused', 'sold_out')
        then offer.quantity_available + reservation_counts.held
        else 0
      end + public.fn_failed_mismatch_encumbrance_v2(offer.id)
    ), 0)::int as allocated
    from public.offers_v2 as offer
    cross join lateral (
      select count(*) filter (where reservation.status = 'held')::int as held
      from public.reservations_v2 as reservation
      where reservation.offer_id = offer.id
    ) as reservation_counts
    where offer.store_id = p_store_id
      and offer.store_product_id = product.id
  ) as allocation
  where product.store_id = p_store_id
  order by product.created_at asc, product.id asc;
end;
$list_inventory$;

create or replace function public.list_expiry_watchlist_v2(p_store_id uuid)
returns table (
  store_product_id uuid,
  product_name text,
  expiry_date date,
  days_to_expiry int,
  on_hand_quantity int,
  confidence text,
  has_open_exceptions boolean,
  active_offer_id uuid
)
language plpgsql
security definer
set search_path = public
as $list_expiry_watchlist$
declare
  v_role text;
  v_today date;
begin
  set local row_security = off;
  v_role := public.fn_current_store_role(p_store_id);
  if v_role is null then
    raise exception 'forbidden: caller is not a member of store %', p_store_id;
  end if;
  v_today := (now() at time zone 'UTC')::date;

  return query
  select
    product.id,
    product.product_name,
    product.expiry_date,
    (product.expiry_date - v_today)::int,
    product.on_hand_quantity,
    product.confidence,
    exists (
      select 1
      from public.store_exceptions as exception
      where exception.store_id = p_store_id
        and exception.related_store_product_id = product.id
        and exception.status = 'open'
    ),
    (
      select offer.id
      from public.offers_v2 as offer
      where offer.store_id = p_store_id
        and offer.store_product_id = product.id
        and offer.status in ('live', 'paused')
        and offer.pickup_end > now()
      order by offer.created_at desc, offer.id desc
      limit 1
    )
  from public.store_products as product
  where product.store_id = p_store_id
    and product.expiry_date is not null
    and product.expiry_date <= v_today + 14
  order by product.expiry_date asc, product.id asc;
end;
$list_expiry_watchlist$;

create or replace function public.compose_owner_digest_v2(p_store_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $owner_digest$
declare
  v_role text;
  v_store_name text;
  v_generated_at timestamptz := now();
  v_stale_verification jsonb;
  v_stale_verification_total int;
  v_expiry_risk jsonb;
  v_expiry_risk_total int;
  v_open_exceptions jsonb;
  v_open_exceptions_total int;
  v_paused_offers jsonb;
  v_paused_offers_total int;
  v_count_days int;
  v_published int;
  v_fulfilled int;
  v_cancelled_by_seller int;
  v_expired_no_show int;
  v_failed_stock_mismatch int;
begin
  v_role := public.fn_current_store_role(p_store_id);
  if v_role is null or v_role not in ('manager', 'owner') then
    raise exception 'forbidden: role % may not compose the owner digest', coalesce(v_role, 'none');
  end if;

  select name into v_store_name from public.stores where id = p_store_id;

  select count(*)::int into v_stale_verification_total
  from public.store_products
  where store_id = p_store_id
    and on_hand_quantity > 0
    and (last_verified_at is null or last_verified_at < v_generated_at - interval '14 days');

  select coalesce(jsonb_agg(jsonb_build_object(
    'productName', item.product_name,
    'onHand', item.on_hand_quantity,
    'lastVerifiedAt', item.last_verified_at
  ) order by item.last_verified_at asc nulls first, item.id asc), '[]'::jsonb)
  into v_stale_verification
  from (
    select id, product_name, on_hand_quantity, last_verified_at
    from public.store_products
    where store_id = p_store_id
      and on_hand_quantity > 0
      and (last_verified_at is null or last_verified_at < v_generated_at - interval '14 days')
    order by last_verified_at asc nulls first, id asc
    limit 10
  ) as item;

  select count(*)::int into v_expiry_risk_total
  from public.store_products
  where store_id = p_store_id
    and expiry_date is not null
    and expiry_date <= (v_generated_at at time zone 'UTC')::date + 3;

  select coalesce(jsonb_agg(jsonb_build_object(
    'productName', item.product_name,
    'expiryDate', item.expiry_date,
    'daysToExpiry', item.expiry_date - (v_generated_at at time zone 'UTC')::date,
    'onHand', item.on_hand_quantity
  ) order by item.expiry_date asc, item.id asc), '[]'::jsonb)
  into v_expiry_risk
  from (
    select id, product_name, expiry_date, on_hand_quantity
    from public.store_products
    where store_id = p_store_id
      and expiry_date is not null
      and expiry_date <= (v_generated_at at time zone 'UTC')::date + 3
    order by expiry_date asc, id asc
    limit 10
  ) as item;

  select count(*)::int into v_open_exceptions_total
  from public.store_exceptions
  where store_id = p_store_id and status = 'open';

  select coalesce(jsonb_agg(jsonb_build_object(
    'kind', item.kind,
    'message', item.message,
    'createdAt', item.created_at
  ) order by item.created_at desc, item.id desc), '[]'::jsonb)
  into v_open_exceptions
  from (
    select id, kind, message, created_at
    from public.store_exceptions
    where store_id = p_store_id and status = 'open'
    order by created_at desc, id desc
    limit 10
  ) as item;

  select count(*)::int into v_paused_offers_total
  from public.offers_v2
  where store_id = p_store_id and status = 'paused';

  select coalesce(jsonb_agg(jsonb_build_object(
    'title', item.title,
    'pausedSinceVersionNote', null
  ) order by item.created_at desc, item.id desc), '[]'::jsonb)
  into v_paused_offers
  from (
    select id, title, created_at
    from public.offers_v2
    where store_id = p_store_id and status = 'paused'
    order by created_at desc, id desc
    limit 10
  ) as item;

  select count(distinct (created_at at time zone 'UTC')::date)::int
  into v_count_days
  from public.count_sessions
  where store_id = p_store_id
    and created_at >= v_generated_at - interval '7 days'
    and coalesce(line_fingerprint, '') <> '';

  select count(*)::int into v_published
  from public.offers_v2
  where store_id = p_store_id and created_at >= v_generated_at - interval '7 days';

  select
    count(*) filter (where reservation.status = 'fulfilled')::int,
    count(*) filter (where reservation.status = 'cancelled_by_seller')::int,
    count(*) filter (where reservation.status = 'expired_no_show')::int,
    count(*) filter (where reservation.status = 'failed_stock_mismatch')::int
  into v_fulfilled, v_cancelled_by_seller, v_expired_no_show, v_failed_stock_mismatch
  from public.reservations_v2 as reservation
  join public.offers_v2 as offer on offer.id = reservation.offer_id
  where offer.store_id = p_store_id
    and reservation.created_at >= v_generated_at - interval '7 days';

  return jsonb_build_object(
    'storeName', v_store_name,
    'generatedAt', v_generated_at,
    'staleVerification', v_stale_verification,
    'staleVerificationTotal', v_stale_verification_total,
    'expiryRisk', v_expiry_risk,
    'expiryRiskTotal', v_expiry_risk_total,
    'openExceptions', v_open_exceptions,
    'openExceptionsTotal', v_open_exceptions_total,
    'pausedOffers', v_paused_offers,
    'pausedOffersTotal', v_paused_offers_total,
    'countActivity7d', jsonb_build_object('daysWithCountSession', v_count_days, 'days', 7),
    'offers7d', jsonb_build_object(
      'published', v_published,
      'fulfilled', v_fulfilled,
      'cancelledBySeller', v_cancelled_by_seller,
      'expiredNoShow', v_expired_no_show,
      'failedStockMismatch', v_failed_stock_mismatch
    )
  );
end;
$owner_digest$;

create or replace function public.upload_import_batch_v2(
  p_store_id uuid,
  p_filename text,
  p_records jsonb,
  p_idempotency_key text
)
returns public.import_batches
language plpgsql
security definer
set search_path = public
as $upload_import$
declare
  v_role text;
  v_fingerprint text;
  v_claimed_key text;
  v_existing_fingerprint text;
  v_outcome jsonb;
  v_batch public.import_batches%rowtype;
  v_record jsonb;
  v_raw_name text;
  v_raw_barcode text;
  v_raw_quantity int;
  v_raw_price numeric;
  v_candidates jsonb;
  v_candidate_count int;
  v_match_status text;
  v_matched_product_id uuid;
  v_duplicate_in_file boolean;
begin
  set local row_security = off;
  v_role := public.fn_current_store_role(p_store_id);
  if v_role is null or v_role not in ('staff', 'manager', 'owner') then
    raise exception 'forbidden: role % may not upload import batches', coalesce(v_role, 'none');
  end if;
  if btrim(coalesce(p_filename, '')) = '' then
    raise exception 'validation_failed: filename is required';
  end if;
  if coalesce(p_idempotency_key, '') = '' then
    raise exception 'validation_failed: idempotency key is required';
  end if;
  if p_records is null or jsonb_typeof(p_records) <> 'array' then
    raise exception 'validation_failed: records must be an array';
  end if;
  if jsonb_array_length(p_records) = 0 then
    raise exception 'validation_failed: at least one record is required';
  end if;

  for v_record in select value from jsonb_array_elements(p_records)
  loop
    if jsonb_typeof(v_record) <> 'object' then
      raise exception 'validation_failed: every record must be an object';
    end if;
    if btrim(coalesce(v_record ->> 'rawName', '')) = '' then
      raise exception 'validation_failed: every record needs a raw name';
    end if;
    if v_record ? 'rawQuantity' and jsonb_typeof(v_record -> 'rawQuantity') <> 'null' then
      if jsonb_typeof(v_record -> 'rawQuantity') <> 'number'
        or (v_record ->> 'rawQuantity')::numeric < 0
        or (v_record ->> 'rawQuantity')::numeric > 2147483647
        or trunc((v_record ->> 'rawQuantity')::numeric) <> (v_record ->> 'rawQuantity')::numeric then
        raise exception 'validation_failed: raw quantity must be a nonnegative integer';
      end if;
    end if;
    if v_record ? 'rawPrice' and jsonb_typeof(v_record -> 'rawPrice') <> 'null' then
      if jsonb_typeof(v_record -> 'rawPrice') <> 'number'
        or (v_record ->> 'rawPrice')::numeric < 0 then
        raise exception 'validation_failed: raw price must be nonnegative';
      end if;
    end if;
  end loop;

  v_fingerprint := encode(
    extensions.digest(p_filename || chr(58) || chr(58) || p_records::text, 'sha256'),
    'hex'
  );

  begin
    set local lock_timeout = '4s';
    insert into public.idempotency_keys (store_id, command, key, fingerprint, outcome)
    values (p_store_id, 'upload_import_batch_v2', p_idempotency_key, v_fingerprint, null)
    on conflict (store_id, command, key) do nothing
    returning key into v_claimed_key;
    set local lock_timeout = default;
  exception when lock_not_available then
    raise exception 'idempotency_conflict: concurrent duplicate command still in flight';
  end;

  if v_claimed_key is null then
    select fingerprint, outcome into v_existing_fingerprint, v_outcome
    from public.idempotency_keys
    where store_id = p_store_id
      and command = 'upload_import_batch_v2'
      and key = p_idempotency_key;
    if v_existing_fingerprint is distinct from v_fingerprint then
      raise exception 'idempotency_conflict: key reused with different input';
    end if;
    if v_outcome is null then
      raise exception 'idempotency_conflict: concurrent duplicate still in flight';
    end if;
    v_batch := jsonb_populate_record(null::public.import_batches, v_outcome);
    return v_batch;
  end if;

  insert into public.import_batches (
    store_id, filename, status, total_records, pending_records, created_by, import_fingerprint
  ) values (
    p_store_id,
    p_filename,
    'uploaded',
    jsonb_array_length(p_records),
    jsonb_array_length(p_records),
    auth.uid(),
    v_fingerprint
  ) returning * into v_batch;

  for v_record in select value from jsonb_array_elements(p_records)
  loop
    v_raw_name := v_record ->> 'rawName';
    v_raw_barcode := nullif(v_record ->> 'rawBarcode', '');
    v_raw_quantity := case
      when v_record ? 'rawQuantity' and jsonb_typeof(v_record -> 'rawQuantity') <> 'null'
        then (v_record ->> 'rawQuantity')::int
      else null
    end;
    v_raw_price := case
      when v_record ? 'rawPrice' and jsonb_typeof(v_record -> 'rawPrice') <> 'null'
        then (v_record ->> 'rawPrice')::numeric
      else null
    end;

    v_duplicate_in_file := v_raw_barcode is not null
      and not exists (
        select 1 from public.store_products as product
        where product.store_id = p_store_id and product.barcode = v_raw_barcode
      )
      and (
        select count(*)
        from jsonb_array_elements(p_records) as source(value)
        where nullif(source.value ->> 'rawBarcode', '') = v_raw_barcode
      ) > 1;

    if v_duplicate_in_file then
      v_candidates := jsonb_build_array(jsonb_build_object(
        'storeProductId', '',
        'productName', v_raw_name,
        'reason', 'duplicate_in_file'
      ));
      v_candidate_count := 0;
      v_match_status := 'ambiguous';
      v_matched_product_id := null;
    else
      select coalesce(jsonb_agg(jsonb_build_object(
        'storeProductId', candidate.id,
        'productName', candidate.product_name,
        'reason', candidate.reason
      ) order by candidate.id), '[]'::jsonb)
      into v_candidates
      from (
        select
          product.id,
          product.product_name,
          case
            when v_raw_barcode is not null and product.barcode = v_raw_barcode then 'barcode'
            when exists (
              select 1
              from public.product_aliases as alias
              where alias.store_id = p_store_id
                and alias.store_product_id = product.id
                and alias.approved = true
                and lower(alias.alias) = lower(v_raw_name)
            ) then 'alias'
            else 'product_name'
          end as reason
        from public.store_products as product
        where product.store_id = p_store_id
          and (
            (v_raw_barcode is not null and product.barcode = v_raw_barcode)
            or lower(product.product_name) = lower(v_raw_name)
            or exists (
              select 1
              from public.product_aliases as alias
              where alias.store_id = p_store_id
                and alias.store_product_id = product.id
                and alias.approved = true
                and lower(alias.alias) = lower(v_raw_name)
            )
          )
      ) as candidate;

      v_candidate_count := jsonb_array_length(v_candidates);
      if v_candidate_count = 1 then
        v_match_status := 'auto_matched';
        v_matched_product_id := (v_candidates -> 0 ->> 'storeProductId')::uuid;
      elsif v_candidate_count > 1 then
        v_match_status := 'ambiguous';
        v_matched_product_id := null;
      else
        v_match_status := 'unmatched';
        v_matched_product_id := null;
      end if;
    end if;

    insert into public.staged_source_records (
      batch_id,
      store_id,
      raw_name,
      raw_barcode,
      raw_quantity,
      raw_price,
      match_status,
      matched_store_product_id,
      candidates
    ) values (
      v_batch.id,
      p_store_id,
      v_raw_name,
      v_raw_barcode,
      v_raw_quantity,
      v_raw_price,
      v_match_status,
      v_matched_product_id,
      v_candidates
    );
  end loop;

  update public.import_batches
  set status = 'needs_review'
  where id = v_batch.id
  returning * into v_batch;

  v_outcome := to_jsonb(v_batch);
  update public.idempotency_keys set outcome = v_outcome
  where store_id = p_store_id
    and command = 'upload_import_batch_v2'
    and key = p_idempotency_key;
  return v_batch;
end;
$upload_import$;

create or replace function public.decide_staged_record_v2(
  p_store_id uuid,
  p_record_id uuid,
  p_decision text,
  p_target_store_product_id uuid,
  p_idempotency_key text
)
returns public.staged_source_records
language plpgsql
security definer
set search_path = public
as $decide_staged$
declare
  v_role text;
  v_fingerprint text;
  v_claimed_key text;
  v_existing_fingerprint text;
  v_outcome jsonb;
  v_record public.staged_source_records%rowtype;
  v_result public.staged_source_records%rowtype;
  v_batch public.import_batches%rowtype;
  v_product public.store_products%rowtype;
  v_product_id uuid;
begin
  set local row_security = off;
  v_role := public.fn_current_store_role(p_store_id);
  if v_role is null or v_role not in ('manager', 'owner') then
    raise exception 'forbidden: role % may not decide staged records', coalesce(v_role, 'none');
  end if;
  if p_decision is null or p_decision not in ('approve', 'reject') then
    raise exception 'validation_failed: decision must be approve or reject';
  end if;
  if p_decision = 'reject' and p_target_store_product_id is not null then
    raise exception 'validation_failed: a rejected record cannot have a target product';
  end if;
  if coalesce(p_idempotency_key, '') = '' then
    raise exception 'validation_failed: idempotency key is required';
  end if;

  v_fingerprint := p_record_id::text
    || chr(58) || chr(58) || p_decision
    || chr(58) || chr(58) || coalesce(p_target_store_product_id::text, 'null');

  begin
    set local lock_timeout = '4s';
    insert into public.idempotency_keys (store_id, command, key, fingerprint, outcome)
    values (p_store_id, 'decide_staged_record_v2', p_idempotency_key, v_fingerprint, null)
    on conflict (store_id, command, key) do nothing
    returning key into v_claimed_key;
    set local lock_timeout = default;
  exception when lock_not_available then
    raise exception 'idempotency_conflict: concurrent duplicate command still in flight';
  end;

  if v_claimed_key is null then
    select fingerprint, outcome into v_existing_fingerprint, v_outcome
    from public.idempotency_keys
    where store_id = p_store_id
      and command = 'decide_staged_record_v2'
      and key = p_idempotency_key;
    if v_existing_fingerprint is distinct from v_fingerprint then
      raise exception 'idempotency_conflict: key reused with different input';
    end if;
    if v_outcome is null then
      raise exception 'idempotency_conflict: concurrent duplicate still in flight';
    end if;
    v_result := jsonb_populate_record(null::public.staged_source_records, v_outcome);
    return v_result;
  end if;

  select * into v_record
  from public.staged_source_records
  where id = p_record_id and store_id = p_store_id;
  if not found then
    raise exception 'not_found: staged record % is not in store %', p_record_id, p_store_id;
  end if;

  if p_decision = 'approve' and p_target_store_product_id is not null then
    select * into v_product
    from public.store_products
    where id = p_target_store_product_id and store_id = p_store_id
    for update;
    if not found then
      raise exception 'not_found: target product % is not in store %', p_target_store_product_id, p_store_id;
    end if;
  end if;

  select * into v_batch
  from public.import_batches
  where id = v_record.batch_id and store_id = p_store_id
  for update;
  if not found then
    raise exception 'not_found: import batch for staged record % is missing', p_record_id;
  end if;

  select * into v_record
  from public.staged_source_records
  where id = p_record_id and store_id = p_store_id
  for update;
  if not found then
    raise exception 'not_found: staged record % is not in store %', p_record_id, p_store_id;
  end if;
  if v_record.match_status in ('approved', 'rejected') then
    raise exception 'invalid_state: staged record % is already %', p_record_id, v_record.match_status;
  end if;
  if v_batch.pending_records <= 0 then
    raise exception 'invalid_state: import batch % has no pending records', v_batch.id;
  end if;

  if p_decision = 'approve' then
    if p_target_store_product_id is not null
      and jsonb_array_length(v_record.candidates) > 0
      and not exists (
        select 1
        from jsonb_array_elements(v_record.candidates) as candidate
        where candidate ->> 'storeProductId' = p_target_store_product_id::text
      ) then
      raise exception 'validation_failed: target product % is not a candidate for staged record %',
        p_target_store_product_id, v_record.id;
    end if;

    if p_target_store_product_id is null then
      begin
        insert into public.store_products (
          store_id, product_name, barcode, on_hand_quantity, confidence
        ) values (
          p_store_id, v_record.raw_name, v_record.raw_barcode, 0, 'low'
        ) returning * into v_product;

        insert into public.product_aliases (
          store_id, store_product_id, alias, approved, created_by
        ) values (
          p_store_id, v_product.id, v_record.raw_name, true, auth.uid()
        );
      exception when unique_violation then
        raise exception 'validation_failed: raw name is already an alias in this store';
      end;
    end if;

    v_product_id := coalesce(p_target_store_product_id, v_product.id);

    insert into public.product_aliases (
      store_id, store_product_id, alias, approved, created_by
    ) values (
      p_store_id, v_product_id, v_record.raw_name, true, auth.uid()
    ) on conflict (store_id, lower(alias)) do nothing;

    if v_record.raw_quantity is not null then
      insert into public.inventory_observations (
        store_id,
        store_product_id,
        staged_source_record_id,
        observed_quantity,
        confidence,
        created_by
      ) values (
        p_store_id,
        v_product_id,
        v_record.id,
        v_record.raw_quantity,
        'low',
        auth.uid()
      );

      update public.store_products
      set confidence = 'low', version = version + 1
      where id = v_product_id and store_id = p_store_id
      returning * into v_product;
    end if;

    update public.staged_source_records
    set match_status = 'approved',
        matched_store_product_id = v_product_id,
        decided_by = auth.uid(),
        decided_at = now()
    where id = v_record.id
    returning * into v_result;
  else
    update public.staged_source_records
    set match_status = 'rejected',
        matched_store_product_id = null,
        decided_by = auth.uid(),
        decided_at = now()
    where id = v_record.id
    returning * into v_result;
  end if;

  update public.import_batches
  set pending_records = pending_records - 1,
      status = case when pending_records = 1 then 'completed' else 'needs_review' end
  where id = v_batch.id;

  v_outcome := to_jsonb(v_result);
  update public.idempotency_keys set outcome = v_outcome
  where store_id = p_store_id
    and command = 'decide_staged_record_v2'
    and key = p_idempotency_key;

  insert into public.audit_entries (store_id, actor, command, detail)
  values (p_store_id, auth.uid()::text, 'decide_staged_record_v2', jsonb_build_object(
    'batchId', v_batch.id,
    'recordId', v_result.id,
    'decision', p_decision,
    'targetStoreProductId', v_result.matched_store_product_id
  ));
  insert into public.outbox_events (event_type, payload)
  values ('staged_record_decided', jsonb_build_object(
    'storeId', p_store_id,
    'batchId', v_batch.id,
    'recordId', v_result.id,
    'decision', p_decision,
    'targetStoreProductId', v_result.matched_store_product_id
  ));
  return v_result;
end;
$decide_staged$;

create or replace function public.publish_offer_v2(
  p_store_id uuid,
  p_input jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $publish_offer$
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
    select fingerprint, outcome into v_existing_fingerprint, v_outcome
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

  select * into v_product
  from public.store_products
  where id = v_store_product_id and store_id = p_store_id
  for update;
  if not found then
    raise exception 'not_found: product % is not in store %', v_store_product_id, p_store_id;
  end if;
  if v_product.expiry_date is not null
    and v_product.expiry_date < (v_pickup_end at time zone 'UTC')::date then
    raise exception 'validation_failed: product % expires on % before pickup ends %',
      v_product.id, v_product.expiry_date, v_pickup_end;
  end if;

  select coalesce(sum(
    case when offer.status in ('live', 'paused', 'sold_out')
      then offer.quantity_available + reservation_counts.held
      else 0
    end + public.fn_failed_mismatch_encumbrance_v2(offer.id)
  ), 0)::int
  into v_allocated
  from public.offers_v2 as offer
  cross join lateral (
    select count(*) filter (where reservation.status = 'held')::int as held
    from public.reservations_v2 as reservation
    where reservation.offer_id = offer.id
  ) as reservation_counts
  where offer.store_id = p_store_id
    and offer.store_product_id = v_product.id;

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

  insert into public.offer_allocations (store_id, offer_id, store_product_id, quantity, status)
  values (p_store_id, v_offer.id, v_product.id, v_quantity, 'active');

  v_outcome := to_jsonb(v_offer);
  update public.idempotency_keys set outcome = v_outcome
  where store_id = p_store_id and command = 'publish_offer_v2' and key = p_idempotency_key;
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
$publish_offer$;

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
as $approve_adjustment$
declare
  v_role text;
  v_fingerprint text;
  v_claimed_key text;
  v_existing_fingerprint text;
  v_existing_outcome jsonb;
  v_wait_attempt int;
  v_proposal public.stock_adjustment_proposals%rowtype;
  v_current_on_hand int;
  v_allocated_ledger int;
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

  begin
    set local lock_timeout = '4s';
    insert into public.idempotency_keys (store_id, command, key, fingerprint, outcome)
    values (p_store_id, 'approve_stock_adjustment_v2', p_idempotency_key, v_fingerprint, null)
    on conflict (store_id, command, key) do nothing
    returning key into v_claimed_key;
    set local lock_timeout = default;
  exception when lock_not_available then
    raise exception 'idempotency_conflict: concurrent duplicate command still in flight';
  end;

  if v_claimed_key is null then
    select fingerprint into v_existing_fingerprint
    from public.idempotency_keys
    where store_id = p_store_id
      and command = 'approve_stock_adjustment_v2'
      and key = p_idempotency_key;
    if v_existing_fingerprint is distinct from v_fingerprint then
      raise exception 'idempotency_conflict: key reused with different input';
    end if;
    v_existing_outcome := null;
    for v_wait_attempt in 1..50 loop
      select outcome into v_existing_outcome
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

  select * into v_proposal
  from public.stock_adjustment_proposals
  where id = p_proposal_id and store_id = p_store_id;
  if not found then
    raise exception 'not_found: proposal % not found', p_proposal_id;
  end if;
  perform 1
  from public.store_products
  where id = v_proposal.store_product_id and store_id = p_store_id
  for update;
  if not found then
    raise exception 'not_found: product % is not in store %', v_proposal.store_product_id, p_store_id;
  end if;
  select * into v_proposal
  from public.stock_adjustment_proposals
  where id = p_proposal_id and store_id = p_store_id
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
    select on_hand_quantity into v_current_on_hand
    from public.store_products
    where id = v_proposal.store_product_id;
    if v_current_on_hand + v_proposal.delta < 0 then
      raise exception 'validation_failed: adjustment would make stock negative';
    end if;

    select coalesce(sum(
      case when offer.status in ('live', 'paused', 'sold_out')
        then offer.quantity_available + reservation_counts.held
        else 0
      end + public.fn_failed_mismatch_encumbrance_v2(offer.id)
    ), 0)::int
    into v_allocated_ledger
    from public.offers_v2 as offer
    cross join lateral (
      select count(*) filter (where reservation.status = 'held')::int as held
      from public.reservations_v2 as reservation
      where reservation.offer_id = offer.id
    ) as reservation_counts
    where offer.store_id = p_store_id
      and offer.store_product_id = v_proposal.store_product_id
      and offer.physically_set_aside = false;

    if v_current_on_hand + v_proposal.delta < v_allocated_ledger then
      raise exception 'validation_failed: adjustment would undercut allocated offers, % units of product % are still promised to buyers and only expiry or withdrawal of those offers releases them',
        v_allocated_ledger, v_proposal.store_product_id;
    end if;

    update public.store_products
    set on_hand_quantity = on_hand_quantity + v_proposal.delta,
        confidence = 'high',
        last_verified_at = now(),
        version = version + 1
    where id = v_proposal.store_product_id;
    insert into public.stock_movements (store_id, store_product_id, delta, kind, ref_id)
    values (p_store_id, v_proposal.store_product_id, v_proposal.delta, 'adjustment', v_proposal.id);
    update public.stock_adjustment_proposals
    set status = 'applied', version = version + 1
    where id = v_proposal.id
    returning * into v_result;
  else
    update public.stock_adjustment_proposals
    set status = 'rejected', version = version + 1
    where id = v_proposal.id
    returning * into v_result;
  end if;

  update public.idempotency_keys set outcome = to_jsonb(v_result)
  where store_id = p_store_id
    and command = 'approve_stock_adjustment_v2'
    and key = p_idempotency_key;
  insert into public.audit_entries (store_id, actor, command, detail)
  values (p_store_id, auth.uid()::text, 'approve_stock_adjustment_v2', jsonb_build_object(
    'proposalId', p_proposal_id,
    'decision', p_decision
  ));
  insert into public.outbox_events (event_type, payload)
  values ('stock_adjustment_decided', jsonb_build_object(
    'storeId', p_store_id,
    'proposalId', p_proposal_id,
    'decision', p_decision
  ));
  return v_result;
end;
$approve_adjustment$;

revoke execute on function public.report_stock_mismatch_v2(uuid, uuid, int, text, text) from public;
grant execute on function public.report_stock_mismatch_v2(uuid, uuid, int, text, text) to authenticated;
revoke execute on function public.resolve_store_exception_v2(uuid, uuid, text, text) from public;
grant execute on function public.resolve_store_exception_v2(uuid, uuid, text, text) to authenticated;
revoke execute on function public.list_store_inventory_v2(uuid) from public;
grant execute on function public.list_store_inventory_v2(uuid) to authenticated;
revoke execute on function public.list_expiry_watchlist_v2(uuid) from public;
grant execute on function public.list_expiry_watchlist_v2(uuid) to authenticated;
revoke execute on function public.compose_owner_digest_v2(uuid) from public, anon, authenticated;
grant execute on function public.compose_owner_digest_v2(uuid) to authenticated;
revoke execute on function public.upload_import_batch_v2(uuid, text, jsonb, text) from public;
grant execute on function public.upload_import_batch_v2(uuid, text, jsonb, text) to authenticated;
revoke execute on function public.decide_staged_record_v2(uuid, uuid, text, uuid, text) from public;
grant execute on function public.decide_staged_record_v2(uuid, uuid, text, uuid, text) to authenticated;
revoke execute on function public.publish_offer_v2(uuid, jsonb, text) from public;
grant execute on function public.publish_offer_v2(uuid, jsonb, text) to authenticated;
revoke execute on function public.approve_stock_adjustment_v2(uuid, uuid, text, text, int) from public;
grant execute on function public.approve_stock_adjustment_v2(uuid, uuid, text, text, int) to authenticated;

notify pgrst, 'reload schema';
