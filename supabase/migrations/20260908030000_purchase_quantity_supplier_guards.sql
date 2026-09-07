-- Stage 12: purchasing quantity, supplier, currency and subtotal safeguards.

create or replace function public.validate_purchase_order_business_rules()
returns trigger
language plpgsql
as $$
declare
  v_supplier_status text;
  v_supplier_currency text;
  v_request_project uuid;
  v_request_status text;
  v_requested_qty numeric;
  v_existing_po_qty numeric;
begin
  select status into v_supplier_status
  from public.suppliers
  where id = new.supplier_id;

  if v_supplier_status is null or v_supplier_status <> 'ACTIVE' then
    raise exception 'Purchase order requires an ACTIVE supplier';
  end if;

  if new.purchase_request_id is not null then
    select project_id, status into v_request_project, v_request_status
    from public.purchase_requests
    where id = new.purchase_request_id;

    if v_request_project is null or v_request_project <> new.project_id then
      raise exception 'Purchase order request must belong to the same project';
    end if;

    if new.status in ('PENDING_APPROVAL','APPROVED','SENT','PARTIALLY_RECEIVED','RECEIVED','CLOSED')
       and v_request_status not in ('APPROVED','ORDERED','PARTIALLY_RECEIVED','RECEIVED') then
      raise exception 'Purchase order requires an approved purchase request';
    end if;
  end if;

  if new.status in ('APPROVED','SENT','PARTIALLY_RECEIVED','RECEIVED','CLOSED') then
    select coalesce(sum(poi.line_total), 0) into v_existing_po_qty
    from public.purchase_order_items poi
    where poi.purchase_order_id = new.id;

    if abs(v_existing_po_qty - new.subtotal) > 0.02 then
      raise exception 'Purchase order subtotal must equal the sum of purchase order item totals';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_purchase_order_business_rules on public.purchase_orders;
create trigger trg_purchase_order_business_rules
before insert or update of supplier_id, project_id, purchase_request_id, status, subtotal
on public.purchase_orders
for each row execute function public.validate_purchase_order_business_rules();

create or replace function public.validate_purchase_order_item_quantity()
returns trigger
language plpgsql
as $$
declare
  v_request_item uuid;
  v_requested numeric;
  v_existing numeric;
  v_po_status text;
begin
  select po.status into v_po_status
  from public.purchase_orders po
  where po.id = new.purchase_order_id;

  if v_po_status is null then
    raise exception 'Purchase order not found';
  end if;

  if new.purchase_request_item_id is null then
    return new;
  end if;

  select pri.id, pri.quantity
    into v_request_item, v_requested
  from public.purchase_request_items pri
  where pri.id = new.purchase_request_item_id
    and pri.project_id = new.project_id;

  if v_request_item is null then
    raise exception 'Purchase order item must reference a valid purchase request item';
  end if;

  select coalesce(sum(poi.quantity), 0)
    into v_existing
  from public.purchase_order_items poi
  where poi.purchase_request_item_id = new.purchase_request_item_id
    and poi.id <> new.id
    and poi.purchase_order_id <> new.purchase_order_id;

  if v_existing + new.quantity > v_requested then
    raise exception 'Purchase order quantity exceeds the purchase request quantity';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_purchase_order_item_quantity on public.purchase_order_items;
create trigger trg_purchase_order_item_quantity
before insert or update of purchase_request_item_id, quantity, project_id
on public.purchase_order_items
for each row execute function public.validate_purchase_order_item_quantity();

create or replace function public.validate_supplier_item_currency()
returns trigger
language plpgsql
as $$
declare
  v_supplier uuid;
  v_order_currency text;
  v_item_currency text;
begin
  if new.supplier_item_id is null then
    return new;
  end if;

  select supplier_id, currency into v_supplier, v_item_currency
  from public.supplier_items
  where id = new.supplier_item_id;

  select currency into v_order_currency
  from public.purchase_orders
  where id = new.purchase_order_id;

  if v_supplier is null then
    raise exception 'Supplier item not found';
  end if;

  if v_item_currency <> v_order_currency then
    raise exception 'Supplier item currency must match purchase order currency';
  end if;

  if not exists (
    select 1 from public.suppliers s
    where s.id = v_supplier and s.status = 'ACTIVE'
  ) then
    raise exception 'Supplier item requires an ACTIVE supplier';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_supplier_item_currency on public.purchase_order_items;
create trigger trg_supplier_item_currency
before insert or update of supplier_item_id, purchase_order_id
on public.purchase_order_items
for each row execute function public.validate_supplier_item_currency();

create index if not exists purchase_order_items_request_qty_idx
  on public.purchase_order_items(purchase_request_item_id);
create index if not exists supplier_items_currency_active_idx
  on public.supplier_items(supplier_id, currency, active);
