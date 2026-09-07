create table if not exists public.goods_receipts (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete restrict,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  receipt_code text not null unique, receipt_date date not null default current_date,
  status text not null default 'DRAFT' check (status in ('DRAFT','RECEIVED','QC_PENDING','QC_COMPLETE','POSTED','CANCELLED')),
  supplier_document_no text, received_by uuid, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.goods_receipt_items (
  id uuid primary key default gen_random_uuid(), goods_receipt_id uuid not null references public.goods_receipts(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete restrict, purchase_order_item_id uuid not null references public.purchase_order_items(id) on delete restrict,
  item_code text not null, description text not null, ordered_quantity numeric(14,3) not null check (ordered_quantity > 0), received_quantity numeric(14,3) not null check (received_quantity >= 0), accepted_quantity numeric(14,3) not null default 0 check (accepted_quantity >= 0), rejected_quantity numeric(14,3) not null default 0 check (rejected_quantity >= 0), hold_quantity numeric(14,3) not null default 0 check (hold_quantity >= 0), unit text not null, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (accepted_quantity + rejected_quantity + hold_quantity = received_quantity)
);

create table if not exists public.goods_receipt_qc (
  id uuid primary key default gen_random_uuid(), goods_receipt_item_id uuid not null references public.goods_receipt_items(id) on delete cascade,
  status text not null check (status in ('PENDING','PASS','PARTIAL','FAIL','HOLD')),
  inspected_quantity numeric(14,3) not null default 0 check (inspected_quantity >= 0), accepted_quantity numeric(14,3) not null default 0 check (accepted_quantity >= 0), rejected_quantity numeric(14,3) not null default 0 check (rejected_quantity >= 0), hold_quantity numeric(14,3) not null default 0 check (hold_quantity >= 0), defect_code text, remarks text, inspected_by uuid, inspected_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (accepted_quantity + rejected_quantity + hold_quantity = inspected_quantity)
);

create index if not exists goods_receipts_project_idx on public.goods_receipts(project_id);
create index if not exists goods_receipts_po_idx on public.goods_receipts(purchase_order_id);
create index if not exists goods_receipt_items_receipt_idx on public.goods_receipt_items(goods_receipt_id);
create index if not exists goods_receipt_items_po_item_idx on public.goods_receipt_items(purchase_order_item_id);
create index if not exists goods_receipt_qc_item_idx on public.goods_receipt_qc(goods_receipt_item_id);

alter table public.goods_receipts enable row level security;
alter table public.goods_receipt_items enable row level security;
alter table public.goods_receipt_qc enable row level security;
create policy "authenticated access goods receipts" on public.goods_receipts for all to authenticated using (true) with check (true);
create policy "authenticated access goods receipt items" on public.goods_receipt_items for all to authenticated using (true) with check (true);
create policy "authenticated access goods receipt qc" on public.goods_receipt_qc for all to authenticated using (true) with check (true);

create or replace function public.validate_goods_receipt_project_links() returns trigger language plpgsql as $$
begin
  if tg_table_name = 'goods_receipts' then
    if not exists (select 1 from public.purchase_orders p where p.id = new.purchase_order_id and p.project_id = new.project_id) then raise exception 'Purchase order must belong to the same project'; end if;
  elsif tg_table_name = 'goods_receipt_items' then
    if not exists (select 1 from public.purchase_order_items p where p.id = new.purchase_order_item_id and p.project_id = new.project_id) then raise exception 'Purchase order item must belong to the same project'; end if;
  end if;
  return new;
end;
$$;
create or replace trigger goods_receipts_project_guard before insert or update on public.goods_receipts for each row execute function public.validate_goods_receipt_project_links();
create or replace trigger goods_receipt_items_project_guard before insert or update on public.goods_receipt_items for each row execute function public.validate_goods_receipt_project_links();
