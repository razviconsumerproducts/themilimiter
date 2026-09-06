-- MILLIMETRE V1: Purchase -> Goods Receipt -> Inventory transaction integrity
-- Receipt acceptance is the only path that makes received stock inventory-eligible.

create or replace function public.validate_goods_receipt_lineage()
returns trigger
language plpgsql
as $$
declare
  v_po_project uuid;
  v_po_status text;
  v_ordered numeric;
  v_received numeric;
  v_other numeric;
begin
  if new.purchase_order_id is null then
    raise exception 'Goods receipt requires a purchase order';
  end if;

  select po.project_id, po.status
    into v_po_project, v_po_status
  from public.purchase_orders po
  where po.id = new.purchase_order_id;

  if v_po_project is null then
    raise exception 'Goods receipt references a missing purchase order';
  end if;
  if new.project_id <> v_po_project then
    raise exception 'Goods receipt project must match purchase order project';
  end if;

  if v_po_status in ('DRAFT','CANCELLED','REJECTED') then
    raise exception 'Goods receipt cannot be posted against purchase order status %', v_po_status;
  end if;

  return new;
end;
$$;

drop trigger if exists goods_receipts_validate_lineage on public.goods_receipts;
create trigger goods_receipts_validate_lineage
before insert or update on public.goods_receipts
for each row execute function public.validate_goods_receipt_lineage();

create or replace function public.validate_goods_receipt_item_quantities()
returns trigger
language plpgsql
as $$
declare
  v_ordered numeric;
  v_received numeric;
begin
  if new.received_quantity <= 0 then
    raise exception 'Received quantity must be greater than zero';
  end if;
  if new.accepted_quantity < 0 or new.rejected_quantity < 0 or new.hold_quantity < 0 then
    raise exception 'Accepted, rejected and hold quantities cannot be negative';
  end if;
  if new.accepted_quantity + new.rejected_quantity + new.hold_quantity <> new.received_quantity then
    raise exception 'Accepted + rejected + hold must equal received quantity';
  end if;

  if new.accepted_quantity > new.received_quantity then
    raise exception 'Accepted quantity cannot exceed received quantity';
  end if;

  return new;
end;
$$;

drop trigger if exists goods_receipt_items_validate_quantities on public.goods_receipt_items;
create trigger goods_receipt_items_validate_quantities
before insert or update on public.goods_receipt_items
for each row execute function public.validate_goods_receipt_item_quantities();

-- A receipt item may be marked inventory-eligible only through its accepted quantity.
-- The inventory ledger must never be written from raw received quantity.
create or replace function public.validate_inventory_transaction_source()
returns trigger
language plpgsql
as $$
declare
  v_receipt_id uuid;
  v_accepted numeric;
  v_item_code text;
  v_existing numeric;
begin
  if new.reference_type = 'GOODS_RECEIPT' then
    v_receipt_id := new.reference_id;
    if v_receipt_id is null then
      raise exception 'Goods receipt inventory transaction requires reference_id';
    end if;

    select gri.accepted_quantity, coalesce(gri.item_code, '')
      into v_accepted, v_item_code
    from public.goods_receipt_items gri
    where gri.id = new.source_id;

    if v_accepted is null then
      raise exception 'Inventory transaction references a missing goods receipt item';
    end if;
    if new.quantity <= 0 then
      raise exception 'Inventory receipt quantity must be greater than zero';
    end if;
    if new.quantity > v_accepted then
      raise exception 'Inventory quantity cannot exceed accepted goods receipt quantity';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_transactions_validate_receipt_source on public.inventory_transactions;
create trigger inventory_transactions_validate_receipt_source
before insert or update on public.inventory_transactions
for each row execute function public.validate_inventory_transaction_source();

-- Keep the canonical invariant explicit for future integrations.
comment on table public.goods_receipts is 'Canonical receiving record: received quantity is not inventory until QC accepted quantity is posted.';
comment on table public.inventory_transactions is 'Canonical inventory ledger. Goods receipt postings must use accepted quantity only.';
