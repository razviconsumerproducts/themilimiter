-- MILLIMETRE V1: core lineage QA hardening
-- Enforce canonical project ownership at the database boundary for the
-- measurement -> furniture -> component -> calculation chain.

create or replace function public.validate_measurement_project_lineage()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.projects p where p.id = new.project_id
  ) then
    raise exception 'Measurement must reference an existing project';
  end if;
  return new;
end;
$$;

drop trigger if exists project_measurements_validate_project on public.project_measurements;
create trigger project_measurements_validate_project
before insert or update of project_id on public.project_measurements
for each row execute function public.validate_measurement_project_lineage();

create or replace function public.validate_furniture_project_lineage()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.projects p where p.id = new.project_id
  ) then
    raise exception 'Furniture item must reference an existing project';
  end if;

  if new.measurement_id is not null and not exists (
    select 1
    from public.project_measurements m
    where m.id = new.measurement_id
      and m.project_id = new.project_id
  ) then
    raise exception 'Furniture measurement must belong to the same project';
  end if;

  return new;
end;
$$;

drop trigger if exists furniture_items_validate_project_lineage on public.furniture_items;
create trigger furniture_items_validate_project_lineage
before insert or update of project_id, measurement_id on public.furniture_items
for each row execute function public.validate_furniture_project_lineage();

create or replace function public.validate_furniture_component_project_lineage()
returns trigger
language plpgsql
as $$
declare
  v_project_id uuid;
begin
  select project_id into v_project_id
  from public.furniture_items
  where id = new.furniture_item_id;

  if v_project_id is null then
    raise exception 'Furniture item not found';
  end if;

  if new.material_id is not null and not exists (
    select 1 from public.materials m where m.id = new.material_id
  ) then
    raise exception 'Component material not found';
  end if;

  return new;
end;
$$;

drop trigger if exists furniture_components_validate_project_lineage on public.furniture_components;
create trigger furniture_components_validate_project_lineage
before insert or update of furniture_item_id, material_id on public.furniture_components
for each row execute function public.validate_furniture_component_project_lineage();

create or replace function public.validate_calculation_run_project_lineage()
returns trigger
language plpgsql
as $$
declare
  v_project_id uuid;
begin
  select project_id into v_project_id
  from public.furniture_items
  where id = new.furniture_item_id;

  if v_project_id is null then
    raise exception 'Calculation furniture item not found';
  end if;

  if new.project_id <> v_project_id then
    raise exception 'Calculation run must belong to the furniture item project';
  end if;

  return new;
end;
$$;

drop trigger if exists calculation_runs_validate_project_lineage on public.calculation_runs;
create trigger calculation_runs_validate_project_lineage
before insert or update of project_id, furniture_item_id on public.calculation_runs
for each row execute function public.validate_calculation_run_project_lineage();

-- Keep the core tables protected when exposed through Supabase Data API.
DO $$
declare
  t text;
begin
  foreach t in array array['project_measurements','furniture_items','furniture_components','calculation_runs'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Baseline authenticated access is retained for the current V1 tenancy model;
-- project lineage triggers prevent cross-project writes until project-membership
-- authorization is introduced as a separate security layer.
