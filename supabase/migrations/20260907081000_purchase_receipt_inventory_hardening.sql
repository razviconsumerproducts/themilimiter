-- MILLIMETRE V1 hardening: Purchase -> Goods Receipt -> Inventory
-- Fixes the prior source-column mismatch and closes duplicate/over-receipt paths.

create index if not exists inventory_transactions_goods_receipt_source_idx
  on public.inventory_transactions(source_type, source_id)
  where source_type = 'GOODS_RECEIPT';

create or replace function public.validate_goods_receipt_item_lineage()
returns trigger
language plpgsql
as $$
declare
  v_receipt_project uuid;
  v_po_id uuid;
  v_po_item_project uuid;
  v_po_item_qty numeric;
  v_other_received numeric;
begin
  select gr.project_id, gr.purchase_order_id
    into v_receipt_project, v_po_id
  from public.goods_receipts gr
  where gr.id = new.goods_receipt_id;

  if v_receipt_project is null then
    raise exception 'Goods receipt item references a missing goods receipt';
  end if;
  if new.project_id <> v_receipt_project then
    raise exception 'Goods receipt item project must match goods receipt project';
  end if;

  select poi.project_id, poi.quantity
    into v_po_item_project, v_po_item_qty
  from public.purchase_order_items poi
  where poi.id = new.purchase_order_item_id
    and poi.purchase_order_id = v_po_id;

  if v_po_item_project is null then
    raise exception 'Goods receipt item must reference an item on the receipt purchase order';
  end if;
  if v_po_item_project <> new.project_id then
    raise exception 'Purchase order item must belong to the same project';
  end if;
  if new.ordered_quantity <> v_po_item_qty then
    raise exception 'Goods receipt ordered quantity must match purchase order item quantity';
  end if;

  select coalesce(sum(gri.received_quantity), 0)
    into v_other_received
  from public.goods_receipt_items gri
  join public.goods_receipts gr on gr.id = gri.goods_receipt_id
  where gri.purchase_order_item_id = new.purchase_order_item_id
    and gri.id <> new.id
    and gr.status <> 'CANCELLED';

  if v_other_received + new.received_quantity > v_po_item_qty then
    raise exception 'Cumulative goods receipt quantity cannot exceed purchase order quantity';
  end if;

  if new.item_code <> (select poi.item_code from public.purchase_order_items poi where poi.id = new.purchase_order_item_id) then
    raise exception 'Goods receipt item code must match purchase order item';
  end if;
  if new.unit <> (select poi.unit from public.purchase_order_items poi where poi.id = new.purchase_order_item_id) then
    raise exception 'Goods receipt unit must match purchase order item';
  end if;

  return new;
end;
$$;

drop trigger if exists goods_receipt_items_lineage_guard on public.goods_receipt_items;
create trigger goods_receipt_items_lineage_guard
before insert or update on public.goods_receipt_items
for each row execute function public.validate_goods_receipt_item_lineage();

create or replace function public.validate_goods_receipt_status_transition()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.status <> old.status then
    if not (
      (old.status = 'DRAFT' and new.status in ('RECEIVED','CANCELLED')) or
      (old.status = 'RECEIVED' and new.status in ('QC_PENDING','CANCELLED')) or
      (old.status = 'QC_PENDING' and new.status in ('QC_COMPLETE','CANCELLED')) or
      (old.status = 'QC_COMPLETE' and new.status in ('POSTED','CANCELLED'))
    ) then
      raise exception 'Invalid goods receipt status transition: % -> %', old.status, new.status;
    end if;
  end if;

  if new.status in ('QC_COMPLETE','POSTED') then
    if not exists (select 1 from public.goods_receipt_items gri where gri.goods_receipt_id = new.id) then
      raise exception 'Goods receipt cannot reach % without receipt items', new.status;
    end if;
    if exists (
      select 1 from public.goods_receipt_items gri
      where gri.goods_receipt_id = new.id
        and gri.accepted_quantity + gri.rejected_quantity + gri.hold_quantity <> gri.received_quantity
    ) then
      raise exception 'Goods receipt quantities are incomplete';
    end if;
    if exists (
      select 1 from public.goods_receipt_items gri
      where gri.goods_receipt_id = new.id
        and not exists (
          select 1 from public.goods_receipt_qc q
          where q.goods_receipt_item_id = gri.id
            and q.inspected_quantity = gri.received_quantity
            and q.accepted_quantity = gri.accepted_quantity
            and q.rejected_quantity = gri.rejected_quantity
            and q.hold_quantity = gri.hold_quantity
            and q.status in ('PASS','PARTIAL','FAIL','HOLD')
        )
    ) then
      raise exception 'Every goods receipt item must have completed QC before %', new.status;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists goods_receipts_status_guard on public.goods_receipts;
create trigger goods_receipts_status_guard
before insert or update on public.goods_receipts
for each row execute function public.validate_goods_receipt_status_transition();

create or replace function public.prevent_posted_goods_receipt_mutation()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  if tg_table_name = 'goods_receipts' then
    v_status := coalesce(old.status, new.status);
    if tg_op = 'DELETE' and old.status in ('POSTED','CANCELLED') then
      raise exception 'Posted or cancelled goods receipts are immutable';
    end if;
    if tg_op = 'UPDATE' and old.status in ('POSTED','CANCELLED') then
      raise exception 'Posted or cancelled goods receipts are immutable';
    end if;
  elsif tg_table_name = 'goods_receipt_items' then
    select status into v_status from public.goods_receipts where id = coalesce(new.goods_receipt_id, old.goods_receipt_id);
    if v_status in ('POSTED','CANCELLED') then
      raise exception 'Items of posted or cancelled goods receipts are immutable';
    end if;
  elsif tg_table_name = 'goods_receipt_qc' then
    select gr.status into v_status
    from public.goods_receipt_items gri
    join public.goods_receipts gr on gr.id = gri.goods_receipt_id
    where gri.id = coalesce(new.goods_receipt_item_id, old.goods_receipt_item_id);
    if v_status in ('POSTED','CANCELLED') then
      raise exception 'QC of posted or cancelled goods receipts is immutable';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists goods_receipts_immutable_guard on public.goods_receipts;
create trigger goods_receipts_immutable_guard
before update or delete on public.goods_receipts
for each row execute function public.prevent_posted_goods_receipt_mutation();

drop trigger if exists goods_receipt_items_immutable_guard on public.goods_receipt_items;
create trigger goods_receipt_items_immutable_guard
before update or delete on public.goods_receipt_items
for each row execute function public.prevent_posted_goods_receipt_mutation();

drop trigger if exists goods_receipt_qc_immutable_guard on public.goods_receipt_qc;
create trigger goods_receipt_qc_immutable_guard
before update or delete on public.goods_receipt_qc
for each row execute function public.prevent_posted_goods_receipt_mutation();

-- Replace the earlier broken reference_type/reference_id implementation.
create or replace function public.validate_inventory_transaction_source()
returns trigger
language plpgsql
as $$
declare
  v_receipt_item public.goods_receipt_items%rowtype;
  v_receipt_status text;
  v_existing numeric;
begin
  if new.transaction_type = 'RECEIPT' and new.source_type = 'GOODS_RECEIPT' then
    if new.source_id is null then
      raise exception 'Goods receipt inventory transaction requires source_id';
    end if;

    select gri.* into v_receipt_item
    from public.goods_receipt_items gri
    where gri.id = new.source_id;

    if v_receipt_item.id is null then
      raise exception 'Inventory transaction references a missing goods receipt item';
    end if;

    select gr.status into v_receipt_status
    from public.goods_receipts gr
    where gr.id = v_receipt_item.goods_receipt_id;

    if v_receipt_status <> 'POSTED' then
      raise exception 'Goods receipt inventory transaction requires a POSTED goods receipt';
    end if;
    if new.project_id <> v_receipt_item.project_id then
      raise exception 'Inventory project must match goods receipt project';
    end if;
    if new.item_code <> v_receipt_item.item_code then
      raise exception 'Inventory item code must match goods receipt item';
    end if;
    if new.unit <> v_receipt_item.unit then
      raise exception 'Inventory unit must match goods receipt item';
    end if;
    if new.quantity <= 0 then
      raise exception 'Inventory receipt quantity must be greater than zero';
    end if;

    select coalesce(sum(it.quantity), 0)
      into v_existing
    from public.inventory_transactions it
    where it.source_type = 'GOODS_RECEIPT'
      and it.source_id = new.source_id
      and it.transaction_type = 'RECEIPT'
      and it.id <> new.id;

    if v_existing + new.quantity > v_receipt_item.accepted_quantity then
      raise exception 'Inventory receipt postings cannot exceed accepted goods receipt quantity';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_transactions_validate_receipt_source on public.inventory_transactions;
create trigger inventory_transactions_validate_receipt_source
before insert or update on public.inventory_transactions
for each row execute function public.validate_inventory_transaction_source();

-- Inventory ledger rows are immutable; corrections must be compensating transactions.
create or replace function public.prevent_inventory_transaction_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Inventory transactions are immutable; use a compensating transaction';
end;
$$;

drop trigger if exists inventory_transactions_immutable_guard on public.inventory_transactions;
create trigger inventory_transactions_immutable_guard
before update or delete on public.inventory_transactions
for each row execute function public.prevent_inventory_transaction_mutation();

comment on table public.inventory_transactions is 'Immutable canonical inventory ledger. GOODS_RECEIPT RECEIPT rows must reference POSTED receipt items and cannot exceed accepted quantity.';
