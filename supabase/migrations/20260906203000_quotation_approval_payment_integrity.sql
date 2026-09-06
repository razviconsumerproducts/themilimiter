-- MILLIMETRE V1 commercial integrity gates
-- Quotation -> approval -> verified payment -> commercial release.
-- Downstream release state is derived from canonical quotation/payment records;
-- client-supplied snapshots and amounts are never treated as authoritative.

-- -----------------------------------------------------------------------------
-- QUOTATION -> COSTING / PROJECT / CUSTOMER
-- -----------------------------------------------------------------------------
create or replace function public.validate_quotation_upstream_lineage()
returns trigger
language plpgsql
as $$
declare
  v_cost_project uuid;
  v_cost_status text;
  v_project_customer uuid;
begin
  select cr.project_id, cr.status
    into v_cost_project, v_cost_status
  from public.costing_runs cr
  where cr.id = new.costing_run_id;

  if v_cost_project is null or v_cost_project <> new.project_id then
    raise exception 'Quotation costing run must belong to the same project';
  end if;

  if v_cost_status not in ('APPROVED','LOCKED') then
    raise exception 'Quotation requires an approved or locked costing run';
  end if;

  select p.customer_id into v_project_customer
  from public.projects p
  where p.id = new.project_id;

  if v_project_customer is null or v_project_customer <> new.customer_id then
    raise exception 'Quotation customer must match the project customer';
  end if;

  if new.valid_until is not null and new.valid_until < new.quotation_date then
    raise exception 'Quotation valid_until cannot be before quotation_date';
  end if;

  return new;
end;
$$;

drop trigger if exists quotations_validate_upstream_lineage on public.quotations;
create trigger quotations_validate_upstream_lineage
before insert or update of project_id, customer_id, costing_run_id, quotation_date, valid_until
on public.quotations
for each row execute function public.validate_quotation_upstream_lineage();

-- -----------------------------------------------------------------------------
-- APPROVAL -> QUOTATION / PROJECT / AMOUNT
-- -----------------------------------------------------------------------------
create or replace function public.validate_project_approval_lineage()
returns trigger
language plpgsql
as $$
declare
  v_quote_project uuid;
  v_quote_status text;
  v_quote_total numeric;
begin
  select q.project_id, q.status, q.grand_total
    into v_quote_project, v_quote_status, v_quote_total
  from public.quotations q
  where q.id = new.quotation_id;

  if v_quote_project is null or v_quote_project <> new.project_id then
    raise exception 'Approval quotation must belong to the same project';
  end if;

  if new.approved_amount is not null and new.approved_amount < 0 then
    raise exception 'Approval amount cannot be negative';
  end if;

  if new.approved_amount is not null and new.approved_amount > v_quote_total then
    raise exception 'Approval amount cannot exceed quotation grand total';
  end if;

  if new.status = 'APPROVED' then
    if v_quote_status not in ('ISSUED','SENT','VIEWED','ACCEPTED') then
      raise exception 'Approval requires an issued quotation';
    end if;
    if new.approved_by is null or new.approved_at is null then
      raise exception 'Approved approval requires approver and approval timestamp';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists project_approvals_validate_lineage on public.project_approvals;
create trigger project_approvals_validate_lineage
before insert or update of project_id, quotation_id, approved_amount, status, approved_by, approved_at
on public.project_approvals
for each row execute function public.validate_project_approval_lineage();

-- -----------------------------------------------------------------------------
-- PAYMENT SCHEDULE -> QUOTATION / PROJECT / TOTAL
-- -----------------------------------------------------------------------------
create or replace function public.validate_payment_schedule_lineage()
returns trigger
language plpgsql
as $$
declare
  v_quote_project uuid;
  v_quote_total numeric;
  v_schedule_total numeric;
begin
  select q.project_id, q.grand_total
    into v_quote_project, v_quote_total
  from public.quotations q
  where q.id = new.quotation_id;

  if v_quote_project is null or v_quote_project <> new.project_id then
    raise exception 'Payment schedule quotation must belong to the same project';
  end if;

  if new.amount > v_quote_total then
    raise exception 'Payment schedule amount cannot exceed quotation grand total';
  end if;

  select coalesce(sum(ps.amount), 0)
    into v_schedule_total
  from public.payment_schedules ps
  where ps.quotation_id = new.quotation_id
    and ps.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    and ps.status <> 'CANCELLED';

  if v_schedule_total + new.amount > v_quote_total then
    raise exception 'Active payment schedules cannot exceed quotation grand total';
  end if;

  return new;
end;
$$;

drop trigger if exists payment_schedules_validate_lineage on public.payment_schedules;
create trigger payment_schedules_validate_lineage
before insert or update of project_id, quotation_id, amount, status
on public.payment_schedules
for each row execute function public.validate_payment_schedule_lineage();

-- -----------------------------------------------------------------------------
-- PAYMENT -> QUOTATION / SCHEDULE / CURRENCY
-- -----------------------------------------------------------------------------
create or replace function public.validate_payment_lineage()
returns trigger
language plpgsql
as $$
declare
  v_quote_project uuid;
  v_quote_currency text;
  v_schedule_project uuid;
  v_schedule_quote uuid;
  v_allocated numeric;
begin
  select q.project_id, q.currency
    into v_quote_project, v_quote_currency
  from public.quotations q
  where q.id = new.quotation_id;

  if v_quote_project is null or v_quote_project <> new.project_id then
    raise exception 'Payment quotation must belong to the same project';
  end if;

  if new.currency <> v_quote_currency then
    raise exception 'Payment currency must match quotation currency';
  end if;

  if new.payment_schedule_id is not null then
    select ps.project_id, ps.quotation_id
      into v_schedule_project, v_schedule_quote
    from public.payment_schedules ps
    where ps.id = new.payment_schedule_id;

    if v_schedule_project is null or v_schedule_project <> new.project_id or v_schedule_quote <> new.quotation_id then
      raise exception 'Payment schedule must belong to the same quotation and project';
    end if;
  end if;

  if new.status = 'VERIFIED' then
    select coalesce(sum(pa.amount), 0)
      into v_allocated
    from public.payment_allocations pa
    where pa.payment_id = new.id;

    if v_allocated <> new.amount then
      raise exception 'Verified payment must be fully allocated';
    end if;

    if new.verified_by is null or new.verified_at is null then
      raise exception 'Verified payment requires verifier and verification timestamp';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists payments_validate_lineage on public.payments;
create trigger payments_validate_lineage
before insert or update of project_id, quotation_id, payment_schedule_id, currency, amount, status, verified_by, verified_at
on public.payments
for each row execute function public.validate_payment_lineage();

-- -----------------------------------------------------------------------------
-- PAYMENT ALLOCATION -> PAYMENT / SCHEDULE / AMOUNT
-- -----------------------------------------------------------------------------
create or replace function public.validate_payment_allocation_lineage()
returns trigger
language plpgsql
as $$
declare
  v_payment_project uuid;
  v_payment_quote uuid;
  v_payment_amount numeric;
  v_schedule_project uuid;
  v_schedule_quote uuid;
  v_schedule_amount numeric;
  v_payment_allocated numeric;
  v_schedule_allocated numeric;
  v_payment_status text;
begin
  select p.project_id, p.quotation_id, p.amount, p.status
    into v_payment_project, v_payment_quote, v_payment_amount, v_payment_status
  from public.payments p
  where p.id = new.payment_id;

  select ps.project_id, ps.quotation_id, ps.amount
    into v_schedule_project, v_schedule_quote, v_schedule_amount
  from public.payment_schedules ps
  where ps.id = new.payment_schedule_id;

  if v_payment_project is null or v_schedule_project is null
     or v_payment_project <> v_schedule_project
     or v_payment_quote <> v_schedule_quote then
    raise exception 'Payment allocation must stay within the same quotation and project';
  end if;

  if new.amount > v_payment_amount then
    raise exception 'Payment allocation cannot exceed payment amount';
  end if;

  if new.amount > v_schedule_amount then
    raise exception 'Payment allocation cannot exceed payment schedule amount';
  end if;

  select coalesce(sum(pa.amount), 0)
    into v_payment_allocated
  from public.payment_allocations pa
  where pa.payment_id = new.payment_id
    and pa.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_payment_allocated + new.amount > v_payment_amount then
    raise exception 'Payment allocations cannot exceed payment amount';
  end if;

  select coalesce(sum(pa.amount), 0)
    into v_schedule_allocated
  from public.payment_allocations pa
  where pa.payment_schedule_id = new.payment_schedule_id
    and pa.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_schedule_allocated + new.amount > v_schedule_amount then
    raise exception 'Payment allocations cannot exceed payment schedule amount';
  end if;

  if v_payment_status in ('FAILED','REVERSED','REFUNDED') then
    raise exception 'Failed, reversed, or refunded payments cannot receive allocations';
  end if;

  return new;
end;
$$;

drop trigger if exists payment_allocations_validate_lineage on public.payment_allocations;
create trigger payment_allocations_validate_lineage
before insert or update of payment_id, payment_schedule_id, amount
on public.payment_allocations
for each row execute function public.validate_payment_allocation_lineage();

-- -----------------------------------------------------------------------------
-- COMMERCIAL RELEASE GATE
-- -----------------------------------------------------------------------------
create or replace function public.refresh_commercial_release_gate(p_quotation_id uuid)
returns void
language plpgsql
as $$
declare
  v_project_id uuid;
  v_quote_status text;
  v_quote_total numeric;
  v_required_approval boolean;
  v_required_advance numeric;
  v_approval_satisfied boolean;
  v_verified_advance numeric;
  v_status text;
  v_ready boolean;
  v_gate_id uuid;
begin
  select q.project_id, q.status, q.grand_total
    into v_project_id, v_quote_status, v_quote_total
  from public.quotations q
  where q.id = p_quotation_id;

  if v_project_id is null then
    raise exception 'Commercial gate requires an existing quotation';
  end if;

  select cg.id, cg.required_approval, least(cg.required_advance, v_quote_total)
    into v_gate_id, v_required_approval, v_required_advance
  from public.commercial_release_gates cg
  where cg.quotation_id = p_quotation_id;

  if v_gate_id is null then
    v_required_approval := true;
    v_required_advance := 0;
  end if;

  select exists (
    select 1
    from public.project_approvals pa
    where pa.quotation_id = p_quotation_id
      and pa.project_id = v_project_id
      and pa.status = 'APPROVED'
      and pa.approved_amount is not null
      and pa.approved_amount >= v_quote_total
  ) into v_approval_satisfied;

  select coalesce(sum(p.amount), 0)
    into v_verified_advance
  from public.payments p
  where p.quotation_id = p_quotation_id
    and p.project_id = v_project_id
    and p.status = 'VERIFIED';

  v_ready := v_quote_status = 'ACCEPTED'
    and (not v_required_approval or v_approval_satisfied)
    and v_verified_advance >= v_required_advance;

  if v_ready then
    v_status := 'READY';
  else
    v_status := 'NOT_READY';
  end if;

  insert into public.commercial_release_gates (
    project_id, quotation_id, status, required_approval, approval_satisfied,
    required_advance, verified_advance, gate_snapshot, updated_at
  ) values (
    v_project_id, p_quotation_id, v_status, v_required_approval, v_approval_satisfied,
    v_required_advance, v_verified_advance,
    jsonb_build_object(
      'quotation_status', v_quote_status,
      'quotation_grand_total', v_quote_total,
      'approval_satisfied', v_approval_satisfied,
      'required_advance', v_required_advance,
      'verified_advance', v_verified_advance,
      'evaluated_at', now()
    ), now()
  )
  on conflict (quotation_id) do update set
    project_id = excluded.project_id,
    status = case
      when public.commercial_release_gates.status = 'RELEASED' and v_ready then 'RELEASED'
      when public.commercial_release_gates.status = 'RELEASED' and not v_ready then 'REVOKED'
      else excluded.status
    end,
    approval_satisfied = excluded.approval_satisfied,
    required_advance = excluded.required_advance,
    verified_advance = excluded.verified_advance,
    gate_snapshot = excluded.gate_snapshot,
    updated_at = now();
end;
$$;

-- Only RELEASED is a manufacturing/commercial authorization. It is allowed
-- when the canonical gate currently evaluates READY; otherwise it is blocked.
create or replace function public.validate_commercial_release_gate()
returns trigger
language plpgsql
as $$
declare
  v_quote_project uuid;
  v_quote_status text;
  v_quote_total numeric;
  v_approval_satisfied boolean;
  v_verified_advance numeric;
begin
  select q.project_id, q.status, q.grand_total
    into v_quote_project, v_quote_status, v_quote_total
  from public.quotations q
  where q.id = new.quotation_id;

  if v_quote_project is null or v_quote_project <> new.project_id then
    raise exception 'Commercial release gate quotation must belong to the same project';
  end if;

  if new.required_advance < 0 or new.required_advance > v_quote_total then
    raise exception 'Required advance must be between zero and quotation grand total';
  end if;

  select exists (
    select 1
    from public.project_approvals pa
    where pa.quotation_id = new.quotation_id
      and pa.project_id = new.project_id
      and pa.status = 'APPROVED'
      and pa.approved_amount >= v_quote_total
  ) into v_approval_satisfied;

  select coalesce(sum(p.amount), 0)
    into v_verified_advance
  from public.payments p
  where p.quotation_id = new.quotation_id
    and p.project_id = new.project_id
    and p.status = 'VERIFIED';

  if new.approval_satisfied <> v_approval_satisfied then
    raise exception 'Commercial gate approval_satisfied is derived from canonical approvals';
  end if;

  if new.verified_advance <> v_verified_advance then
    raise exception 'Commercial gate verified_advance is derived from verified payments';
  end if;

  if new.status = 'RELEASED' then
    if v_quote_status <> 'ACCEPTED' then
      raise exception 'Commercial release requires an accepted quotation';
    end if;
    if new.required_approval and not v_approval_satisfied then
      raise exception 'Commercial release requires full approved quotation amount';
    end if;
    if v_verified_advance < new.required_advance then
      raise exception 'Commercial release requires the required verified advance';
    end if;
    if new.released_by is null or new.released_at is null then
      raise exception 'Released commercial gate requires releaser and release timestamp';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists commercial_release_gates_validate on public.commercial_release_gates;
create trigger commercial_release_gates_validate
before insert or update of project_id, quotation_id, status, required_approval,
  approval_satisfied, required_advance, verified_advance, released_by, released_at
on public.commercial_release_gates
for each row execute function public.validate_commercial_release_gate();

-- Keep the gate current when any canonical commercial input changes.
create or replace function public.refresh_gate_from_quotation()
returns trigger
language plpgsql
as $$
begin
  perform public.refresh_commercial_release_gate(coalesce(new.id, old.id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists quotations_refresh_commercial_gate on public.quotations;
create trigger quotations_refresh_commercial_gate
after update of status, grand_total on public.quotations
for each row execute function public.refresh_gate_from_quotation();

drop trigger if exists approvals_refresh_commercial_gate on public.project_approvals;
create trigger approvals_refresh_commercial_gate
after insert or update or delete on public.project_approvals
for each row execute function public.refresh_gate_from_quotation();

drop trigger if exists payments_refresh_commercial_gate on public.payments;
create trigger payments_refresh_commercial_gate
after insert or update or delete on public.payments
for each row execute function public.refresh_gate_from_quotation();

-- Prevent payment verification against commercial documents that are no longer
-- commercially valid.
create or replace function public.validate_verified_payment_quotation()
returns trigger
language plpgsql
as $$
declare
  v_status text;
  v_valid_until date;
begin
  if new.status = 'VERIFIED' then
    select q.status, q.valid_until into v_status, v_valid_until
    from public.quotations q
    where q.id = new.quotation_id;

    if v_status in ('REJECTED','EXPIRED','CANCELLED','SUPERSEDED') then
      raise exception 'Cannot verify payment against a rejected, expired, cancelled, or superseded quotation';
    end if;

    if v_valid_until is not null and new.payment_date > v_valid_until then
      raise exception 'Cannot verify payment after quotation validity date';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists payments_validate_quotation_status on public.payments;
create trigger payments_validate_quotation_status
before insert or update of quotation_id, payment_date, status
on public.payments
for each row execute function public.validate_verified_payment_quotation();
