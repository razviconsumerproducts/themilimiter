-- Stage 10: quotation must remain a faithful commercial snapshot of approved costing.

create or replace function public.validate_quotation_costing_snapshot()
returns trigger
language plpgsql
as $$
declare
  v_cost_project uuid;
  v_cost_status text;
  v_cost_currency text;
  v_selling_price numeric;
  v_project_customer uuid;
  v_grand_total numeric;
begin
  select cr.project_id, cr.status, cr.currency, cr.selling_price
    into v_cost_project, v_cost_status, v_cost_currency, v_selling_price
  from public.costing_runs cr
  where cr.id = new.costing_run_id;

  if v_cost_project is null or v_cost_project <> new.project_id then
    raise exception 'Quotation costing run must belong to the same project';
  end if;

  if v_cost_status not in ('APPROVED','LOCKED') then
    raise exception 'Quotation requires an approved or locked costing run';
  end if;

  if new.currency <> v_cost_currency then
    raise exception 'Quotation currency must match costing currency';
  end if;

  select p.customer_id into v_project_customer
  from public.projects p
  where p.id = new.project_id;

  if v_project_customer is null or v_project_customer <> new.customer_id then
    raise exception 'Quotation customer must match project customer';
  end if;

  if new.valid_until is not null and new.valid_until < new.quotation_date then
    raise exception 'Quotation validity date cannot precede quotation date';
  end if;

  v_grand_total := coalesce(new.taxable_amount, 0) + coalesce(new.tax_amount, 0);
  if abs(v_grand_total - coalesce(v_selling_price, 0)) > 0.02 then
    raise exception 'Quotation grand total must match the approved costing selling price';
  end if;

  return new;
end;
$$;

drop trigger if exists quotations_validate_costing_snapshot on public.quotations;
create trigger quotations_validate_costing_snapshot
before insert or update of project_id, customer_id, costing_run_id, quotation_date, valid_until, currency, subtotal, discount, taxable_amount, tax_amount
on public.quotations
for each row execute function public.validate_quotation_costing_snapshot();

create or replace function public.validate_quotation_item_costing_source()
returns trigger
language plpgsql
as $$
declare
  v_quotation_costing uuid;
  v_item_costing uuid;
begin
  select q.costing_run_id into v_quotation_costing
  from public.quotations q
  where q.id = new.quotation_id;

  if v_quotation_costing is null then
    raise exception 'Quotation item requires an existing quotation';
  end if;

  if new.source_type = 'COSTING_ITEM' then
    select ci.costing_run_id into v_item_costing
    from public.costing_items ci
    where ci.id = new.source_id;

    if v_item_costing is null or v_item_costing <> v_quotation_costing then
      raise exception 'Quotation item must reference a costing item from its quotation costing run';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists quotation_items_validate_costing_source on public.quotation_items;
create trigger quotation_items_validate_costing_source
before insert or update of quotation_id, source_type, source_id
on public.quotation_items
for each row execute function public.validate_quotation_item_costing_source();
