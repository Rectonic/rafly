-- Owner digest action brief. Every field is derived from a fact stored by
-- the current schema. The query is read only and does not run an expiry
-- sweep or change any row while composing the brief.

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
  v_expiry_risk jsonb;
  v_open_exceptions jsonb;
  v_paused_offers jsonb;
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

  select name into v_store_name
    from public.stores
    where id = p_store_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'productName', item.product_name,
      'onHand', item.on_hand_quantity,
      'lastVerifiedAt', item.last_verified_at
    ) order by item.last_verified_at asc nulls first, item.id asc
  ), '[]'::jsonb)
  into v_stale_verification
  from (
    select id, product_name, on_hand_quantity, last_verified_at
      from public.store_products
      where store_id = p_store_id
        and on_hand_quantity > 0
        and (
          last_verified_at is null
          or last_verified_at < v_generated_at - interval '14 days'
        )
      order by last_verified_at asc nulls first, id asc
      limit 10
  ) as item;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'productName', item.product_name,
      'expiryDate', item.expiry_date,
      'daysToExpiry', item.expiry_date - (v_generated_at at time zone 'UTC')::date,
      'onHand', item.on_hand_quantity
    ) order by item.expiry_date asc, item.id asc
  ), '[]'::jsonb)
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

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'kind', item.kind,
      'message', item.message,
      'createdAt', item.created_at
    ) order by item.created_at desc, item.id desc
  ), '[]'::jsonb)
  into v_open_exceptions
  from (
    select id, kind, message, created_at
      from public.store_exceptions
      where store_id = p_store_id
        and status = 'open'
      order by created_at desc, id desc
      limit 10
  ) as item;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'title', item.title,
      'pausedSinceVersionNote', null
    ) order by item.created_at desc, item.id desc
  ), '[]'::jsonb)
  into v_paused_offers
  from (
    select id, title, created_at
      from public.offers_v2
      where store_id = p_store_id
        and status = 'paused'
      order by created_at desc, id desc
      limit 10
  ) as item;

  select count(distinct (created_at at time zone 'UTC')::date)::int
    into v_count_days
    from public.count_sessions
    where store_id = p_store_id
      and created_at >= v_generated_at - interval '7 days';

  select count(*)::int
    into v_published
    from public.offers_v2
    where store_id = p_store_id
      and created_at >= v_generated_at - interval '7 days';

  select
    count(*) filter (where reservation.status = 'fulfilled')::int,
    count(*) filter (where reservation.status = 'cancelled_by_seller')::int,
    count(*) filter (where reservation.status = 'expired_no_show')::int,
    count(*) filter (where reservation.status = 'failed_stock_mismatch')::int
  into
    v_fulfilled,
    v_cancelled_by_seller,
    v_expired_no_show,
    v_failed_stock_mismatch
  from public.reservations_v2 as reservation
  join public.offers_v2 as offer on offer.id = reservation.offer_id
  where offer.store_id = p_store_id
    and reservation.created_at >= v_generated_at - interval '7 days';

  return jsonb_build_object(
    'storeName', v_store_name,
    'generatedAt', v_generated_at,
    'staleVerification', v_stale_verification,
    'expiryRisk', v_expiry_risk,
    'openExceptions', v_open_exceptions,
    'pausedOffers', v_paused_offers,
    'countActivity7d', jsonb_build_object(
      'daysWithCountSession', v_count_days,
      'days', 7
    ),
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

revoke execute on function public.compose_owner_digest_v2(uuid) from public, anon, authenticated;
grant execute on function public.compose_owner_digest_v2(uuid) to authenticated;

notify pgrst, 'reload schema';
