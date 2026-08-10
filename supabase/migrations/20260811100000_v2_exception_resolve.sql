-- Adds the manager and owner command that closes a store exception.
-- The capacity expressions in publish_offer_v2, list_store_inventory_v2,
-- and approve_stock_adjustment_v2 already count failed mismatch reservations
-- only while the related stock mismatch exception is open. Resolving the row
-- here therefore releases those failed units without rewriting old migrations.

alter table public.store_exceptions
  add column if not exists resolution_note text;

alter table public.store_exceptions
  add column if not exists resolved_at timestamptz;

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

  v_fingerprint := p_exception_id::text;

  -- Bounded claim step matching the other seller commands.
  begin
    set local lock_timeout = '4s';

    insert into public.idempotency_keys (
      store_id,
      command,
      key,
      fingerprint,
      outcome
    ) values (
      p_store_id,
      'resolve_store_exception_v2',
      p_idempotency_key,
      v_fingerprint,
      null
    )
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
        and command = 'resolve_store_exception_v2'
        and key = p_idempotency_key;

    if v_existing_fingerprint is distinct from v_fingerprint then
      raise exception 'idempotency_conflict: key reused with different input';
    end if;
    if v_outcome is null then
      raise exception 'idempotency_conflict: concurrent duplicate still in flight';
    end if;

    v_exception := jsonb_populate_record(
      null::public.store_exceptions,
      v_outcome
    );
    return v_exception;
  end if;

  select *
    into v_exception
    from public.store_exceptions
    where id = p_exception_id
      and store_id = p_store_id
    for update;

  if not found then
    raise exception 'not_found: exception % is not in store %', p_exception_id, p_store_id;
  end if;
  if v_exception.status <> 'open' then
    raise exception 'invalid_state: exception % is already %', p_exception_id, v_exception.status;
  end if;

  update public.store_exceptions
    set status = 'resolved',
        resolution_note = p_resolution_note,
        resolved_at = now()
    where id = p_exception_id
    returning * into v_exception;

  v_outcome := to_jsonb(v_exception);
  update public.idempotency_keys
    set outcome = v_outcome
    where store_id = p_store_id
      and command = 'resolve_store_exception_v2'
      and key = p_idempotency_key;

  insert into public.audit_entries (store_id, actor, command, detail)
  values (
    p_store_id,
    auth.uid()::text,
    'resolve_store_exception_v2',
    jsonb_build_object(
      'exceptionId', v_exception.id,
      'resolutionNote', p_resolution_note
    )
  );

  insert into public.outbox_events (event_type, payload)
  values (
    'exception_resolved',
    jsonb_build_object(
      'storeId', p_store_id,
      'exceptionId', v_exception.id,
      'relatedOfferId', v_exception.related_offer_id,
      'relatedStoreProductId', v_exception.related_store_product_id
    )
  );

  return v_exception;
end;
$resolve_exception$;

revoke execute on function public.resolve_store_exception_v2(uuid, uuid, text, text) from public;
grant execute on function public.resolve_store_exception_v2(uuid, uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
