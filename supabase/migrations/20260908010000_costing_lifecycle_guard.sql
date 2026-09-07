-- Stage 9: database-level costing lifecycle protection.

create or replace function public.guard_costing_run_lifecycle()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'LOCKED' and (
    new.project_id is distinct from old.project_id or
    new.bom_id is distinct from old.bom_id or
    new.optimization_run_id is distinct from old.optimization_run_id or
    new.costing_code is distinct from old.costing_code or
    new.version is distinct from old.version or
    new.currency is distinct from old.currency or
    new.subtotal is distinct from old.subtotal or
    new.discount is distinct from old.discount or
    new.tax is distinct from old.tax or
    new.margin is distinct from old.margin or
    new.selling_price is distinct from old.selling_price or
    new.input_snapshot is distinct from old.input_snapshot or
    new.output_snapshot is distinct from old.output_snapshot
  ) then
    raise exception 'Locked costing runs are immutable.';
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'DRAFT' and new.status = 'CALCULATED') or
      (old.status = 'CALCULATED' and new.status = 'REVIEW') or
      (old.status = 'REVIEW' and new.status = 'APPROVED') or
      (old.status = 'APPROVED' and new.status in ('LOCKED','SUPERSEDED')) or
      (old.status = 'LOCKED' and new.status = 'SUPERSEDED')
    ) then
      raise exception 'Invalid costing status transition: % -> %.', old.status, new.status;
    end if;
  end if;

  if new.status in ('APPROVED','LOCKED') then
    if new.bom_id is null or new.optimization_run_id is null then
      raise exception 'Approved or locked costing requires BOM and optimization lineage.';
    end if;
    if not exists (
      select 1 from public.boms b
      where b.id = new.bom_id
        and b.project_id = new.project_id
        and b.status in ('APPROVED','RELEASED')
    ) then
      raise exception 'Costing requires an approved or released BOM in the same project.';
    end if;
    if not exists (
      select 1 from public.optimization_runs o
      where o.id = new.optimization_run_id
        and o.project_id = new.project_id
        and o.status = 'APPROVED'
    ) then
      raise exception 'Costing requires an approved optimization run in the same project.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_costing_run_lifecycle_guard on public.costing_runs;
create trigger trg_costing_run_lifecycle_guard
before update on public.costing_runs
for each row execute function public.guard_costing_run_lifecycle();

create or replace function public.guard_costing_item_lock()
returns trigger
language plpgsql
as $$
declare
  parent_status text;
  parent_id uuid;
begin
  parent_id := coalesce(new.costing_run_id, old.costing_run_id);
  select status into parent_status from public.costing_runs where id = parent_id;
  if parent_status = 'LOCKED' then
    raise exception 'Costing items cannot be changed after the costing run is locked.';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_costing_item_lock on public.costing_items;
create trigger trg_costing_item_lock
before insert or update or delete on public.costing_items
for each row execute function public.guard_costing_item_lock();
