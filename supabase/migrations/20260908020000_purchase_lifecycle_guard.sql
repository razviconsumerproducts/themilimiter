-- Stage 12: purchasing lifecycle and commercial release protection.

create or replace function public.validate_purchase_request_lifecycle()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'DRAFT' and new.status = 'SUBMITTED') or
      (old.status = 'SUBMITTED' and new.status in ('APPROVED','CANCELLED')) or
      (old.status = 'APPROVED' and new.status in ('ORDERED','CANCELLED')) or
      (old.status = 'ORDERED' and new.status in ('PARTIALLY_RECEIVED','RECEIVED','CANCELLED')) or
      (old.status = 'PARTIALLY_RECEIVED' and new.status in ('RECEIVED','CANCELLED'))
    ) then
      raise exception 'Invalid purchase request transition: % -> %.', old.status, new.status;
    end if;
  end if;

  if new.status in ('SUBMITTED','APPROVED','ORDERED','PARTIALLY_RECEIVED','RECEIVED') then
    if not exists (select 1 from public.commercial_release_gates g where g.project_id = new.project_id and g.status = 'RELEASED') then
      raise exception 'Purchase request requires a RELEASED commercial gate';
    end if;
  end if;

  if new.status = 'APPROVED' and (new.approved_by is null or new.approved_at is null) then
    raise exception 'Approved purchase request requires approved_by and approved_at';
  end if;
  if new.status in ('SUBMITTED','APPROVED') and not exists (select 1 from public.purchase_request_items i where i.purchase_request_id = new.id) then
    raise exception 'Purchase request cannot advance without items';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_purchase_request_lifecycle on public.purchase_requests;
create trigger trg_purchase_request_lifecycle
before update on public.purchase_requests
for each row execute function public.validate_purchase_request_lifecycle();

create or replace function public.validate_purchase_order_lineage()
returns trigger
language plpgsql
as $$
declare
  v_request_project uuid;
  v_request_status text;
  v_gate_status text;
  v_supplier_status text;
  v_subtotal numeric;
  v_tax numeric;
begin
  if new.purchase_request_id is not null then
    select project_id, status into v_request_project, v_request_status
    from public.purchase_requests where id = new.purchase_request_id;
    if v_request_project is null or v_request_project <> new.project_id then
      raise exception 'Purchase order request must belong to the same project';
    end if;
    if new.status in ('PENDING_APPROVAL','APPROVED','SENT','PARTIALLY_RECEIVED','RECEIVED','CLOSED') and v_request_status not in ('APPROVED','ORDERED','PARTIALLY_RECEIVED','RECEIVED') then
      raise exception 'Purchase order requires an approved purchase request';
    end if;
  elsif new.status in ('PENDING_APPROVAL','APPROVED','SENT','PARTIALLY_RECEIVED','RECEIVED','CLOSED') then
    raise exception 'Released purchasing requires a purchase request';
  end if;

  select status into v_supplier_status from public.suppliers where id = new.supplier_id;
  if new.status in ('PENDING_APPROVAL','APPROVED','SENT') and v_supplier_status <> 'ACTIVE' then
    raise exception 'Purchase order requires an ACTIVE supplier';
  end if;

  if new.status in ('APPROVED','SENT','PARTIALLY_RECEIVED','RECEIVED','CLOSED') then
    select status into v_gate_status
    from public.commercial_release_gates g
    where g.project_id = new.project_id and g.status = 'RELEASED'
      and exists (select 1 from public.quotations q where q.id = g.quotation_id and q.project_id = new.project_id and q.status = 'ACCEPTED')
    order by g.updated_at desc limit 1;
    if v_gate_status is null then
      raise exception 'Purchase order release requires a released commercial gate for an accepted quotation';
    end if;
  end if;

  if new.status in ('PENDING_APPROVAL','APPROVED','SENT') then
    if not exists (select 1 from public.purchase_order_items i where i.purchase_order_id = new.id) then
      raise exception 'Purchase order cannot advance without items';
    end if;
    select coalesce(sum(i.quantity * i.unit_price),0), coalesce(sum(i.quantity * i.unit_price * i.tax_rate / 100),0)
      into v_subtotal, v_tax
    from public.purchase_order_items i where i.purchase_order_id = new.id;
    if round(new.subtotal,2) <> round(v_subtotal,2) then raise exception 'Purchase order subtotal does not match its items'; end if;
    if round(new.tax,2) <> round(v_tax,2) then raise exception 'Purchase order tax does not match its items'; end if;
  end if;

  if new.status = 'APPROVED' and (new.approved_by is null or new.approved_at is null) then
    raise exception 'Approved purchase order requires approved_by and approved_at';
  end if;
  if new.order_date is not null and new.expected_date is not null and new.expected_date < new.order_date then
    raise exception 'Purchase order expected date cannot precede order date';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_purchase_order_lineage on public.purchase_orders;
create trigger trg_purchase_order_lineage
before insert or update of project_id, purchase_request_id, supplier_id, status, subtotal, tax, order_date, expected_date, approved_by, approved_at
on public.purchase_orders
for each row execute function public.validate_purchase_order_lineage();

create or replace function public.validate_purchase_order_item_lineage()
returns trigger
language plpgsql
as $$
declare
  v_po_project uuid;
  v_request_project uuid;
  v_request_id uuid;
begin
  select project_id, purchase_request_id into v_po_project, v_request_id from public.purchase_orders where id = new.purchase_order_id;
  if v_po_project is null or v_po_project <> new.project_id then raise exception 'Purchase order item must belong to the same project as its purchase order'; end if;
  if new.purchase_request_item_id is not null then
    select project_id into v_request_project from public.purchase_request_items where id = new.purchase_request_item_id;
    if v_request_project is null or v_request_project <> new.project_id then raise exception 'Purchase order item request item must belong to the same project'; end if;
    if v_request_id is null or not exists (select 1 from public.purchase_request_items pri where pri.id = new.purchase_request_item_id and pri.purchase_request_id = v_request_id) then
      raise exception 'Purchase order item must reference an item from the linked purchase request';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_purchase_order_item_lineage on public.purchase_order_items;
create trigger trg_purchase_order_item_lineage
before insert or update on public.purchase_order_items
for each row execute function public.validate_purchase_order_item_lineage();

create or replace function public.guard_approved_purchase_order()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('APPROVED','SENT','PARTIALLY_RECEIVED','RECEIVED','CLOSED') then
    if new.project_id is distinct from old.project_id or new.supplier_id is distinct from old.supplier_id or new.purchase_request_id is distinct from old.purchase_request_id or new.po_code is distinct from old.po_code or new.currency is distinct from old.currency or new.subtotal is distinct from old.subtotal or new.tax is distinct from old.tax or new.order_date is distinct from old.order_date then
      raise exception 'Approved purchase orders cannot change commercial identity or totals';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_purchase_order_immutability on public.purchase_orders;
create trigger trg_purchase_order_immutability before update on public.purchase_orders for each row execute function public.guard_approved_purchase_order();

create or replace function public.guard_approved_purchase_order_item()
returns trigger
language plpgsql
as $$
declare
  v_status text;
  v_po_id uuid;
begin
  v_po_id := coalesce(new.purchase_order_id, old.purchase_order_id);
  select status into v_status from public.purchase_orders where id = v_po_id;
  if v_status in ('APPROVED','SENT','PARTIALLY_RECEIVED','RECEIVED','CLOSED') then
    raise exception 'Purchase order items cannot change after order approval';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_purchase_order_item_immutability on public.purchase_order_items;
create trigger trg_purchase_order_item_immutability before insert or update or delete on public.purchase_order_items for each row execute function public.guard_approved_purchase_order_item();

create index if not exists purchase_orders_request_status_idx on public.purchase_orders(purchase_request_id, status);
create index if not exists purchase_request_items_project_bom_idx on public.purchase_request_items(project_id, bom_item_id);
