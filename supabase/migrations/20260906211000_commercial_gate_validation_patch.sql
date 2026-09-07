-- Tighten the commercial gate so READY/RELEASED cannot be spoofed by
-- client-supplied derived fields. This additive patch preserves prior work.

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
  v_ready boolean;
begin
  if new.required_advance < 0 then
    raise exception 'Required advance cannot be negative';
  end if;

  select q.project_id, q.status, q.grand_total
    into v_quote_project, v_quote_status, v_quote_total
  from public.quotations q
  where q.id = new.quotation_id;

  if v_quote_project is null or v_quote_project <> new.project_id then
    raise exception 'Commercial release gate quotation must belong to the same project';
  end if;

  if new.required_advance > v_quote_total then
    raise exception 'Required advance cannot exceed quotation grand total';
  end if;

  select exists (
    select 1
    from public.project_approvals pa
    where pa.quotation_id = new.quotation_id
      and pa.project_id = new.project_id
      and pa.status = 'APPROVED'
      and (pa.approved_amount is null or pa.approved_amount >= v_quote_total)
  ) into v_approval_satisfied;

  select coalesce(sum(p.amount), 0)
    into v_verified_advance
  from public.payments p
  where p.quotation_id = new.quotation_id
    and p.project_id = new.project_id
    and p.status = 'VERIFIED';

  v_ready := v_quote_status = 'ACCEPTED'
    and (not new.required_approval or v_approval_satisfied)
    and v_verified_advance >= new.required_advance;

  if new.status in ('READY','RELEASED') and not v_ready then
    raise exception 'Commercial release gate is not satisfied by the current quotation, approval, and verified payment state';
  end if;

  if new.status = 'RELEASED' then
    if new.released_by is null or new.released_at is null then
      raise exception 'Released commercial gate requires released_by and released_at';
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

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
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
