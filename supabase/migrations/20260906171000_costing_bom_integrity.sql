do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'costing_runs_bom_id_fkey') then
    alter table public.costing_runs
      add constraint costing_runs_bom_id_fkey
      foreign key (bom_id) references public.boms(id) on delete restrict;
  end if;
end $$;

create index if not exists costing_runs_bom_idx on public.costing_runs(bom_id);

create or replace function public.validate_costing_bom_project()
returns trigger
language plpgsql
as $$
begin
  if new.bom_id is not null and not exists (
    select 1 from public.boms b
    where b.id = new.bom_id and b.project_id = new.project_id
      and b.status in ('APPROVED','RELEASED')
  ) then
    raise exception 'Costing run requires an approved or released BOM belonging to the same project';
  end if;
  return new;
end;
$$;

drop trigger if exists costing_runs_validate_bom on public.costing_runs;
create trigger costing_runs_validate_bom
before insert or update of project_id, bom_id on public.costing_runs
for each row execute function public.validate_costing_bom_project();
