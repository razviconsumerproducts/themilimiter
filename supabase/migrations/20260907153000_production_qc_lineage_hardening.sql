-- MILLIMETRE: Production -> Production QC lineage hardening
-- Additive migration. Existing production work is preserved.

create or replace function public.validate_production_lineage_v1()
returns trigger
language plpgsql
as $$
declare
  order_project uuid;
  order_cutting_list uuid;
  piece_project uuid;
  piece_order uuid;
  piece_cutting_item uuid;
  cutting_project uuid;
begin
  if tg_table_name = 'production_orders' then
    select project_id, cutting_list_id into order_project, order_cutting_list
    from public.production_orders where id = new.id;
    -- self lookup is intentionally skipped; lineage is checked from referenced cutting list.
    if new.cutting_list_id is not null then
      select project_id into cutting_project from public.cutting_lists where id = new.cutting_list_id;
      if cutting_project is null or cutting_project <> new.project_id then
        raise exception 'Production order cutting list must belong to the same project';
      end if;
    end if;
  elsif tg_table_name = 'production_pieces' then
    select project_id into order_project from public.production_orders where id = new.production_order_id;
    if order_project is null or order_project <> (select project_id from public.production_orders where id = new.production_order_id) then
      raise exception 'Production piece production order is invalid';
    end if;
    if new.cutting_list_item_id is not null then
      select cl.project_id into cutting_project
      from public.cutting_list_items cli
      join public.cutting_lists cl on cl.id = cli.cutting_list_id
      where cli.id = new.cutting_list_item_id;
      if cutting_project is null or cutting_project <> order_project then
        raise exception 'Production piece cutting list item must belong to the same project';
      end if;
      if not exists (
        select 1 from public.production_orders po
        where po.id = new.production_order_id
          and po.cutting_list_id = (select cli.cutting_list_id from public.cutting_list_items cli where cli.id = new.cutting_list_item_id)
      ) then
        raise exception 'Production piece cutting list item must belong to the production order cutting list';
      end if;
    end if;
  elsif tg_table_name = 'work_orders' then
    select project_id into order_project from public.production_orders where id = new.production_order_id;
    if order_project is null then
      raise exception 'Work order production order is invalid';
    end if;
    if new.production_piece_id is not null and not exists (
      select 1 from public.production_pieces pp
      where pp.id = new.production_piece_id and pp.production_order_id = new.production_order_id
    ) then
      raise exception 'Work order production piece must belong to the same production order';
    end if;
  elsif tg_table_name = 'production_material_issues' then
    select project_id into order_project from public.production_orders where id = new.production_order_id;
    if order_project is null then
      raise exception 'Material issue production order is invalid';
    end if;
    if new.work_order_id is not null and not exists (
      select 1 from public.work_orders wo
      where wo.id = new.work_order_id and wo.production_order_id = new.production_order_id
    ) then
      raise exception 'Material issue work order must belong to the same production order';
    end if;
  end if;
  return new;
end;
$$;

-- Production order -> cutting list project.
drop trigger if exists production_orders_validate_lineage_v1 on public.production_orders;
create trigger production_orders_validate_lineage_v1
before insert or update of project_id, cutting_list_id on public.production_orders
for each row execute function public.validate_production_lineage_v1();

-- Production piece -> production order -> cutting list item.
drop trigger if exists production_pieces_validate_lineage_v1 on public.production_pieces;
create trigger production_pieces_validate_lineage_v1
before insert or update of production_order_id, cutting_list_item_id on public.production_pieces
for each row execute function public.validate_production_lineage_v1();

-- Work order -> production order/piece.
drop trigger if exists work_orders_validate_lineage_v1 on public.work_orders;
create trigger work_orders_validate_lineage_v1
before insert or update of production_order_id, production_piece_id on public.work_orders
for each row execute function public.validate_production_lineage_v1();

-- Material issue -> production order/work order.
drop trigger if exists production_material_issues_validate_lineage_v1 on public.production_material_issues;
create trigger production_material_issues_validate_lineage_v1
before insert or update of production_order_id, work_order_id on public.production_material_issues
for each row execute function public.validate_production_lineage_v1();

-- Production QC is bound to order + piece + optional work order.
create or replace function public.validate_production_qc_lineage_v1()
returns trigger
language plpgsql
as $$
declare
  order_project uuid;
  piece_project uuid;
  piece_order uuid;
begin
  select project_id into order_project
  from public.production_orders where id = new.production_order_id;
  select po.project_id, pp.production_order_id into piece_project, piece_order
  from public.production_pieces pp
  join public.production_orders po on po.id = pp.production_order_id
  where pp.id = new.production_piece_id;

  if order_project is null or piece_project is null
     or order_project <> new.project_id
     or piece_project <> new.project_id
     or piece_order <> new.production_order_id then
    raise exception 'Production QC must match project, production order and production piece lineage';
  end if;

  if new.work_order_id is not null and not exists (
    select 1 from public.work_orders wo
    where wo.id = new.work_order_id
      and wo.production_order_id = new.production_order_id
      and (wo.production_piece_id is null or wo.production_piece_id = new.production_piece_id)
  ) then
    raise exception 'Production QC work order does not belong to the inspected production order/piece';
  end if;

  return new;
end;
$$;

drop trigger if exists production_qc_inspections_validate_lineage_v1 on public.production_qc_inspections;
create trigger production_qc_inspections_validate_lineage_v1
before insert or update of project_id, production_order_id, production_piece_id, work_order_id
on public.production_qc_inspections
for each row execute function public.validate_production_qc_lineage_v1();

-- Defects must remain attached to their exact QC inspection and piece.
create or replace function public.validate_production_qc_defect_lineage_v1()
returns trigger
language plpgsql
as $$
declare
  inspection_project uuid;
  inspection_piece uuid;
begin
  select project_id, production_piece_id
    into inspection_project, inspection_piece
  from public.production_qc_inspections
  where id = new.production_qc_inspection_id;

  if inspection_project is null
     or inspection_project <> new.project_id
     or inspection_piece <> new.production_piece_id then
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

-- Release gate must belong to the production order's project.
create or replace function public.validate_production_release_gate_lineage_v1()
returns trigger
language plpgsql
as $$
declare order_project uuid;
begin
  select project_id into order_project
  from public.production_orders where id = new.production_order_id;
  if order_project is null or order_project <> new.project_id then
    raise exception 'Production release gate must match production order project';
  end if;
  return new;
end;
$$;

drop trigger if exists production_release_gates_validate_lineage_v1 on public.production_release_gates;
create trigger production_release_gates_validate_lineage_v1
before insert or update of project_id, production_order_id
on public.production_release_gates
for each row execute function public.validate_production_release_gate_lineage_v1();

-- Defense in depth for the exposed production/QC tables.
alter table public.production_orders enable row level security;
alter table public.production_pieces enable row level security;
alter table public.work_orders enable row level security;
alter table public.production_material_issues enable row level security;
alter table public.production_qc_inspections enable row level security;
alter table public.production_qc_defects enable row level security;
alter table public.production_release_gates enable row level security;
