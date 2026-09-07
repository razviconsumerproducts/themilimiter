create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  customer_id uuid not null references public.customers(id),
  costing_run_id uuid not null references public.costing_runs(id),
  quotation_code text not null,
  version integer not null default 1,
  status text not null default 'DRAFT' check (status in ('DRAFT','INTERNAL_REVIEW','APPROVED','ISSUED','SENT','VIEWED','ACCEPTED','REJECTED','EXPIRED','CANCELLED','SUPERSEDED')),
  quotation_date date not null default current_date,
  valid_until date,
  currency text not null default 'INR',
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  taxable_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  grand_total numeric(14,2) generated always as (taxable_amount + tax_amount) stored,
  payment_terms text,
  delivery_terms text,
  installation_terms text,
  warranty_terms text,
  notes text,
  customer_notes text,
  cost_snapshot jsonb not null default '{}'::jsonb,
  commercial_snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  issued_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  expired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, quotation_code, version)
);

create table if not exists public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  item_type text not null,
  source_type text,
  source_id uuid,
  item_code text,
  description text not null,
  quantity numeric(14,4) not null check (quantity >= 0),
  unit text not null,
  unit_price numeric(14,4) not null default 0 check (unit_price >= 0),
  discount numeric(14,2) not null default 0 check (discount >= 0),
  tax_rate numeric(7,3) not null default 0 check (tax_rate >= 0),
  tax_amount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null default 0,
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists quotations_project_idx on public.quotations(project_id);
create index if not exists quotations_costing_idx on public.quotations(costing_run_id);
create index if not exists quotation_items_quote_idx on public.quotation_items(quotation_id);

alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;

drop policy if exists "authenticated can access quotations" on public.quotations;
create policy "authenticated can access quotations" on public.quotations for all to authenticated using (true) with check (true);
drop policy if exists "authenticated can access quotation items" on public.quotation_items;
create policy "authenticated can access quotation items" on public.quotation_items for all to authenticated using (true) with check (true);
