-- MILLIMETRE Stage 18: Delivery + Installation
-- Additive migration. Existing work is preserved.

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  delivery_code text not null unique,
  status text not null default 'PLANNED' check (status in ('PLANNED','READY','DISPATCHED','IN_TRANSIT','DELIVERED','PARTIAL','CANCELLED')),
  scheduled_date date,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  vehicle_reference text,
  driver_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_items (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete restrict,
  production_order_id uuid references public.production_orders(id) on delete restrict,
  production_piece_id uuid references public.production_pieces(id) on delete restrict,
  label_id uuid,
  item_code text not null,
  description text,
  quantity numeric(14,3) not null check (quantity > 0),
  status text not null default 'PENDING' check (status in ('PENDING','LOADED','DELIVERED','DAMAGED','MISSING','RETURNED')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.installations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  delivery_id uuid references public.deliveries(id) on delete restrict,
  installation_code text not null unique,
  status text not null default 'SCHEDULED' check (status in ('SCHEDULED','ASSIGNED','IN_PROGRESS','PARTIAL','COMPLETED','BLOCKED','CANCELLED')),
  scheduled_date date,
  started_at timestamptz,
  completed_at timestamptz,
  installer_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.installation_items (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid not null references public.installations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete restrict,
  delivery_item_id uuid references public.delivery_items(id) on delete restrict,
  item_code text not null,
  description text,
  planned_quantity numeric(14,3) not null check (planned_quantity > 0),
  installed_quantity numeric(14,3) not null default 0 check (installed_quantity >= 0),
  rejected_quantity numeric(14,3) not null default 0 check (rejected_quantity >= 0),
  status text not null default 'PENDING' check (status in ('PENDING','INSTALLED','REWORK','REJECTED','MISSING')),
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint installation_item_quantity_chk check (installed_quantity + rejected_quantity <= planned_quantity)
);

create table if not exists public.installation_signoffs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  installation_id uuid not null references public.installations(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING','SIGNED','REFUSED')),
  customer_name text,
  signed_at timestamptz,
  signature_reference text,
  remarks text,
  created_at timestamptz not null default now()
);

create index if not exists deliveries_project_idx on public.deliveries(project_id);
create index if not exists delivery_items_delivery_idx on public.delivery_items(delivery_id);
create index if not exists delivery_items_project_idx on public.delivery_items(project_id);
create index if not exists installations_project_idx on public.installations(project_id);
create index if not exists installations_delivery_idx on public.installations(delivery_id);
create index if not exists installation_items_installation_idx on public.installation_items(installation_id);
create index if not exists installation_signoffs_installation_idx on public.installation_signoffs(installation_id);

create or replace function public.validate_delivery_installation_project()
returns trigger language plpgsql as $$
declare linked_project uuid;
begin
  if tg_table_name = 'delivery_items' then
    select project_id into linked_project from public.deliveries where id = new.delivery_id;
    if linked_project is null or linked_project <> new.project_id then
      raise exception 'Delivery item must belong to the same project as its delivery';
    end if;
    if new.production_order_id is not null then
      select project_id into linked_project from public.production_orders where id = new.production_order_id;
      if linked_project is null or linked_project <> new.project_id then raise exception 'Delivery production order project mismatch'; end if;
    end if;
  elsif tg_table_name = 'installations' then
    if new.delivery_id is not null then
      select project_id into linked_project from public.deliveries where id = new.delivery_id;
      if linked_project is null or linked_project <> new.project_id then raise exception 'Installation delivery project mismatch'; end if;
    end if;
  elsif tg_table_name = 'installation_items' then
    select project_id into linked_project from public.installations where id = new.installation_id;
    if linked_project is null or linked_project <> new.project_id then raise exception 'Installation item must belong to the same project as its installation'; end if;
    if new.delivery_item_id is not null then
      select project_id into linked_project from public.delivery_items where id = new.delivery_item_id;
      if linked_project is null or linked_project <> new.project_id then raise exception 'Installation delivery item project mismatch'; end if;
    end if;
  elsif tg_table_name = 'installation_signoffs' then
    select project_id into linked_project from public.installations where id = new.installation_id;
    if linked_project is null or linked_project <> new.project_id then raise exception 'Installation signoff project mismatch'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists delivery_items_validate_project on public.delivery_items;
create trigger delivery_items_validate_project before insert or update on public.delivery_items for each row execute function public.validate_delivery_installation_project();
drop trigger if exists installations_validate_project on public.installations;
create trigger installations_validate_project before insert or update on public.installations for each row execute function public.validate_delivery_installation_project();
drop trigger if exists installation_items_validate_project on public.installation_items;
create trigger installation_items_validate_project before insert or update on public.installation_items for each row execute function public.validate_delivery_installation_project();
drop trigger if exists installation_signoffs_validate_project on public.installation_signoffs;
create trigger installation_signoffs_validate_project before insert or update on public.installation_signoffs for each row execute function public.validate_delivery_installation_project();

alter table public.deliveries enable row level security;
alter table public.delivery_items enable row level security;
alter table public.installations enable row level security;
alter table public.installation_items enable row level security;
alter table public.installation_signoffs enable row level security;

create policy deliveries_authenticated on public.deliveries for all to authenticated using (true) with check (true);
create policy delivery_items_authenticated on public.delivery_items for all to authenticated using (true) with check (true);
create policy installations_authenticated on public.installations for all to authenticated using (true) with check (true);
create policy installation_items_authenticated on public.installation_items for all to authenticated using (true) with check (true);
create policy installation_signoffs_authenticated on public.installation_signoffs for all to authenticated using (true) with check (true);
