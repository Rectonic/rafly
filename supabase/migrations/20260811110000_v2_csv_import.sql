-- Canonical CSV import staging, catalog aliases, immutable quantity
-- observations, and the upload and decision commands.

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  filename text not null check (btrim(filename) <> ''),
  status text not null default 'uploaded'
    check (status in ('uploaded', 'needs_review', 'completed')),
  total_records int not null default 0 check (total_records >= 0),
  pending_records int not null default 0
    check (pending_records >= 0 and pending_records <= total_records),
  created_by uuid not null references auth.users (id),
  import_fingerprint text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (id, store_id)
);

create table if not exists public.staged_source_records (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  store_id uuid not null references public.stores (id) on delete cascade,
  raw_name text not null check (btrim(raw_name) <> ''),
  raw_barcode text,
  raw_quantity int check (raw_quantity is null or raw_quantity >= 0),
  raw_price numeric check (raw_price is null or raw_price >= 0),
  match_status text not null
    check (match_status in ('auto_matched', 'ambiguous', 'unmatched', 'approved', 'rejected')),
  matched_store_product_id uuid references public.store_products (id) on delete set null,
  candidates jsonb not null default '[]'::jsonb
    check (jsonb_typeof(candidates) = 'array'),
  decided_by uuid references auth.users (id),
  decided_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (batch_id, store_id)
    references public.import_batches (id, store_id) on delete cascade,
  unique (id, store_id)
);

create index if not exists staged_source_records_batch_idx
  on public.staged_source_records (store_id, batch_id, created_at, id);

create unique index if not exists store_products_id_store_unique
  on public.store_products (id, store_id);

create table if not exists public.product_aliases (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  store_product_id uuid not null,
  alias text not null check (btrim(alias) <> ''),
  approved boolean not null default true,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (store_product_id, store_id)
    references public.store_products (id, store_id) on delete cascade
);

create unique index if not exists product_aliases_store_lower_alias_unique
  on public.product_aliases (store_id, lower(alias));

create table if not exists public.inventory_observations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  store_product_id uuid not null,
  staged_source_record_id uuid not null,
  observed_quantity int not null check (observed_quantity >= 0),
  confidence text not null default 'low' check (confidence = 'low'),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (store_product_id, store_id)
    references public.store_products (id, store_id) on delete cascade,
  foreign key (staged_source_record_id, store_id)
    references public.staged_source_records (id, store_id) on delete cascade,
  unique (staged_source_record_id)
);

alter table public.import_batches enable row level security;
alter table public.staged_source_records enable row level security;
alter table public.product_aliases enable row level security;
alter table public.inventory_observations enable row level security;

drop policy if exists "import_batches_select_members"
  on public.import_batches;

create policy "import_batches_select_members"
  on public.import_batches
  for select
  to authenticated
  using (public.fn_current_store_role(store_id) is not null);

drop policy if exists "staged_source_records_select_members"
  on public.staged_source_records;

create policy "staged_source_records_select_members"
  on public.staged_source_records
  for select
  to authenticated
  using (public.fn_current_store_role(store_id) is not null);

drop policy if exists "product_aliases_select_members"
  on public.product_aliases;

create policy "product_aliases_select_members"
  on public.product_aliases
  for select
  to authenticated
  using (public.fn_current_store_role(store_id) is not null);

drop policy if exists "inventory_observations_select_members"
  on public.inventory_observations;

create policy "inventory_observations_select_members"
  on public.inventory_observations
  for select
  to authenticated
  using (public.fn_current_store_role(store_id) is not null);

drop trigger if exists inventory_observations_append_only
  on public.inventory_observations;

create trigger inventory_observations_append_only
  before update or delete on public.inventory_observations
  for each row execute function public.fn_reject_mutation();

drop trigger if exists inventory_observations_reject_truncate
  on public.inventory_observations;

create trigger inventory_observations_reject_truncate
  before truncate on public.inventory_observations
  for each statement execute function public.fn_reject_mutation();

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
      if jsonb_typeof(v_record -> 'rawQuantity') <> 'number' then
        raise exception 'validation_failed: raw quantity must be a nonnegative integer';
      end if;
      if (v_record ->> 'rawQuantity')::numeric < 0
        or (v_record ->> 'rawQuantity')::numeric > 2147483647
        or trunc((v_record ->> 'rawQuantity')::numeric) <> (v_record ->> 'rawQuantity')::numeric then
        raise exception 'validation_failed: raw quantity must be a nonnegative integer';
      end if;
    end if;
    if v_record ? 'rawPrice' and jsonb_typeof(v_record -> 'rawPrice') <> 'null' then
      if jsonb_typeof(v_record -> 'rawPrice') <> 'number' then
        raise exception 'validation_failed: raw price must be nonnegative';
      end if;
      if (v_record ->> 'rawPrice')::numeric < 0 then
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

    insert into public.idempotency_keys (
      store_id,
      command,
      key,
      fingerprint,
      outcome
    ) values (
      p_store_id,
      'upload_import_batch_v2',
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
    store_id,
    filename,
    status,
    total_records,
    pending_records,
    created_by,
    import_fingerprint
  ) values (
    p_store_id,
    p_filename,
    'uploaded',
    jsonb_array_length(p_records),
    jsonb_array_length(p_records),
    auth.uid(),
    v_fingerprint
  )
  returning * into v_batch;

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

    v_candidates := '[]'::jsonb;

    if v_raw_barcode is not null then
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'storeProductId', sp.id,
            'productName', sp.product_name,
            'reason', 'barcode'
          ) order by sp.id
        ),
        '[]'::jsonb
      )
        into v_candidates
        from public.store_products sp
        where sp.store_id = p_store_id
          and sp.barcode = v_raw_barcode;
    end if;

    if jsonb_array_length(v_candidates) = 0 then
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'storeProductId', sp.id,
            'productName', sp.product_name,
            'reason', 'alias'
          ) order by sp.id
        ),
        '[]'::jsonb
      )
        into v_candidates
        from public.product_aliases pa
        join public.store_products sp
          on sp.id = pa.store_product_id
         and sp.store_id = pa.store_id
        where pa.store_id = p_store_id
          and pa.approved = true
          and lower(pa.alias) = lower(v_raw_name);
    end if;

    if jsonb_array_length(v_candidates) = 0 then
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'storeProductId', sp.id,
            'productName', sp.product_name,
            'reason', 'product_name'
          ) order by sp.id
        ),
        '[]'::jsonb
      )
        into v_candidates
        from public.store_products sp
        where sp.store_id = p_store_id
          and lower(sp.product_name) = lower(v_raw_name);
    end if;

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
  update public.idempotency_keys
    set outcome = v_outcome
    where store_id = p_store_id
      and command = 'upload_import_batch_v2'
      and key = p_idempotency_key;

  return v_batch;
end;
$upload_import$;

create or replace function public.list_import_batches_v2(p_store_id uuid)
returns setof public.import_batches
language plpgsql
security definer
set search_path = public
as $list_import_batches$
declare
  v_role text;
begin
  set local row_security = off;

  v_role := public.fn_current_store_role(p_store_id);
  if v_role is null then
    raise exception 'forbidden: caller is not a member of store %', p_store_id;
  end if;

  return query
    select b.*
    from public.import_batches b
    where b.store_id = p_store_id
    order by b.created_at desc, b.id desc;
end;
$list_import_batches$;

create or replace function public.list_staged_records_v2(
  p_store_id uuid,
  p_batch_id uuid
)
returns setof public.staged_source_records
language plpgsql
security definer
set search_path = public
as $list_staged_records$
declare
  v_role text;
begin
  set local row_security = off;

  v_role := public.fn_current_store_role(p_store_id);
  if v_role is null then
    raise exception 'forbidden: caller is not a member of store %', p_store_id;
  end if;

  if not exists (
    select 1
    from public.import_batches b
    where b.id = p_batch_id
      and b.store_id = p_store_id
  ) then
    raise exception 'not_found: import batch % is not in store %', p_batch_id, p_store_id;
  end if;

  return query
    select r.*
    from public.staged_source_records r
    where r.store_id = p_store_id
      and r.batch_id = p_batch_id
    order by r.created_at asc, r.id asc;
end;
$list_staged_records$;

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

    insert into public.idempotency_keys (
      store_id,
      command,
      key,
      fingerprint,
      outcome
    ) values (
      p_store_id,
      'decide_staged_record_v2',
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
        and command = 'decide_staged_record_v2'
        and key = p_idempotency_key;

    if v_existing_fingerprint is distinct from v_fingerprint then
      raise exception 'idempotency_conflict: key reused with different input';
    end if;
    if v_outcome is null then
      raise exception 'idempotency_conflict: concurrent duplicate still in flight';
    end if;

    v_result := jsonb_populate_record(
      null::public.staged_source_records,
      v_outcome
    );
    return v_result;
  end if;

  select *
    into v_record
    from public.staged_source_records
    where id = p_record_id
      and store_id = p_store_id;

  if not found then
    raise exception 'not_found: staged record % is not in store %', p_record_id, p_store_id;
  end if;

  if p_decision = 'approve' and p_target_store_product_id is not null then
    select *
      into v_product
      from public.store_products
      where id = p_target_store_product_id
        and store_id = p_store_id
      for update;

    if not found then
      raise exception 'not_found: target product % is not in store %', p_target_store_product_id, p_store_id;
    end if;
  end if;

  select *
    into v_batch
    from public.import_batches
    where id = v_record.batch_id
      and store_id = p_store_id
    for update;

  if not found then
    raise exception 'not_found: import batch for staged record % is missing', p_record_id;
  end if;

  select *
    into v_record
    from public.staged_source_records
    where id = p_record_id
      and store_id = p_store_id
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
    if p_target_store_product_id is null then
      begin
        insert into public.store_products (
          store_id,
          product_name,
          barcode,
          on_hand_quantity,
          confidence
        ) values (
          p_store_id,
          v_record.raw_name,
          v_record.raw_barcode,
          0,
          'low'
        )
        returning * into v_product;

        insert into public.product_aliases (
          store_id,
          store_product_id,
          alias,
          approved,
          created_by
        ) values (
          p_store_id,
          v_product.id,
          v_record.raw_name,
          true,
          auth.uid()
        );
      exception when unique_violation then
        raise exception 'validation_failed: raw name is already an alias in this store';
      end;
    end if;

    v_product_id := coalesce(p_target_store_product_id, v_product.id);

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
        set confidence = 'low',
            last_verified_at = now(),
            version = version + 1
        where id = v_product_id
          and store_id = p_store_id
        returning * into v_product;

      if v_record.raw_quantity <> v_product.on_hand_quantity then
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
          version
        ) values (
          p_store_id,
          v_product_id,
          v_product.on_hand_quantity,
          v_record.raw_quantity,
          v_record.raw_quantity - v_product.on_hand_quantity,
          'count',
          'pending',
          auth.uid(),
          v_role,
          1
        );
      end if;
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
        status = case
          when pending_records = 1 then 'completed'
          else 'needs_review'
        end
    where id = v_batch.id;

  v_outcome := to_jsonb(v_result);
  update public.idempotency_keys
    set outcome = v_outcome
    where store_id = p_store_id
      and command = 'decide_staged_record_v2'
      and key = p_idempotency_key;

  insert into public.audit_entries (store_id, actor, command, detail)
  values (
    p_store_id,
    auth.uid()::text,
    'decide_staged_record_v2',
    jsonb_build_object(
      'batchId', v_batch.id,
      'recordId', v_result.id,
      'decision', p_decision,
      'targetStoreProductId', v_result.matched_store_product_id
    )
  );

  insert into public.outbox_events (event_type, payload)
  values (
    'staged_record_decided',
    jsonb_build_object(
      'storeId', p_store_id,
      'batchId', v_batch.id,
      'recordId', v_result.id,
      'decision', p_decision,
      'targetStoreProductId', v_result.matched_store_product_id
    )
  );

  return v_result;
end;
$decide_staged$;

revoke execute on function public.upload_import_batch_v2(uuid, text, jsonb, text) from public;
grant execute on function public.upload_import_batch_v2(uuid, text, jsonb, text) to authenticated;

revoke execute on function public.list_import_batches_v2(uuid) from public;
grant execute on function public.list_import_batches_v2(uuid) to authenticated;

revoke execute on function public.list_staged_records_v2(uuid, uuid) from public;
grant execute on function public.list_staged_records_v2(uuid, uuid) to authenticated;

revoke execute on function public.decide_staged_record_v2(uuid, uuid, text, uuid, text) from public;
grant execute on function public.decide_staged_record_v2(uuid, uuid, text, uuid, text) to authenticated;

notify pgrst, 'reload schema';
