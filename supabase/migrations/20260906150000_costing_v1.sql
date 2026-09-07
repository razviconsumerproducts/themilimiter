create table if not exists public.costing_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  bom_id uuid,
  optimization_run_id uuid,
  costing_code text not null unique,
  version integer not null default 1,
  status text not null default 'DRAFT' check (status in ('DRAFT','CALCULATED','REVIEW','APPROVED','LOCKED','SUPERSEDED','CANCELLED')),
  currency text not null default 'INR',
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  tax numeric(14,2) not null default 0,
  total_cost numeric(14,2) generated always as (subtotal - discount + tax) stored,
  margin numeric(14,2) not null default 0,
  selling_price numeric(14,2) not null default 0,
  input_snapshot jsonb not null default '{}'::jsonb,
  output_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.costing_items (
  id uuid primary key default gen_random_uuid(),
  costing_run_id uuid not null references public.costing_runs(id) on delete cascade,
  project_id uuid not null references public.projects(id),
  category text not null check (category in ('MATERIAL','HARDWARE','EDGE_BAND','LABOUR','SERVICE','TRANSPORT','INSTALLATION','OVERHEAD','OTHER')),
  source_type text,
  source_id uuid,
  item_code text,
  description text not null,
  quantity numeric(14,4) not null check (quantity >= 0),
  unit text not null,
  unit_cost numeric(14,4) not null default 0 check (unit_cost >= 0),
  wastage_quantity numeric(14,4) not null default 0 check (wastage_quantity >= 0),
  wastage_cost numeric(14,2) generated always as (wastage_quantity * unit_cost) stored,
  total_cost numeric(14,2) generated always as ((quantity + wastage_quantity) * unit_cost) stored,
  calculation_basis text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists costing_runs_project_idx on public.costing_runs(project_id);
create index if not exists costing_items_run_idx on public.costing_items(costing_run_id);

alter table public.costing_runs enable row level security;
alter table public.costing_items enable row level security;

drop policy if exists "authenticated can access costing runs" on public.costing_runs;
create policy "authenticated can access costing runs" on public.costing_runs for all to authenticated using (true) with check (true);
drop policy if exists "authenticated can access costing items" on public.costing_items;
create policy "authenticated can access costing items" on public.costing_items for all to authenticated using (true) with check (true);
