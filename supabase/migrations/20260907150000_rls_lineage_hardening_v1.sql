-- MILLIMETRE V1: canonical RLS + lineage hardening
-- Baseline policy remains authenticated-only until project membership/tenant
-- ownership is introduced. Database lineage prevents cross-project writes.

-- BOM lineage
create or replace function public.validate_bom_project_lineage()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.calculation_runs cr
    where cr.id = new.calculation_run_id
      and cr.project_id = new.project_id
  ) then
    raise exception 'BOM calculation run must belong to the same project';
  end if;
  return new;
end;
$$;

drop trigger if exists boms_validate_project_lineage on public.boms;
create trigger boms_validate_project_lineage
before insert or update of project_id, calculation_run_id
on public.boms for each row
execute function public.validate_bom_project_lineage();

create or replace function public.validate_bom_item_project_lineage()
returns trigger
language plpgsql
as $$
declare
  v_bom_project uuid;
  v_furniture_project uuid;
begin
  select project_id into v_bom_project from public.boms where id = new.bom_id;
  if v_bom_project is null then raise exception 'BOM not found'; end if;
  if new.project_id <> v_bom_project then
    raise exception 'BOM item must belong to the BOM project';
  end if;
  if new.furniture_item_id is not null then
    select project_id into v_furniture_project from public.furniture_items where id = new.furniture_item_id;
    if v_furniture_project is null or v_furniture_project <> v_bom_project then
      raise exception 'BOM item furniture must belong to the BOM project';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists bom_items_validate_project_lineage on public.bom_items;
create trigger bom_items_validate_project_lineage
before insert or update of project_id, bom_id, furniture_item_id
on public.bom_items for each row
execute function public.validate_bom_item_project_lineage();

-- Keep RLS explicitly enabled on the canonical BOM tables.
alter table public.boms enable row level security;
alter table public.bom_items enable row level security;

drop policy if exists millimetre_authenticated_all_boms on public.boms;
create policy millimetre_authenticated_all_boms on public.boms
for all to authenticated using (true) with check (true);

drop policy if exists millimetre_authenticated_all_bom_items on public.bom_items;
create policy millimetre_authenticated_all_bom_items on public.bom_items
for all to authenticated using (true) with check (true);

-- Approval/payment tables: authenticated-only baseline plus explicit RLS.
alter table public.project_approvals enable row level security;
alter table public.payment_schedules enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.commercial_release_gates enable row level security;

-- Payment allocation cannot cross projects/quotations.
create or replace function public.validate_payment_allocation_project_lineage()
returns trigger
language plpgsql
as $$
declare
  v_payment_project uuid;
  v_schedule_project uuid;
begin
  select project_id into v_payment_project from public.payments where id = new.payment_id;
  select project_id into v_schedule_project from public.payment_schedules where id = new.payment_schedule_id;
  if v_payment_project is null or v_schedule_project is null or v_payment_project <> v_schedule_project then
    raise exception 'Payment allocation must remain within one project';
  end if;
  return new;
end;
$$;

drop trigger if exists payment_allocations_validate_project_lineage on public.payment_allocations;
create trigger payment_allocations_validate_project_lineage
before insert or update of payment_id, payment_schedule_id
on public.payment_allocations for each row
execute function public.validate_payment_allocation_project_lineage();
