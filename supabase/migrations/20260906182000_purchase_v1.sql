create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(), supplier_code text not null unique, name text not null, phone text, email text, address text, tax_id text, status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','BLOCKED')), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.purchase_requests (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete restrict,
  request_code text not null unique, status text not null default 'DRAFT' check (status in ('DRAFT','SUBMITTED','APPROVED','ORDERED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED')),
  requested_by uuid, approved_by uuid, requested_at timestamptz, approved_at timestamptz, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.purchase_request_items (
  id uuid primary key default gen_random_uuid(), purchase_request_id uuid not null references public.purchase_requests(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete restrict, bom_item_id uuid references public.bom_items(id) on delete restrict,
  item_code text not null, description text not null, quantity numeric(14,3) not null check (quantity > 0), unit text not null,
  required_date date, notes text, created_at timestamptz not null default now()
);

create table if not exists public.supplier_items (
  id uuid primary key default gen_random_uuid(), supplier_id uuid not null references public.suppliers(id) on delete cascade,
  item_code text not null, description text, unit text not null, quoted_unit_cost numeric(14,4), currency text not null default 'INR', lead_time_days integer check (lead_time_days >= 0), active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(supplier_id,item_code)
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete restrict,
  supplier_id uuid not null references public.suppliers(id) on delete restrict, purchase_request_id uuid references public.purchase_requests(id) on delete restrict,
  po_code text not null unique, status text not null default 'DRAFT' check (status in ('DRAFT','PENDING_APPROVAL','APPROVED','SENT','PARTIALLY_RECEIVED','RECEIVED','CANCELLED','CLOSED')),
  currency text not null default 'INR', subtotal numeric(14,2) not null default 0 check (subtotal >= 0), tax numeric(14,2) not null default 0 check (tax >= 0), total numeric(14,2) generated always as (subtotal + tax) stored,
  order_date date, expected_date date, approved_by uuid, approved_at timestamptz, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(), purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete restrict, purchase_request_item_id uuid references public.purchase_request_items(id) on delete restrict,
  supplier_item_id uuid references public.supplier_items(id) on delete set null, item_code text not null, description text not null,
  quantity numeric(14,3) not null check (quantity > 0), unit text not null, unit_price numeric(14,4) not null check (unit_price >= 0), tax_rate numeric(7,3) not null default 0 check (tax_rate >= 0), line_total numeric(14,2) generated always as (round(quantity * unit_price * (1 + tax_rate / 100), 2)) stored,
  price_snapshot jsonb not null default '{}'::jsonb, notes text, created_at timestamptz not null default now()
);

create index if not exists purchase_requests_project_idx on public.purchase_requests(project_id);
create index if not exists purchase_request_items_request_idx on public.purchase_request_items(purchase_request_id);
create index if not exists purchase_request_items_bom_idx on public.purchase_request_items(bom_item_id);
create index if not exists supplier_items_supplier_idx on public.supplier_items(supplier_id);
create index if not exists purchase_orders_project_idx on public.purchase_orders(project_id);
create index if not exists purchase_orders_supplier_idx on public.purchase_orders(supplier_id);
create index if not exists purchase_order_items_po_idx on public.purchase_order_items(purchase_order_id);

alter table public.suppliers enable row level security;
alter table public.purchase_requests enable row level security;
alter table public.purchase_request_items enable row level security;
alter table public.supplier_items enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;

create policy "authenticated access suppliers" on public.suppliers for all to authenticated using (true) with check (true);
create policy "authenticated access purchase requests" on public.purchase_requests for all to authenticated using (true) with check (true);
create policy "authenticated access purchase request items" on public.purchase_request_items for all to authenticated using (true) with check (true);
create policy "authenticated access supplier items" on public.supplier_items for all to authenticated using (true) with check (true);
create policy "authenticated access purchase orders" on public.purchase_orders for all to authenticated using (true) with check (true);
create policy "authenticated access purchase order items" on public.purchase_order_items for all to authenticated using (true) with check (true);

create or replace function public.validate_purchase_project_links() returns trigger language plpgsql as $$
begin
  if new.project_id is null then raise exception 'Purchase transaction requires a project'; end if;
  if tg_table_name = 'purchase_request_items' and new.bom_item_id is not null then
    if not exists (select 1 from public.bom_items b where b.id = new.bom_item_id and b.project_id = new.project_id) then raise exception 'BOM item must belong to the same project'; end if;
  end if;
  return new;
end;
$$;

create or replace trigger purchase_request_items_project_guard before insert or update on public.purchase_request_items for each row execute function public.validate_purchase_project_links();
