create table if not exists public.inventory_locations (
  id uuid primary key default gen_random_uuid(), location_code text not null unique, name text not null, location_type text not null default 'WAREHOUSE' check (location_type in ('WAREHOUSE','STORE','FACTORY','SITE','VEHICLE','OTHER')), active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(), project_id uuid references public.projects(id) on delete restrict, location_id uuid not null references public.inventory_locations(id) on delete restrict,
  item_code text not null, description text, quantity numeric(14,3) not null check (quantity <> 0), unit text not null,
  transaction_type text not null check (transaction_type in ('RECEIPT','ISSUE','ADJUSTMENT','TRANSFER_IN','TRANSFER_OUT','RETURN','REJECT','SCRAP')), source_type text, source_id uuid, reference text, transaction_date timestamptz not null default now(), created_by uuid, created_at timestamptz not null default now()
);

create table if not exists public.inventory_reservations (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete restrict, location_id uuid not null references public.inventory_locations(id) on delete restrict,
  item_code text not null, description text, quantity numeric(14,3) not null check (quantity > 0), unit text not null, status text not null default 'ACTIVE' check (status in ('ACTIVE','FULFILLED','RELEASED','CANCELLED')), source_type text, source_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.inventory_transfers (
  id uuid primary key default gen_random_uuid(), transfer_code text not null unique, project_id uuid references public.projects(id) on delete restrict,
  from_location_id uuid not null references public.inventory_locations(id) on delete restrict, to_location_id uuid not null references public.inventory_locations(id) on delete restrict,
  status text not null default 'DRAFT' check (status in ('DRAFT','RELEASED','IN_TRANSIT','RECEIVED','CANCELLED')), transfer_date timestamptz, received_at timestamptz, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check (from_location_id <> to_location_id)
);

create table if not exists public.inventory_transfer_items (
  id uuid primary key default gen_random_uuid(), transfer_id uuid not null references public.inventory_transfers(id) on delete cascade, item_code text not null, description text, quantity numeric(14,3) not null check (quantity > 0), unit text not null, created_at timestamptz not null default now()
);

create index if not exists inventory_transactions_location_item_idx on public.inventory_transactions(location_id,item_code);
create index if not exists inventory_transactions_project_idx on public.inventory_transactions(project_id);
create index if not exists inventory_reservations_location_item_idx on public.inventory_reservations(location_id,item_code,status);
create index if not exists inventory_reservations_project_idx on public.inventory_reservations(project_id);
create index if not exists inventory_transfers_project_idx on public.inventory_transfers(project_id);
create index if not exists inventory_transfer_items_transfer_idx on public.inventory_transfer_items(transfer_id);

alter table public.inventory_locations enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.inventory_reservations enable row level security;
alter table public.inventory_transfers enable row level security;
alter table public.inventory_transfer_items enable row level security;
create policy "authenticated access inventory locations" on public.inventory_locations for all to authenticated using (true) with check (true);
create policy "authenticated access inventory transactions" on public.inventory_transactions for all to authenticated using (true) with check (true);
create policy "authenticated access inventory reservations" on public.inventory_reservations for all to authenticated using (true) with check (true);
create policy "authenticated access inventory transfers" on public.inventory_transfers for all to authenticated using (true) with check (true);
create policy "authenticated access inventory transfer items" on public.inventory_transfer_items for all to authenticated using (true) with check (true);

create or replace function public.inventory_available(p_location uuid, p_item_code text) returns numeric language sql stable as $$
  select coalesce((select sum(quantity) from public.inventory_transactions where location_id=p_location and item_code=p_item_code),0)
       - coalesce((select sum(quantity) from public.inventory_reservations where location_id=p_location and item_code=p_item_code and status='ACTIVE'),0);
$$;
