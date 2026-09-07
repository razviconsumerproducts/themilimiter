-- MILLIMETRE V1: cutting-list RLS hardening
-- Keep authenticated access, but remove the known disabled-RLS state and
-- ensure child rows cannot be written across projects.

alter table public.cutting_lists enable row level security;
alter table public.cutting_list_items enable row level security;

drop policy if exists millimetre_authenticated_all_cutting_lists on public.cutting_lists;
create policy millimetre_authenticated_all_cutting_lists
  on public.cutting_lists
  for all to authenticated
  using (true)
  with check (true);

drop policy if exists millimetre_authenticated_all_cutting_list_items on public.cutting_list_items;
create policy millimetre_authenticated_all_cutting_list_items
  on public.cutting_list_items
  for all to authenticated
  using (true)
  with check (true);

-- Database lineage remains the authoritative cross-project boundary.
create or replace function public.validate_cutting_list_project_lineage()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.calculation_runs cr
    where cr.id = new.calculation_run_id
      and cr.project_id = new.project_id
  ) then
    raise exception 'Cutting list calculation run must belong to the same project';
  end if;
  return new;
end;
$$;

drop trigger if exists cutting_lists_validate_project_lineage on public.cutting_lists;
create trigger cutting_lists_validate_project_lineage
before insert or update of project_id, calculation_run_id
on public.cutting_lists
for each row execute function public.validate_cutting_list_project_lineage();

create or replace function public.validate_cutting_list_item_project_lineage()
returns trigger
language plpgsql
as $$
declare
  v_project_id uuid;
begin
  select project_id into v_project_id
  from public.cutting_lists
  where id = new.cutting_list_id;

  if v_project_id is null then
    raise exception 'Cutting list not found';
  end if;

  if new.project_id <> v_project_id then
    raise exception 'Cutting list item must belong to the cutting list project';
  end if;

  return new;
end;
$$;

drop trigger if exists cutting_list_items_validate_project_lineage on public.cutting_list_items;
create trigger cutting_list_items_validate_project_lineage
before insert or update of project_id, cutting_list_id
on public.cutting_list_items
for each row execute function public.validate_cutting_list_item_project_lineage();
