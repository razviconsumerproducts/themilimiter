-- Stage 11: database-enforced commercial lifecycle.

create or replace function public.guard_project_approval_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    if not (
      (old.status = 'PENDING' and new.status in ('APPROVED','REJECTED')) or
      (old.status = 'APPROVED' and new.status in ('REVOKED','SUPERSEDED')) or
      (old.status = 'REJECTED' and new.status = 'SUPERSEDED') or
      (old.status = 'REVOKED' and new.status = 'SUPERSEDED')
    ) then
      raise exception 'Invalid approval lifecycle transition: % -> %', old.status, new.status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_project_approval_lifecycle_guard on public.project_approvals;
create trigger trg_project_approval_lifecycle_guard
before update of status on public.project_approvals
for each row execute function public.guard_project_approval_lifecycle();

create or replace function public.guard_payment_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    if not (
      (old.status = 'PENDING' and new.status in ('RECEIVED','FAILED','REVERSED','REFUNDED')) or
      (old.status = 'RECEIVED' and new.status in ('VERIFIED','FAILED','REVERSED','REFUNDED')) or
      (old.status = 'VERIFIED' and new.status in ('REVERSED','REFUNDED')) or
      (old.status = 'FAILED' and new.status in ('PENDING','RECEIVED'))
    ) then
      raise exception 'Invalid payment lifecycle transition: % -> %', old.status, new.status;
    end if;
  end if;

  if new.status = 'VERIFIED' and (new.verified_by is null or new.verified_at is null) then
    raise exception 'Verified payment requires verified_by and verified_at';
  end if;

  if old.status = 'VERIFIED' and (
    new.project_id is distinct from old.project_id or
    new.quotation_id is distinct from old.quotation_id or
    new.payment_schedule_id is distinct from old.payment_schedule_id or
    new.payment_date is distinct from old.payment_date or
    new.amount is distinct from old.amount or
    new.currency is distinct from old.currency or
    new.payment_method is distinct from old.payment_method or
    new.reference_number is distinct from old.reference_number
  ) then
    raise exception 'Verified payments are financially immutable; reverse/refund before correction.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_payment_lifecycle_guard on public.payments;
create trigger trg_payment_lifecycle_guard
before update on public.payments
for each row execute function public.guard_payment_lifecycle();

create or replace function public.guard_commercial_release_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    if not (
      (old.status = 'NOT_READY' and new.status in ('READY','BLOCKED')) or
      (old.status = 'READY' and new.status in ('RELEASED','BLOCKED','NOT_READY')) or
      (old.status = 'BLOCKED' and new.status in ('READY','NOT_READY')) or
      (old.status = 'RELEASED' and new.status = 'REVOKED') or
      (old.status = 'REVOKED' and new.status in ('READY','NOT_READY'))
    ) then
      raise exception 'Invalid commercial release lifecycle transition: % -> %', old.status, new.status;
    end if;
  end if;

  if new.status = 'RELEASED' and (new.released_by is null or new.released_at is null) then
    raise exception 'Released commercial gate requires released_by and released_at';
  end if;

  if new.status = 'RELEASED' and (
    new.approval_satisfied = false or new.verified_advance < new.required_advance
  ) then
    raise exception 'Commercial release requires satisfied approval and verified advance';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_commercial_release_lifecycle_guard on public.commercial_release_gates;
create trigger trg_commercial_release_lifecycle_guard
before update of status, released_by, released_at, approval_satisfied, verified_advance on public.commercial_release_gates
for each row execute function public.guard_commercial_release_lifecycle();

create or replace function public.guard_payment_schedule_totals()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_quote_total numeric;
  v_total numeric;
  v_percent numeric;
begin
  select grand_total into v_quote_total from public.quotations where id = new.quotation_id;
  if v_quote_total is null then
    raise exception 'Payment schedule requires an existing quotation';
  end if;

  select coalesce(sum(amount),0), coalesce(sum(percentage),0)
    into v_total, v_percent
  from public.payment_schedules
  where quotation_id = new.quotation_id
    and id <> new.id
    and status <> 'CANCELLED';

  if v_total + new.amount > v_quote_total then
    raise exception 'Payment schedules cannot exceed quotation grand total';
  end if;
  if v_percent + new.percentage > 100 then
    raise exception 'Payment schedule percentages cannot exceed 100 percent';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_payment_schedule_totals_guard on public.payment_schedules;
create trigger trg_payment_schedule_totals_guard
before insert or update of quotation_id, amount, percentage, status on public.payment_schedules
for each row execute function public.guard_payment_schedule_totals();
