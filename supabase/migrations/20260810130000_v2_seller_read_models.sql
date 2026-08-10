-- Migration D adds the three seller read models the facades need and that no
-- earlier migration could provide.
--
-- Why these are RPCs rather than views or plain table reads:
--
-- * store_exceptions has row level security on and no policy at all, plus an
--   explicit revoke for anon and authenticated. Migration C made that choice
--   deliberately and a test in the backend suite pins it. A security definer
--   function with its own membership check is therefore the only way a member
--   can read their own store's exceptions without opening the table up.
-- * The inventory summary is arithmetic over four tables, and the encumbrance
--   sum has to match the ceiling publish_offer_v2 enforces exactly. Keeping
--   the two expressions in one file, next to each other, is what stops a
--   summary from promising units publish will then refuse.
-- * A member reading a store they do not belong to has to hear forbidden. A
--   plain select through row level security returns an empty list instead,
--   which reads as "this store has nothing" rather than "this is not your
--   store". The facade contract distinguishes the two.
--
-- No function here writes the model it reports, two of them call the shared
-- lazy sweep, which can expire offers and release holds before the read
-- runs. That sweep is the same one every other list RPC already calls.

-- All offers of one store in every status, newest first.
--
-- Not the public view. The seller has to see paused, expired and withdrawn
-- offers, and the view exists precisely to hide those from buyers. The raw
-- row goes back to the facade, which redacts the internal columns and
-- enriches the store details before anything reaches a screen.
create or replace function public.list_store_offers_v2(p_store_id uuid)
returns setof public.offers_v2
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

  -- Global, the same choice list_seller_pickups_v2 and
  -- get_buyer_reservations_v2 make. A list read is not scoped to one offer,
  -- and this list has to report expiry that has already happened.
  perform public.fn_apply_offer_reservation_expiry_v2(null::uuid);

  return query
    select o.*
    from public.offers_v2 o
    where o.store_id = p_store_id
    order by o.created_at desc, o.id desc;
end;
$$;

revoke execute on function public.list_store_offers_v2(uuid) from public;
grant execute on function public.list_store_offers_v2(uuid) to authenticated;

-- The inventory summary read model.
--
-- allocated_quantity mirrors the encumbrance sum in publish_offer_v2 term for
-- term. Units sitting on the shelf for a non terminal offer count, units held
-- by a live reservation count, and units whose reservation failed a stock
-- mismatch keep counting while that mismatch is still open, because nobody
-- knows where those units are until somebody resolves it.
--
-- confidence is the stored column rather than fn_stock_confidence over
-- last_verified_at. publish_offer_v2 gates on the stored column, so a summary
-- computed any other way could advertise offerable units that publish then
-- refuses. The recompute function stays available for a surface that wants to
-- show staleness on its own terms.
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
as $$
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
      p.id,
      p.store_id,
      p.product_name,
      p.barcode,
      p.category,
      p.on_hand_quantity,
      p.confidence,
      p.last_verified_at,
      case
        when p.confidence = 'high'
          then greatest(0, p.on_hand_quantity - allocation.allocated)
        else 0
      end::int,
      allocation.allocated,
      p.expiry_date,
      exists (
        select 1
        from public.store_exceptions e
        where e.related_store_product_id = p.id
          and e.status = 'open'
      ),
      p.version
    from public.store_products p
    cross join lateral (
      select coalesce(sum(
        case
          when o.status in ('live', 'paused', 'sold_out')
            then o.quantity_available + reservation_counts.held
          else 0
        end
        + reservation_counts.failed_mismatch
      ), 0)::int as allocated
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
      where o.store_product_id = p.id
    ) allocation
    where p.store_id = p_store_id
    order by p.created_at asc, p.id asc;
end;
$$;

revoke execute on function public.list_store_inventory_v2(uuid) from public;
grant execute on function public.list_store_inventory_v2(uuid) to authenticated;

-- The store's exception log, newest first. Read only, and the only client
-- readable path to a table that is otherwise closed to anon and authenticated
-- alike.
create or replace function public.list_store_exceptions_v2(p_store_id uuid)
returns setof public.store_exceptions
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

  return query
    select e.*
    from public.store_exceptions e
    where e.store_id = p_store_id
    order by e.created_at desc, e.id desc;
end;
$$;

revoke execute on function public.list_store_exceptions_v2(uuid) from public;
grant execute on function public.list_store_exceptions_v2(uuid) to authenticated;

notify pgrst, 'reload schema';
