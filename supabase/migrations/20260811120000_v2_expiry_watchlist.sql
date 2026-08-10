-- Adds the read-only seller watchlist for products approaching expiry.
-- Suggestions stay in the client domain rules and this RPC returns facts only.

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
      p.id,
      p.product_name,
      p.expiry_date,
      (p.expiry_date - v_today)::int,
      p.on_hand_quantity,
      p.confidence,
      exists (
        select 1
        from public.store_exceptions e
        where e.related_store_product_id = p.id
          and e.status = 'open'
      ),
      (
        select o.id
        from public.offers_v2 o
        where o.store_product_id = p.id
          and o.status in ('live', 'paused')
          and o.pickup_end > now()
        order by o.created_at desc, o.id desc
        limit 1
      )
    from public.store_products p
    where p.store_id = p_store_id
      and p.expiry_date is not null
      and p.expiry_date <= v_today + 14
    order by p.expiry_date asc, p.id asc;
end;
$list_expiry_watchlist$;

revoke execute on function public.list_expiry_watchlist_v2(uuid) from public;
grant execute on function public.list_expiry_watchlist_v2(uuid) to authenticated;

notify pgrst, 'reload schema';
