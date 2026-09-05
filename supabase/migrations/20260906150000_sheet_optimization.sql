create table if not exists public.optimization_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  cutting_list_id uuid not null references public.cutting_lists(id) on delete restrict,
  optimization_code text not null unique,
  version integer not null default 1,
  status text not null default 'DRAFT' check (status in ('DRAFT','RUNNING','COMPLETED','FAILED','APPROVED','SUPERSEDED')),
  algorithm text not null default 'FIRST_FIT',
  kerf_mm numeric not null default 3 check (kerf_mm >= 0),
  trim_allowance_mm numeric not null default 10 check (trim_allowance_mm >= 0),
  optimization_score numeric,
  sheet_count integer not null default 0 check (sheet_count >= 0),
  total_required_area numeric not null default 0,
  total_sheet_area numeric not null default 0,
  waste_area numeric not null default 0,
  utilization_percentage numeric not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  approved_by uuid,
  approved_at timestamptz
);

create table if not exists public.optimization_sheets (
  id uuid primary key default gen_random_uuid(),
  optimization_run_id uuid not null references public.optimization_runs(id) on delete cascade,
  sheet_number integer not null,
  material_id uuid not null references public.materials(id) on delete restrict,
  length_mm numeric not null check (length_mm > 0),
  width_mm numeric not null check (width_mm > 0),
  thickness_mm numeric not null check (thickness_mm > 0),
  grain_direction text not null default 'NONE' check (grain_direction in ('NONE','LENGTH','WIDTH')),
  used_area numeric not null default 0,
  waste_area numeric not null default 0,
  utilization_percentage numeric not null default 0,
  unique(optimization_run_id, sheet_number)
);

create table if not exists public.optimization_placements (
  id uuid primary key default gen_random_uuid(),
  optimization_sheet_id uuid not null references public.optimization_sheets(id) on delete cascade,
  cutting_list_item_id uuid not null references public.cutting_list_items(id) on delete restrict,
  piece_instance_id text not null,
  x_mm numeric not null check (x_mm >= 0),
  y_mm numeric not null check (y_mm >= 0),
  length_mm numeric not null check (length_mm > 0),
  width_mm numeric not null check (width_mm > 0),
  rotation boolean not null default false,
  grain_orientation text not null default 'NONE' check (grain_orientation in ('NONE','LENGTH','WIDTH')),
  unique(optimization_sheet_id, piece_instance_id)
);

create table if not exists public.offcuts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  optimization_run_id uuid not null references public.optimization_runs(id) on delete restrict,
  source_sheet_id uuid not null references public.optimization_sheets(id) on delete restrict,
  material_id uuid not null references public.materials(id) on delete restrict,
  length_mm numeric not null check (length_mm > 0),
  width_mm numeric not null check (width_mm > 0),
  thickness_mm numeric not null check (thickness_mm > 0),
  grain_direction text not null default 'NONE' check (grain_direction in ('NONE','LENGTH','WIDTH')),
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE','RESERVED','USED','SCRAPPED')),
  created_at timestamptz not null default now()
);

create index if not exists optimization_runs_project_idx on public.optimization_runs(project_id);
create index if not exists optimization_runs_cutting_list_idx on public.optimization_runs(cutting_list_id);
create index if not exists optimization_sheets_run_idx on public.optimization_sheets(optimization_run_id);
create index if not exists optimization_placements_sheet_idx on public.optimization_placements(optimization_sheet_id);
create index if not exists optimization_placements_cutting_item_idx on public.optimization_placements(cutting_list_item_id);
create index if not exists offcuts_project_idx on public.offcuts(project_id);

alter table public.optimization_runs enable row level security;
alter table public.optimization_sheets enable row level security;
alter table public.optimization_placements enable row level security;
alter table public.offcuts enable row level security;

create policy "authenticated can access optimization runs" on public.optimization_runs for all to authenticated using (true) with check (true);
create policy "authenticated can access optimization sheets" on public.optimization_sheets for all to authenticated using (true) with check (true);
create policy "authenticated can access optimization placements" on public.optimization_placements for all to authenticated using (true) with check (true);
create policy "authenticated can access offcuts" on public.offcuts for all to authenticated using (true) with check (true);
