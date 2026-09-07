-- Canonical quotation lifecycle history.
create table if not exists public.quotation_status_history (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete restrict,
  from_status text,
  to_status text not null,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  reason text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists quotation_status_history_quote_idx
  on public.quotation_status_history(quotation_id, changed_at desc);

alter table public.quotation_status_history enable row level security;
drop policy if exists "authenticated can access quotation status history" on public.quotation_status_history;
create policy "authenticated can access quotation status history"
  on public.quotation_status_history for all to authenticated
  using (true) with check (true);

create or replace function public.record_quotation_status_history()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.quotation_status_history
      (quotation_id, from_status, to_status, changed_by, changed_at, metadata)
    values
      (new.id, null, new.status, coalesce(auth.uid(), new.created_by), now(), jsonb_build_object('event','CREATED'));
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.quotation_status_history
      (quotation_id, from_status, to_status, changed_by, changed_at, metadata)
    values
      (new.id, old.status, new.status, auth.uid(), now(), jsonb_build_object('event','STATUS_CHANGE'));
  end if;
  return new;
end;
$$;

drop trigger if exists quotations_status_history on public.quotations;
create trigger quotations_status_history
after insert or update of status on public.quotations
for each row execute function public.record_quotation_status_history();

-- Final DB authority for lifecycle transitions.
create or replace function public.validate_quotation_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status = old.status then return new; end if;

  if old.status = 'DRAFT' and new.status not in ('INTERNAL_REVIEW','CANCELLED') then
    raise exception 'Invalid quotation transition: DRAFT -> %', new.status;
  elsif old.status = 'INTERNAL_REVIEW' and new.status not in ('APPROVED','REJECTED','CANCELLED') then
    raise exception 'Invalid quotation transition: INTERNAL_REVIEW -> %', new.status;
  elsif old.status = 'APPROVED' and new.status not in ('ISSUED','CANCELLED','SUPERSEDED') then
    raise exception 'Invalid quotation transition: APPROVED -> %', new.status;
  elsif old.status = 'ISSUED' and new.status not in ('SENT','VIEWED','ACCEPTED','REJECTED','EXPIRED','CANCELLED','SUPERSEDED') then
    raise exception 'Invalid quotation transition: ISSUED -> %', new.status;
  elsif old.status = 'SENT' and new.status not in ('VIEWED','ACCEPTED','REJECTED','EXPIRED','CANCELLED','SUPERSEDED') then
    raise exception 'Invalid quotation transition: SENT -> %', new.status;
  elsif old.status = 'VIEWED' and new.status not in ('ACCEPTED','REJECTED','EXPIRED','CANCELLED','SUPERSEDED') then
    raise exception 'Invalid quotation transition: VIEWED -> %', new.status;
  elsif old.status in ('ACCEPTED','REJECTED','EXPIRED','CANCELLED','SUPERSEDED') then
    raise exception 'Terminal quotation status % cannot transition to %; create a new quotation version', old.status, new.status;
  end if;

  if new.status in ('ISSUED','SENT','VIEWED') and new.issued_at is null then
    raise exception 'Quotation % requires issued_at', new.status;
  end if;
  if new.status = 'ACCEPTED' then
    if new.accepted_at is null then raise exception 'Accepted quotation requires accepted_at'; end if;
    if new.valid_until is not null and new.accepted_at::date > new.valid_until then
      raise exception 'Expired quotation cannot be accepted';
    end if;
  end if;
  if new.status = 'REJECTED' and new.rejected_at is null then
    raise exception 'Rejected quotation requires rejected_at';
  end if;
  if new.status = 'EXPIRED' and new.expired_at is null then
    raise exception 'Expired quotation requires expired_at';
  end if;
  return new;
end;
$$;

drop trigger if exists quotations_validate_status on public.quotations;
create trigger quotations_validate_status
before update of status on public.quotations
for each row execute function public.validate_quotation_status_transition();

-- Transaction-safe creation of the next quotation version. The source quote is
-- never mutated except for marking it SUPERSEDED after the new snapshot exists.
create or replace function public.create_quotation_version(
  p_source_quotation_id uuid,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.quotations%rowtype;
  v_new_id uuid;
  v_next_version integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into v_source
  from public.quotations
  where id = p_source_quotation_id
  for update;
  if not found then raise exception 'Source quotation not found'; end if;

  if v_source.status not in ('ACCEPTED','REJECTED','EXPIRED','CANCELLED') then
    raise exception 'Quotation versioning requires a closed source quotation';
  end if;

  select coalesce(max(version), 0) + 1 into v_next_version
  from public.quotations
  where project_id = v_source.project_id and quotation_code = v_source.quotation_code;

  insert into public.quotations (
    project_id, customer_id, costing_run_id, quotation_code, version, status,
    quotation_date, valid_until, currency, subtotal, discount, taxable_amount,
    tax_amount, payment_terms, delivery_terms, installation_terms, warranty_terms,
    notes, customer_notes, cost_snapshot, commercial_snapshot, created_by
  ) values (
    v_source.project_id, v_source.customer_id, v_source.costing_run_id,
    v_source.quotation_code, v_next_version, 'DRAFT', current_date, v_source.valid_until,
    v_source.currency, v_source.subtotal, v_source.discount, v_source.taxable_amount,
    v_source.tax_amount, v_source.payment_terms, v_source.delivery_terms,
    v_source.installation_terms, v_source.warranty_terms, v_source.notes,
    v_source.customer_notes, v_source.cost_snapshot,
    v_source.commercial_snapshot || jsonb_build_object('versioned_from', v_source.id, 'version_reason', p_reason),
    auth.uid()
  ) returning id into v_new_id;

  insert into public.quotation_items (
    quotation_id, item_type, source_type, source_id, item_code, description,
    quantity, unit, unit_price, discount, tax_rate, tax_amount, line_total,
    sort_order, notes
  )
  select v_new_id, item_type, source_type, source_id, item_code, description,
         quantity, unit, unit_price, discount, tax_rate, tax_amount, line_total,
         sort_order, notes
  from public.quotation_items
  where quotation_id = v_source.id;

  if v_source.status = 'ACCEPTED' then
    update public.quotations
    set status = 'SUPERSEDED', updated_at = now()
    where id = v_source.id;
  end if;

  return v_new_id;
exception
  when unique_violation then
    raise exception 'Quotation version already exists; retry version creation';
end;
$$;

revoke all on function public.create_quotation_version(uuid,text) from public;
grant execute on function public.create_quotation_version(uuid,text) to authenticated;
