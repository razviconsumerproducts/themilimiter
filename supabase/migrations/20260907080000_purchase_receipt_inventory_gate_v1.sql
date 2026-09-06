-- MILLIMETRE Stage 12→13→14 integrity gate
-- Purchase Order -> Goods Receipt -> QC -> Inventory
-- Additive only: preserves existing schema and prevents inventory from bypassing receipt/QC.

create or replace function public.validate_goods_receipt_purchase_lineage()
returns trigger
language plpgsql
as $$
declare
  v_project_id uuid;
  v_po_status text;
begin
  if new.purchase_order_id is null then
    return new;
  end if;

  select po.project_id, po.status
    into v_project_id, v_po_status
  from public.purchase_orders po
  where po.id = new.purchase_order_id;

  if v_project_id is null then
    raise exception 'Goods receipt requires a valid purchase order';
  end if;

  if new.project_id <> v_project_id then
    raise exception 'Goods receipt and purchase order must belong to the same project';
  end if;

  if v_po_status in ('DRAFT','CANCELLED','REJECTED') then
    raise exception 'Goods receipt cannot be created from a non-releasable purchase order';
  end if;

  return new;
end;
$$;

drop trigger if exists goods_receipts_validate_purchase_lineage on public.goods_receipts;
create trigger goods_receipts_validate_purchase_lineage
before insert or update of project_id, purchase_order_id on public.goods_receipts
for each row execute function public.validate_goods_receipt_purchase_lineage();

create or replace function public.validate_inventory_from_goods_receipt()
returns trigger
language plpgsql
as $$
declare
  v_received_project uuid;
  v_qc_status text;
  v_eligible numeric;
begin
  if new.reference_type is null or upper(new.reference_type) not in ('GOODS_RECEIPT','GOODS_RECEIPT_ITEM') then
    return new;
  end if;

  if new.reference_id is null then
    raise exception 'Inventory receipt transaction requires a goods receipt reference';
  end if;

  select gr.project_id into v_received_project
  from public.goods_receipts gr
  where gr.id = new.reference_id;

  if v_received_project is null then
    raise exception 'Inventory transaction references an invalid goods receipt';
  end if;

  if new.project_id is not null and new.project_id <> v_received_project then
    raise exception 'Inventory transaction and goods receipt must belong to the same project';
  end if;

  if exists (
    select 1 from public.goods_receipt_qc q
    where q.goods_receipt_id = new.reference_id
  ) then
    select q.status, coalesce(q.accepted_quantity, 0)
      into v_qc_status, v_eligible
    from public.goods_receipt_qc q
    where q.goods_receipt_id = new.reference_id
    order by q.created_at desc
    limit 1;

    if v_qc_status not in ('PASS','PARTIAL') or coalesce(v_eligible, 0) <= 0 then
      raise exception 'Inventory can only receive QC-accepted goods';
    end if;

    if new.quantity > v_eligible then
      raise exception 'Inventory quantity exceeds QC-accepted quantity';
    end if;
  else
    raise exception 'Inventory receipt requires completed goods receipt QC';
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_validate_goods_receipt on public.inventory_transactions;
create trigger inventory_validate_goods_receipt
before insert or update of project_id, reference_type, reference_id, quantity on public.inventory_transactions
for each row execute function public.validate_inventory_from_goods_receipt();

-- RLS: exposed transactional tables must be protected by authenticated policies.
alter table public.goods_receipts enable row level security;
alter table public.goods_receipt_qc enable row level security;
alter table public.inventory_transactions enable row level security;

-- Idempotent authenticated policies. Existing policies are not removed.
drop policy if exists goods_receipts_authenticated_all on public.goods_receipts;
create policy goods_receipts_authenticated_all
on public.goods_receipts for all to authenticated
using (true) with check (true);

drop policy if exists goods_receipt_qc_authenticated_all on public.goods_receipt_qc;
create policy goods_receipt_qc_authenticated_all
on public.goods_receipt_qc for all to authenticated
using (true) with check (true);

drop policy if exists inventory_transactions_authenticated_all on public.inventory_transactions;
create policy inventory_transactions_authenticated_all
on public.inventory_transactions for all to authenticated
using (true) with check (true);

create index if not exists goods_receipts_purchase_order_idx
  on public.goods_receipts(purchase_order_id);
create index if not exists inventory_transactions_reference_idx
  on public.inventory_transactions(reference_type, reference_id);
