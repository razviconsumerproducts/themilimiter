create table if not exists public.production_orders (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete restrict,
  cutting_list_id uuid references public.cutting_lists(id) on delete restrict, production_code text not null unique,
  version integer not null default 1, status text not null default 'DRAFT' check (status in ('DRAFT','RELEASED','IN_PROGRESS','ON_HOLD','COMPLETED','CANCELLED')),
  priority integer not null default 0, planned_start date, planned_end date, released_by uuid, released_at timestamptz, completed_at timestamptz,
  notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.production_pieces (
  id uuid primary key default gen_random_uuid(), production_order_id uuid not null references public.production_orders(id) on delete cascade,
  cutting_list_item_id uuid references public.cutting_list_items(id) on delete restrict, piece_code text not null, item_code text,
  description text, required_quantity numeric(14,3) not null check (required_quantity > 0), completed_quantity numeric(14,3) not null default 0 check (completed_quantity >= 0),
  rejected_quantity numeric(14,3) not null default 0 check (rejected_quantity >= 0), status text not null default 'PENDING' check (status in ('PENDING','READY','IN_PROGRESS','COMPLETE','REWORK','REJECTED')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(production_order_id,piece_code)
);

create table if not exists public.work_orders (
  id uuid primary key default gen_random_uuid(), production_order_id uuid not null references public.production_orders(id) on delete cascade,
  production_piece_id uuid references public.production_pieces(id) on delete restrict, work_order_code text not null unique,
  work_center text not null, operation text not null, sequence_no integer not null default 1, status text not null default 'PENDING' check (status in ('PENDING','READY','IN_PROGRESS','PAUSED','COMPLETE','REWORK','CANCELLED')),
  planned_quantity numeric(14,3) not null check (planned_quantity > 0), completed_quantity numeric(14,3) not null default 0 check (completed_quantity >= 0), rejected_quantity numeric(14,3) not null default 0 check (rejected_quantity >= 0), started_at timestamptz, completed_at timestamptz, assigned_to uuid, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.production_material_issues (
  id uuid primary key default gen_random_uuid(), production_order_id uuid not null references public.production_orders(id) on delete restrict,
  work_order_id uuid references public.work_orders(id) on delete restrict, item_code text not null, quantity numeric(14,3) not null check (quantity > 0), unit text not null,
  inventory_location_id uuid not null references public.inventory_locations(id) on delete restrict, inventory_transaction_id uuid references public.inventory_transactions(id) on delete restrict,
  status text not null default 'REQUESTED' check (status in ('REQUESTED','ISSUED','CANCELLED')), issued_at timestamptz, issued_by uuid, notes text, created_at timestamptz not null default now()
);

create index if not exists production_orders_project_idx on public.production_orders(project_id);
create index if not exists production_pieces_order_idx on public.production_pieces(production_order_id);
create index if not exists work_orders_order_idx on public.work_orders(production_order_id);
create index if not exists work_orders_center_status_idx on public.work_orders(work_center,status);
create index if not exists production_material_issues_order_idx on public.production_material_issues(production_order_id);

alter table public.production_orders enable row level security;
alter table public.production_pieces enable row level security;
alter table public.work_orders enable row level security;
alter table public.production_material_issues enable row level security;
create policy "authenticated access production orders" on public.production_orders for all to authenticated using (true) with check (true);
create policy "authenticated access production pieces" on public.production_pieces for all to authenticated using (true) with check (true);
create policy "authenticated access work orders" on public.work_orders for all to authenticated using (true) with check (true);
create policy "authenticated access production material issues" on public.production_material_issues for all to authenticated using (true) with check (true);
