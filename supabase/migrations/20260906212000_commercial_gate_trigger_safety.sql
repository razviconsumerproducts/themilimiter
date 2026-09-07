-- Safety patch for the commercial gate refresh function.
-- Keeps the canonical database-derived gate model while avoiding ambiguous
-- PL/pgSQL name resolution and record-return handling in DELETE triggers.

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

  select coalesce(sum(pay.amount), 0)
    into v_verified_advance
  from public.payments pay
  where pay.quotation_id = p_quotation_id
    and pay.project_id = v_gate.project_id
    and pay.status = 'VERIFIED';

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
