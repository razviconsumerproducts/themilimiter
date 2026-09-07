-- MILLIMETRE: Production -> QC -> Label/QR lineage hardening
-- Additive only. Existing production, QC, label and print records are preserved.

-- Production order must stay attached to its project's cutting list.
create or replace function public.validate_production_order_lineage_v1()
returns trigger
language plpgsql
as $$
declare cutting_project uuid;
begin
  if new.cutting_list_id is not null then
    select project_id into cutting_project
    from public.cutting_lists
    where id = new.cutting_list_id;

    if cutting_project is null or cutting_project <> new.project_id then
      raise exception 'Production order cutting list must belong to the same project';
    end if;

    if not exists (
      select 1
      from public.cutting_lists cl
      where cl.id = new.cutting_list_id
        and cl.status in ('APPROVED','RELEASED')
    ) then
      raise exception 'Production order requires an approved or released cutting list';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists production_orders_validate_lineage_v1 on public.production_orders;
create trigger production_orders_validate_lineage_v1
before insert or update of project_id, cutting_list_id
on public.production_orders
for each row execute function public.validate_production_order_lineage_v1();

-- Production pieces must belong to both the production order and its source cutting list.
create or replace function public.validate_production_piece_lineage_v1()
returns trigger
language plpgsql
as $$
declare
  order_project uuid;
  order_cutting_list uuid;
  item_project uuid;
  item_cutting_list uuid;
begin
  select project_id, cutting_list_id
    into order_project, order_cutting_list
  from public.production_orders
  where id = new.production_order_id;

  if order_project is null or order_project <> (
    select project_id from public.production_orders where id = new.production_order_id
  ) then
    raise exception 'Production piece must belong to a valid production order';
  end if;

  if new.cutting_list_item_id is not null then
    select project_id, cutting_list_id
      into item_project, item_cutting_list
    from public.cutting_list_items cli
    join public.cutting_lists cl on cl.id = cli.cutting_list_id
    where cli.id = new.cutting_list_item_id;

    if item_project is null or item_project <> order_project then
      raise exception 'Production piece cutting list item project mismatch';
    end if;

    if order_cutting_list is null or item_cutting_list <> order_cutting_list then
      raise exception 'Production piece cutting list item must belong to the production order cutting list';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists production_pieces_validate_lineage_v1 on public.production_pieces;
create trigger production_pieces_validate_lineage_v1
before insert or update of production_order_id, cutting_list_item_id
on public.production_pieces
for each row execute function public.validate_production_piece_lineage_v1();

-- Work orders and material issues cannot cross production-order boundaries.
create or replace function public.validate_work_order_lineage_v1()
returns trigger
language plpgsql
as $$
begin
  if new.production_piece_id is not null and not exists (
    select 1 from public.production_pieces pp
    where pp.id = new.production_piece_id
      and pp.production_order_id = new.production_order_id
  ) then
    raise exception 'Work order piece must belong to the same production order';
  end if;
  return new;
end;
$$;

drop trigger if exists work_orders_validate_lineage_v1 on public.work_orders;
create trigger work_orders_validate_lineage_v1
before insert or update of production_order_id, production_piece_id
on public.work_orders
for each row execute function public.validate_work_order_lineage_v1();

create or replace function public.validate_material_issue_lineage_v1()
returns trigger
language plpgsql
as $$
begin
  if new.work_order_id is not null and not exists (
    select 1 from public.work_orders wo
    where wo.id = new.work_order_id
      and wo.production_order_id = new.production_order_id
  ) then
    raise exception 'Production material issue work order must belong to the same production order';
  end if;

  if new.inventory_transaction_id is not null and not exists (
    select 1 from public.inventory_transactions it
    where it.id = new.inventory_transaction_id
      and it.project_id = (select project_id from public.production_orders where id = new.production_order_id)
  ) then
    raise exception 'Production material issue inventory transaction project mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists production_material_issues_validate_lineage_v1 on public.production_material_issues;
create trigger production_material_issues_validate_lineage_v1
before insert or update of production_order_id, work_order_id, inventory_transaction_id
on public.production_material_issues
for each row execute function public.validate_material_issue_lineage_v1();

-- QC inspection must reference the same order/piece/work order chain.
create or replace function public.validate_production_qc_lineage_v1()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.production_pieces pp
    where pp.id = new.production_piece_id
      and pp.production_order_id = new.production_order_id
  ) then
    raise exception 'Production QC piece must belong to the same production order';
  end if;

  if new.work_order_id is not null and not exists (
    select 1 from public.work_orders wo
    where wo.id = new.work_order_id
      and wo.production_order_id = new.production_order_id
      and (wo.production_piece_id is null or wo.production_piece_id = new.production_piece_id)
  ) then
    raise exception 'Production QC work order must match the production order and piece';
  end if;

  return new;
end;
$$;

drop trigger if exists production_qc_inspections_validate_lineage_v1 on public.production_qc_inspections;
create trigger production_qc_inspections_validate_lineage_v1
before insert or update of project_id, production_order_id, production_piece_id, work_order_id
on public.production_qc_inspections
for each row execute function public.validate_production_qc_lineage_v1();

-- Release gate must remain attached to its production order/project.
create or replace function public.validate_production_release_gate_lineage_v1()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.production_orders po
    where po.id = new.production_order_id
      and po.project_id = new.project_id
  ) then
    raise exception 'Production release gate must belong to the same project as its production order';
  end if;
  return new;
end;
$$;

drop trigger if exists production_release_gates_validate_lineage_v1 on public.production_release_gates;
create trigger production_release_gates_validate_lineage_v1
before insert or update of project_id, production_order_id
on public.production_release_gates
for each row execute function public.validate_production_release_gate_lineage_v1();

-- Defects must remain attached to the inspection's complete production chain.
create or replace function public.validate_production_qc_defect_lineage_v1()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.production_qc_inspections q
    where q.id = new.production_qc_inspection_id
      and q.project_id = new.project_id
      and q.production_piece_id = new.production_piece_id
  ) then
    raise exception 'Production QC defect must match its inspection project and piece';
  end if;
  return new;
end;
$$;

drop trigger if exists production_qc_defects_validate_lineage_v1 on public.production_qc_defects;
create trigger production_qc_defects_validate_lineage_v1
before insert or update of project_id, production_qc_inspection_id, production_piece_id
on public.production_qc_defects
for each row execute function public.validate_production_qc_defect_lineage_v1();

-- Labels must reference the same production order/piece/project chain.
create or replace function public.validate_production_label_lineage_v1()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.production_orders po
    where po.id = new.production_order_id
      and po.project_id = new.project_id
  ) then
    raise exception 'Production label must match its production order project';
  end if;

  if new.production_piece_id is not null and not exists (
    select 1 from public.production_pieces pp
    where pp.id = new.production_piece_id
      and pp.production_order_id = new.production_order_id
  ) then
    raise exception 'Production label piece must belong to the same production order';
  end if;

  return new;
end;
$$;

drop trigger if exists production_labels_validate_lineage_v1 on public.production_labels;
create trigger production_labels_validate_lineage_v1
before insert or update of project_id, production_order_id, production_piece_id
on public.production_labels
for each row execute function public.validate_production_label_lineage_v1();

-- Print jobs must reference labels in the same project.
create or replace function public.validate_label_print_job_lineage_v1()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.production_labels pl
    where pl.id = new.label_id
      and pl.project_id = new.project_id
  ) then
    raise exception 'Label print job must match the label project';
  end if;
  return new;
end;
$$;

drop trigger if exists label_print_jobs_validate_lineage_v1 on public.label_print_jobs;
create trigger label_print_jobs_validate_lineage_v1
before insert or update of project_id, label_id
on public.label_print_jobs
for each row execute function public.validate_label_print_job_lineage_v1();

-- Explicit RLS for the complete Production/QC/Label chain.
alter table public.production_orders enable row level security;
alter table public.production_pieces enable row level security;
alter table public.work_orders enable row level security;
alter table public.production_material_issues enable row level security;
alter table public.production_qc_inspections enable row level security;
alter table public.production_qc_defects enable row level security;
alter table public.production_release_gates enable row level security;
alter table public.production_labels enable row level security;
alter table public.label_print_jobs enable row level security;

-- Keep the current authenticated-access model; lineage triggers provide the cross-entity integrity boundary.
drop policy if exists production_orders_authenticated_v1 on public.production_orders;
create policy production_orders_authenticated_v1 on public.production_orders for all to authenticated using (true) with check (true);
drop policy if exists production_pieces_authenticated_v1 on public.production_pieces;
create policy production_pieces_authenticated_v1 on public.production_pieces for all to authenticated using (true) with check (true);
drop policy if exists work_orders_authenticated_v1 on public.work_orders;
create policy work_orders_authenticated_v1 on public.work_orders for all to authenticated using (true) with check (true);
drop policy if exists production_material_issues_authenticated_v1 on public.production_material_issues;
create policy production_material_issues_authenticated_v1 on public.production_material_issues for all to authenticated using (true) with check (true);
drop policy if exists production_qc_inspections_authenticated_v1 on public.production_qc_inspections;
create policy production_qc_inspections_authenticated_v1 on public.production_qc_inspections for all to authenticated using (true) with check (true);
drop policy if exists production_qc_defects_authenticated_v1 on public.production_qc_defects;
create policy production_qc_defects_authenticated_v1 on public.production_qc_defects for all to authenticated using (true) with check (true);
drop policy if exists production_release_gates_authenticated_v1 on public.production_release_gates;
create policy production_release_gates_authenticated_v1 on public.production_release_gates for all to authenticated using (true) with check (true);
drop policy if exists production_labels_authenticated_v1 on public.production_labels;
create policy production_labels_authenticated_v1 on public.production_labels for all to authenticated using (true) with check (true);
drop policy if exists label_print_jobs_authenticated_v1 on public.label_print_jobs;
create policy label_print_jobs_authenticated_v1 on public.label_print_jobs for all to authenticated using (true) with check (true);
