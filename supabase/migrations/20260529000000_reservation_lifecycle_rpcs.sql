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
