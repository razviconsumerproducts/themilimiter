create table if not exists public.boms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  calculation_run_id uuid not null references public.calculation_runs(id) on delete restrict,
  bom_code text not null unique,
  version integer not null default 1,
  status text not null default 'GENERATED' check (status in ('DRAFT','GENERATED','REVIEW','APPROVED','RELEASED','SUPERSEDED','CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_by uuid,
  approved_at timestamptz,
  released_by uuid,
  released_at timestamptz,
  unique(project_id, calculation_run_id, version)
);

create table if not exists public.bom_items (
  id uuid primary key default gen_random_uuid(),
  bom_id uuid not null references public.boms(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete restrict,
  furniture_item_id uuid references public.furniture_items(id) on delete set null,
  item_type text not null check (item_type in ('BOARD','LAMINATE','EDGE_BAND','HARDWARE','ACCESSORY','CONSUMABLE','OTHER')),
  item_id uuid,
  item_code text,
  description text not null,
  quantity numeric(14,4) not null check (quantity >= 0),
  unit text not null,
  calculation_basis text,
  source_component_id uuid references public.furniture_components(id) on delete set null,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists boms_project_idx on public.boms(project_id);
create index if not exists boms_calculation_idx on public.boms(calculation_run_id);
create index if not exists bom_items_bom_idx on public.bom_items(bom_id);
create index if not exists bom_items_project_idx on public.bom_items(project_id);
create index if not exists bom_items_source_component_idx on public.bom_items(source_component_id);

alter table public.boms enable row level security;
alter table public.bom_items enable row level security;

drop policy if exists "authenticated can access boms" on public.boms;
create policy "authenticated can access boms" on public.boms for all to authenticated using (true) with check (true);
drop policy if exists "authenticated can access bom items" on public.bom_items;
create policy "authenticated can access bom items" on public.bom_items for all to authenticated using (true) with check (true);
