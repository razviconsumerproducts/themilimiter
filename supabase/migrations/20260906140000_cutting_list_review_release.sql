create table if not exists public.cutting_lists (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  calculation_run_id uuid not null references public.calculation_runs(id) on delete restrict,
  cutting_list_code text not null unique,
  version integer not null default 1,
  status text not null default 'GENERATED' check (status in ('DRAFT','GENERATED','REVIEW','APPROVED','RELEASED','SUPERSEDED','CANCELLED')),
  approved_by uuid,
  approved_at timestamptz,
  released_by uuid,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calculation_runs add column if not exists calculation_version text;
alter table public.calculation_runs add column if not exists output_snapshot jsonb;
alter table public.calculation_runs add column if not exists warnings jsonb not null default '[]'::jsonb;
alter table public.calculation_runs add column if not exists errors jsonb not null default '[]'::jsonb;
alter table public.calculation_runs add column if not exists calculated_at timestamptz;
alter table public.calculation_runs add column if not exists calculated_by uuid;

alter table public.cutting_list_items add column if not exists piece_code text;
alter table public.cutting_list_items add column if not exists grain_direction text not null default 'NONE';
alter table public.cutting_list_items add column if not exists edge_top text not null default 'NONE';
alter table public.cutting_list_items add column if not exists edge_bottom text not null default 'NONE';
alter table public.cutting_list_items add column if not exists edge_left text not null default 'NONE';
alter table public.cutting_list_items add column if not exists edge_right text not null default 'NONE';
alter table public.cutting_list_items add column if not exists cutting_allowance numeric not null default 0;

update public.calculation_runs set calculation_version = engine_version where calculation_version is null;
update public.calculation_runs set output_snapshot = result where output_snapshot is null;
update public.calculation_runs set calculated_at = created_at where calculated_at is null;
update public.cutting_list_items set piece_code = 'P-' || sequence_no where piece_code is null;

create index if not exists idx_cutting_lists_project on public.cutting_lists(project_id);
create index if not exists idx_cutting_lists_calculation on public.cutting_lists(calculation_run_id);
create index if not exists idx_cutting_items_run on public.cutting_list_items(calculation_run_id);

alter table public.cutting_lists enable row level security;
drop policy if exists millimetre_authenticated_all_cutting_lists on public.cutting_lists;
create policy millimetre_authenticated_all_cutting_lists on public.cutting_lists for all to authenticated using (true) with check (true);
