-- MILLIMETRE V1 upstream integrity gates
-- Prevent downstream manufacturing/commercial records from being built from
-- mismatched projects, invalid calculation runs, or unreleased upstream versions.

create or replace function public.validate_cutting_list_calculation_lineage()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from public.calculation_runs cr
    where cr.id = new.calculation_run_id
      and cr.project_id = new.project_id
      and cr.status = 'valid'
  ) then
    raise exception 'Cutting list requires a valid calculation run belonging to the same project';
  end if;
  return new;
end;
$$;

drop trigger if exists cutting_lists_validate_calculation on public.cutting_lists;
create trigger cutting_lists_validate_calculation
before insert or update of project_id, calculation_run_id on public.cutting_lists
for each row execute function public.validate_cutting_list_calculation_lineage();

create or replace function public.validate_cutting_list_item_lineage()
returns trigger language plpgsql as $$
declare
  v_run_project uuid;
  v_furniture_project uuid;
  v_component_furniture uuid;
begin
  select cr.project_id into v_run_project from public.calculation_runs cr where cr.id = new.calculation_run_id;
  if v_run_project is null or v_run_project <> new.project_id then
    raise exception 'Cutting list item project must match its calculation run project';
  end if;
  if new.furniture_item_id is not null then
    select fi.project_id into v_furniture_project from public.furniture_items fi where fi.id = new.furniture_item_id;
    if v_furniture_project is null or v_furniture_project <> new.project_id then
      raise exception 'Cutting list item furniture must belong to the same project';
    end if;
  end if;
  if new.component_id is not null then
    select fc.furniture_item_id into v_component_furniture from public.furniture_components fc where fc.id = new.component_id;
    if v_component_furniture is null then raise exception 'Cutting list item component does not exist'; end if;
    if new.furniture_item_id is not null and v_component_furniture <> new.furniture_item_id then
      raise exception 'Cutting list item component must belong to its furniture item';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists cutting_list_items_validate_lineage on public.cutting_list_items;
create trigger cutting_list_items_validate_lineage
before insert or update of project_id, calculation_run_id, furniture_item_id, component_id on public.cutting_list_items
for each row execute function public.validate_cutting_list_item_lineage();

create or replace function public.validate_bom_calculation_lineage()
returns trigger language plpgsql as $$
declare
  v_calc_project uuid;
  v_calc_status text;
begin
  select cr.project_id, cr.status into v_calc_project, v_calc_status
  from public.calculation_runs cr where cr.id = new.calculation_run_id;
  if v_calc_project is null or v_calc_project <> new.project_id then
    raise exception 'BOM calculation run must belong to the same project';
  end if;
  if v_calc_status <> 'valid' then raise exception 'BOM requires a valid calculation run'; end if;
  return new;
end;
$$;

drop trigger if exists boms_validate_calculation_lineage on public.boms;
create trigger boms_validate_calculation_lineage
before insert or update of project_id, calculation_run_id on public.boms
for each row execute function public.validate_bom_calculation_lineage();

create or replace function public.validate_bom_item_lineage()
returns trigger language plpgsql as $$
declare
  v_bom_project uuid;
  v_furniture_project uuid;
  v_component_furniture uuid;
begin
  select b.project_id into v_bom_project from public.boms b where b.id = new.bom_id;
  if v_bom_project is null or v_bom_project <> new.project_id then
    raise exception 'BOM item project must match its BOM project';
  end if;
  if new.furniture_item_id is not null then
    select fi.project_id into v_furniture_project from public.furniture_items fi where fi.id = new.furniture_item_id;
    if v_furniture_project is null or v_furniture_project <> new.project_id then
      raise exception 'BOM item furniture must belong to the same project';
    end if;
  end if;
  if new.source_component_id is not null then
    select fc.furniture_item_id into v_component_furniture from public.furniture_components fc where fc.id = new.source_component_id;
    if v_component_furniture is null then raise exception 'BOM source component does not exist'; end if;
    if new.furniture_item_id is not null and v_component_furniture <> new.furniture_item_id then
      raise exception 'BOM source component must belong to its furniture item';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists bom_items_validate_lineage on public.bom_items;
create trigger bom_items_validate_lineage
before insert or update of bom_id, project_id, furniture_item_id, source_component_id on public.bom_items
for each row execute function public.validate_bom_item_lineage();

create or replace function public.validate_optimization_cutting_list_lineage()
returns trigger language plpgsql as $$
declare
  v_cut_project uuid;
  v_cut_status text;
  v_calc_project uuid;
begin
  select cl.project_id, cl.status, cr.project_id into v_cut_project, v_cut_status, v_calc_project
  from public.cutting_lists cl
  join public.calculation_runs cr on cr.id = cl.calculation_run_id
  where cl.id = new.cutting_list_id;
  if v_cut_project is null or v_cut_project <> new.project_id or v_calc_project <> new.project_id then
    raise exception 'Optimization run cutting list must belong to the same project';
  end if;
  if v_cut_status not in ('APPROVED','RELEASED') then
    raise exception 'Optimization run requires an approved or released cutting list';
  end if;
  return new;
end;
$$;

drop trigger if exists optimization_runs_validate_cutting_list on public.optimization_runs;
create trigger optimization_runs_validate_cutting_list
before insert or update of project_id, cutting_list_id on public.optimization_runs
for each row execute function public.validate_optimization_cutting_list_lineage();

create or replace function public.validate_optimization_sheet_lineage()
returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.optimization_runs orr where orr.id = new.optimization_run_id) then
    raise exception 'Optimization sheet requires an existing optimization run';
  end if;
  if not exists (select 1 from public.materials m where m.id = new.material_id) then
    raise exception 'Optimization sheet requires an existing material';
  end if;
  return new;
end;
$$;

drop trigger if exists optimization_sheets_validate_lineage on public.optimization_sheets;
create trigger optimization_sheets_validate_lineage
before insert or update of optimization_run_id, material_id on public.optimization_sheets
for each row execute function public.validate_optimization_sheet_lineage();

create or replace function public.validate_optimization_placement_lineage()
returns trigger language plpgsql as $$
declare
  v_run_id uuid;
  v_run_project uuid;
  v_cutting_list_id uuid;
  v_cut_project uuid;
begin
  select os.optimization_run_id into v_run_id from public.optimization_sheets os where os.id = new.optimization_sheet_id;
  if v_run_id is null then raise exception 'Optimization placement requires an existing optimization sheet'; end if;

  select orr.project_id, orr.cutting_list_id into v_run_project, v_cutting_list_id
  from public.optimization_runs orr where orr.id = v_run_id;
  select cl.project_id into v_cut_project from public.cutting_lists cl where cl.id = v_cutting_list_id;

  if v_run_project is null or v_cut_project is null or v_run_project <> v_cut_project then
    raise exception 'Optimization placement has inconsistent project lineage';
  end if;

  if not exists (
    select 1
    from public.cutting_list_items cli
    join public.cutting_lists cl on cl.id = v_cutting_list_id
    where cli.id = new.cutting_list_item_id
      and cli.calculation_run_id = cl.calculation_run_id
      and cli.project_id = v_run_project
  ) then
    raise exception 'Optimization placement item must belong to the optimization run cutting list';
  end if;

  return new;
end;
$$;

drop trigger if exists optimization_placements_validate_lineage on public.optimization_placements;
create trigger optimization_placements_validate_lineage
before insert or update of optimization_sheet_id, cutting_list_item_id on public.optimization_placements
for each row execute function public.validate_optimization_placement_lineage();

create or replace function public.validate_costing_upstream_lineage()
returns trigger language plpgsql as $$
declare
  v_bom_project uuid;
  v_bom_status text;
  v_bom_calc uuid;
  v_opt_project uuid;
  v_opt_status text;
  v_opt_cut uuid;
  v_bom_cut uuid;
begin
  if new.bom_id is null then raise exception 'Costing run requires a BOM'; end if;
  select b.project_id, b.status, b.calculation_run_id into v_bom_project, v_bom_status, v_bom_calc
  from public.boms b where b.id = new.bom_id;
  if v_bom_project is null or v_bom_project <> new.project_id then
    raise exception 'Costing BOM must belong to the same project';
  end if;
  if v_bom_status not in ('APPROVED','RELEASED') then raise exception 'Costing run requires an approved or released BOM'; end if;
  if new.optimization_run_id is null then raise exception 'Costing run requires an optimization run'; end if;

  select orr.project_id, orr.status, orr.cutting_list_id into v_opt_project, v_opt_status, v_opt_cut
  from public.optimization_runs orr where orr.id = new.optimization_run_id;
  if v_opt_project is null or v_opt_project <> new.project_id then
    raise exception 'Costing optimization must belong to the same project';
  end if;
  if v_opt_status <> 'APPROVED' then raise exception 'Costing run requires an approved optimization run'; end if;

  select cl.id into v_bom_cut
  from public.cutting_lists cl
  where cl.project_id = new.project_id
    and cl.calculation_run_id = v_bom_calc
    and cl.status in ('APPROVED','RELEASED')
  order by cl.version desc limit 1;
  if v_bom_cut is null or v_bom_cut <> v_opt_cut then
    raise exception 'Costing BOM and optimization must originate from the same approved cutting-list lineage';
  end if;
  return new;
end;
$$;

drop trigger if exists costing_runs_validate_upstream_lineage on public.costing_runs;
create trigger costing_runs_validate_upstream_lineage
before insert or update of project_id, bom_id, optimization_run_id on public.costing_runs
for each row execute function public.validate_costing_upstream_lineage();

create or replace function public.validate_costing_item_project_lineage()
returns trigger language plpgsql as $$
declare
  v_run_project uuid;
begin
  select cr.project_id into v_run_project from public.costing_runs cr where cr.id = new.costing_run_id;
  if v_run_project is null or v_run_project <> new.project_id then
    raise exception 'Costing item project must match its costing run project';
  end if;
  return new;
end;
$$;

drop trigger if exists costing_items_validate_project_lineage on public.costing_items;
create trigger costing_items_validate_project_lineage
before insert or update of costing_run_id, project_id on public.costing_items
for each row execute function public.validate_costing_item_project_lineage();
