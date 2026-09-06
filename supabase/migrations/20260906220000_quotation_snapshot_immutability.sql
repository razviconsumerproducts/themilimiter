-- MILLIMETRE V1: accepted quotations are immutable commercial snapshots.
-- Revisions must be created as a new quotation version.

create or replace function public.prevent_accepted_quotation_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'ACCEPTED' then
    if new.project_id <> old.project_id
      or new.customer_id <> old.customer_id
      or new.costing_run_id <> old.costing_run_id
      or new.version <> old.version
      or new.currency <> old.currency
      or new.subtotal <> old.subtotal
      or new.discount <> old.discount
      or new.taxable_amount <> old.taxable_amount
      or new.tax_amount <> old.tax_amount
      or new.payment_terms is distinct from old.payment_terms
      or new.delivery_terms is distinct from old.delivery_terms
      or new.installation_terms is distinct from old.installation_terms
      or new.warranty_terms is distinct from old.warranty_terms
      or new.notes is distinct from old.notes
      or new.customer_notes is distinct from old.customer_notes
      or new.cost_snapshot is distinct from old.cost_snapshot
      or new.commercial_snapshot is distinct from old.commercial_snapshot
      or new.accepted_at is distinct from old.accepted_at then
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
  v_quotation_id uuid;
begin
  v_quotation_id := coalesce(new.quotation_id, old.quotation_id);
  select status into v_status from public.quotations where id = v_quotation_id;
  if v_status = 'ACCEPTED' then
    raise exception 'Quotation items are immutable after quotation acceptance; create a new quotation version instead';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists quotation_items_prevent_accepted_mutation on public.quotation_items;
create trigger quotation_items_prevent_accepted_mutation
before insert or update or delete on public.quotation_items
for each row execute function public.prevent_accepted_quotation_item_mutation();

-- A new version must still use a costing snapshot that is approved/locked;
-- the existing commercial-lineage trigger enforces project/customer linkage.
create index if not exists quotations_project_code_version_idx
on public.quotations(project_id, quotation_code, version);
