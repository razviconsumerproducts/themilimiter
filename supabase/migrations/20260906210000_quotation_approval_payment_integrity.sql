-- MILLIMETRE V1 commercial integrity gates
-- Prevent approval/payment records from crossing project, quotation, or customer
-- boundaries, and make the commercial release gate derive from canonical facts.

-- -----------------------------------------------------------------------------
-- QUOTATION -> COSTING / PROJECT / CUSTOMER
-- -----------------------------------------------------------------------------
create or replace function public.validate_quotation_commercial_lineage()
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

  select p.customer_id
    into v_project_customer
  from public.projects p
  where p.id = new.project_id;

  if v_project_customer is null or v_project_customer <> new.customer_id then
    raise exception 'Quotation customer must match the project customer';
  end if;

  if new.valid_until is not null and new.valid_until < new.quotation_date then
    raise exception 'Quotation validity date cannot precede quotation date';
  end if;

  return new;
end;
$$;

drop trigger if exists quotations_validate_commercial_lineage on public.quotations;
create trigger quotations_validate_commercial_lineage
before insert or update of project_id, customer_id, costing_run_id, quotation_date, valid_until
on public.quotations
for each row execute function public.validate_quotation_commercial_lineage();

-- Customer acceptance is a controlled commercial transition, not a freely
-- writable status. A quotation must first have been issued/sent/viewed.
create or replace function public.validate_quotation_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'ACCEPTED' then
    if tg_op = 'INSERT' or old.status not in ('ISSUED','SENT','VIEWED') then
      raise exception 'Quotation can only be accepted after it has been issued, sent, or viewed';
    end if;
    if new.accepted_at is null then
      raise exception 'Accepted quotation requires accepted_at';
    end if;
    if new.valid_until is not null and new.valid_until < new.accepted_at::date then
      raise exception 'Expired quotation cannot be accepted';
    end if;
  end if;

  if new.status in ('ISSUED','SENT','VIEWED') and new.issued_at is null then
    raise exception 'Issued/sent/viewed quotation requires issued_at';
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

drop trigger if exists quotations_validate_status_transition on public.quotations;
create trigger quotations_validate_status_transition
before insert or update of status, issued_at, accepted_at, rejected_at, expired_at, valid_until
on public.quotations
for each row execute function public.validate_quotation_status_transition();

-- -----------------------------------------------------------------------------
-- APPROVAL / PAYMENT -> QUOTATION / PROJECT
-- -----------------------------------------------------------------------------
create or replace function public.validate_project_approval_lineage()
returns trigger
language plpgsql
as $$
declare
  v_quote_project uuid;
  v_quote_total numeric;
begin
  select q.project_id, q.grand_total
    into v_quote_project, v_quote_total
  from public.quotations q
  where q.id = new.quotation_id;

  if v_quote_project is null or v_quote_project <> new.project_id then
    raise exception 'Approval quotation must belong to the same project';
  end if;

  if new.approved_amount is not null and new.approved_amount > v_quote_total then
    raise exception 'Approved amount cannot exceed quotation grand total';
  end if;

  if new.status = 'APPROVED' and (new.approved_by is null or new.approved_at is null) then
    raise exception 'Approved project approval requires approved_by and approved_at';
  end if;

  return new;
end;
$$;

drop trigger if exists project_approvals_validate_lineage on public.project_approvals;
create trigger project_approvals_validate_lineage
before insert or update of project_id, quotation_id, approved_amount, status, approved_by, approved_at
on public.project_approvals
for each row execute function public.validate_project_approval_lineage();

create or replace function public.validate_payment_schedule_lineage()
returns trigger
language plpgsql
as $$
declare
  v_quote_project uuid;
  v_quote_total numeric;
  v_schedule_total numeric;
  v_pct_total numeric;
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

  select coalesce(sum(ps.amount), 0), coalesce(sum(ps.percentage), 0)
    into v_schedule_total, v_pct_total
  from public.payment_schedules ps
  where ps.quotation_id = new.quotation_id
    and ps.id <> new.id
    and ps.status <> 'CANCELLED';

  if v_schedule_total + new.amount > v_quote_total then
    raise exception 'Active payment schedules cannot exceed quotation grand total';
  end if;

  if v_pct_total + new.percentage > 100 then
    raise exception 'Active payment schedule percentages cannot exceed 100 percent';
  end if;

  return new;
end;
$$;

drop trigger if exists payment_schedules_validate_lineage on public.payment_schedules;
create trigger payment_schedules_validate_lineage
before insert or update of project_id, quotation_id, amount, percentage, status
on public.payment_schedules
for each row execute function public.validate_payment_schedule_lineage();

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

    if v_schedule_project is null
       or v_schedule_project <> new.project_id
       or v_schedule_quote <> new.quotation_id then
      raise exception 'Payment schedule must belong to the same project and quotation';
    end if;
  end if;

  if new.status = 'VERIFIED' and (new.verified_by is null or new.verified_at is null) then
    raise exception 'Verified payment requires verified_by and verified_at';
  end if;

  select coalesce(sum(pa.amount), 0)
    into v_allocated
  from public.payment_allocations pa
  where pa.payment_id = new.id;

  if v_allocated > new.amount then
    raise exception 'Payment allocations cannot exceed payment amount';
  end if;

  return new;
end;
$$;

drop trigger if exists payments_validate_lineage on public.payments;
create trigger payments_validate_lineage
before insert or update of project_id, quotation_id, payment_schedule_id, currency, amount, status, verified_by, verified_at
on public.payments
for each row execute function public.validate_payment_lineage();

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
begin
  select p.project_id, p.quotation_id, p.amount
    into v_payment_project, v_payment_quote, v_payment_amount
  from public.payments p
  where p.id = new.payment_id;

  select ps.project_id, ps.quotation_id, ps.amount
    into v_schedule_project, v_schedule_quote, v_schedule_amount
  from public.payment_schedules ps
  where ps.id = new.payment_schedule_id;

  if v_payment_project is null or v_schedule_project is null
     or v_payment_project <> v_schedule_project
     or v_payment_quote <> v_schedule_quote then
    raise exception 'Payment allocation must connect records from the same project and quotation';
  end if;

  select coalesce(sum(pa.amount), 0)
    into v_payment_allocated
  from public.payment_allocations pa
  where pa.payment_id = new.payment_id
    and pa.id <> new.id;

  if v_payment_allocated + new.amount > v_payment_amount then
    raise exception 'Payment allocations cannot exceed the payment amount';
  end if;

  select coalesce(sum(pa.amount), 0)
    into v_schedule_allocated
  from public.payment_allocations pa
  where pa.payment_schedule_id = new.payment_schedule_id
    and pa.id <> new.id;

  if v_schedule_allocated + new.amount > v_schedule_amount then
    raise exception 'Payment allocations cannot exceed the payment schedule amount';
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
-- The gate's approval_satisfied and verified_advance fields are derived from
-- canonical approval/payment rows. Clients cannot manufacture readiness by
-- setting those booleans or amounts directly.
create or replace function public.refresh_commercial_release_gate(p_quotation_id uuid)
returns void
language plpgsql
as $$
declare
  v_gate record;
  v_quote_project uuid;
  v_quote_status text;
  v_required_approval boolean;
  v_required_advance numeric;
  v_approval_satisfied boolean;
  v_verified_advance numeric;
  v_ready boolean;
  v_status text;
begin
  select crg.* into v_gate
  from public.commercial_release_gates crg
  where crg.quotation_id = p_quotation_id;

  if not found then
    return;
  end if;

  select q.project_id, q.status
    into v_quote_project, v_quote_status
  from public.quotations q
  where q.id = p_quotation_id;

  if v_quote_project is null or v_quote_project <> v_gate.project_id then
    raise exception 'Commercial release gate quotation must belong to the same project';
  end if;

  v_required_approval := v_gate.required_approval;
  v_required_advance := greatest(0, v_gate.required_advance);

  select exists (
    select 1
    from public.project_approvals pa
    where pa.quotation_id = p_quotation_id
      and pa.project_id = v_gate.project_id
      and pa.status = 'APPROVED'
      and (pa.approved_amount is null or pa.approved_amount >= (
        select q.grand_total from public.quotations q where q.id = p_quotation_id
      ))
  ) into v_approval_satisfied;

  select coalesce(sum(p.amount), 0)
    into v_verified_advance
  from public.payments p
  where p.quotation_id = p_quotation_id
    and p.project_id = v_gate.project_id
    and p.status = 'VERIFIED';

  v_ready := v_quote_status = 'ACCEPTED'
    and (not v_required_approval or v_approval_satisfied)
    and v_verified_advance >= v_required_advance;

  if v_gate.status = 'RELEASED' and not v_ready then
    v_status := 'REVOKED';
  elsif v_gate.status = 'RELEASED' then
    v_status := 'RELEASED';
  elsif v_ready then
    v_status := 'READY';
  else
    v_status := 'NOT_READY';
  end if;

  update public.commercial_release_gates
  set approval_satisfied = v_approval_satisfied,
      verified_advance = v_verified_advance,
      status = v_status,
      gate_snapshot = jsonb_build_object(
        'quotation_id', p_quotation_id,
        'quotation_status', v_quote_status,
        'required_approval', v_required_approval,
        'approval_satisfied', v_approval_satisfied,
        'required_advance', v_required_advance,
        'verified_advance', v_verified_advance,
        'ready', v_ready,
        'refreshed_at', now()
      ),
      updated_at = now()
  where id = v_gate.id;
end;
$$;

create or replace function public.validate_commercial_release_gate()
returns trigger
language plpgsql
as $$
begin
  if new.required_advance < 0 then
    raise exception 'Required advance cannot be negative';
  end if;

  if new.status = 'RELEASED' then
    if new.released_by is null or new.released_at is null then
      raise exception 'Released commercial gate requires released_by and released_at';
    end if;
    if new.approval_satisfied = false then
      raise exception 'Commercial release gate cannot be released without required approval';
    end if;
    if new.verified_advance < new.required_advance then
      raise exception 'Commercial release gate cannot be released before the required verified advance';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists commercial_release_gates_validate on public.commercial_release_gates;
create trigger commercial_release_gates_validate
before insert or update on public.commercial_release_gates
for each row execute function public.validate_commercial_release_gate();

create or replace function public.refresh_commercial_gate_after_change()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'quotations' then
    perform public.refresh_commercial_release_gate(coalesce(new.id, old.id));
  elsif tg_table_name = 'project_approvals' then
    perform public.refresh_commercial_release_gate(coalesce(new.quotation_id, old.quotation_id));
  elsif tg_table_name = 'payments' then
    perform public.refresh_commercial_release_gate(coalesce(new.quotation_id, old.quotation_id));
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists quotations_refresh_commercial_gate on public.quotations;
create trigger quotations_refresh_commercial_gate
after insert or update or delete on public.quotations
for each row execute function public.refresh_commercial_gate_after_change();

drop trigger if exists project_approvals_refresh_commercial_gate on public.project_approvals;
create trigger project_approvals_refresh_commercial_gate
after insert or update or delete on public.project_approvals
for each row execute function public.refresh_commercial_gate_after_change();

drop trigger if exists payments_refresh_commercial_gate on public.payments;
create trigger payments_refresh_commercial_gate
after insert or update or delete on public.payments
for each row execute function public.refresh_commercial_gate_after_change();

create index if not exists quotations_customer_costing_idx on public.quotations(customer_id, costing_run_id);
create index if not exists project_approvals_quotation_status_idx on public.project_approvals(quotation_id, status);
create index if not exists payments_quotation_status_idx on public.payments(quotation_id, status);
create index if not exists payment_allocations_payment_idx on public.payment_allocations(payment_id);
