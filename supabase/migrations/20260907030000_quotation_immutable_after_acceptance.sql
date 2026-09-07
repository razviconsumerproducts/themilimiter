-- Accepted quotations are commercial contracts/snapshots.
-- After acceptance, financial and customer-facing fields cannot be altered.
create or replace function public.prevent_accepted_quotation_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'ACCEPTED' then
    if new.project_id <> old.project_id
      or new.customer_id <> old.customer_id
      or new.costing_run_id <> old.costing_run_id
      or new.quotation_code <> old.quotation_code
      or new.version <> old.version
      or new.currency <> old.currency
      or new.subtotal <> old.subtotal
      or new.discount <> old.discount
      or new.taxable_amount <> old.taxable_amount
      or new.tax_amount <> old.tax_amount
      or coalesce(new.valid_until, date '9999-12-31') <> coalesce(old.valid_until, date '9999-12-31')
      or new.payment_terms is distinct from old.payment_terms
      or new.delivery_terms is distinct from old.delivery_terms
      or new.installation_terms is distinct from old.installation_terms
      or new.warranty_terms is distinct from old.warranty_terms
      or new.notes is distinct from old.notes
      or new.customer_notes is distinct from old.customer_notes
      or new.cost_snapshot is distinct from old.cost_snapshot
      or new.commercial_snapshot is distinct from old.commercial_snapshot
    then
      raise exception 'Accepted quotation is immutable; create a new quotation version instead';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists quotations_prevent_accepted_mutation on public.quotations;
create trigger quotations_prevent_accepted_mutation
before update on public.quotations
for each row execute function public.prevent_accepted_quotation_mutation();

create or replace function public.prevent_accepted_quotation_item_mutation()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select q.status into v_status from public.quotations q where q.id = coalesce(new.quotation_id, old.quotation_id);
  if v_status = 'ACCEPTED' then
    raise exception 'Accepted quotation items are immutable; create a new quotation version instead';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists quotation_items_prevent_accepted_mutation on public.quotation_items;
create trigger quotation_items_prevent_accepted_mutation
before insert or update or delete on public.quotation_items
for each row execute function public.prevent_accepted_quotation_item_mutation();
