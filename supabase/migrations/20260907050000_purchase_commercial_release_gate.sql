-- Stage 12 purchase gate
-- Purchasing may be prepared in DRAFT, but submission/approval of a
-- purchase request and approval/sending of a purchase order require the
-- project's commercial release gate to be RELEASED.

create index if not exists commercial_release_gates_project_status_idx
  on public.commercial_release_gates(project_id, status);

create index if not exists purchase_requests_project_status_idx
  on public.purchase_requests(project_id, status);

create index if not exists purchase_orders_request_status_idx
  on public.purchase_orders(purchase_request_id, status);

create or replace function public.validate_purchase_commercial_gate()
returns trigger
language plpgsql
as $$
declare
  v_gate_status text;
  v_gate_project uuid;
  v_request_project uuid;
begin
  if tg_table_name = 'purchase_requests' then
    if new.project_id is null then
      raise exception 'Purchase request requires a project';
    end if;

    if new.status in ('SUBMITTED','APPROVED','ORDERED','PARTIALLY_RECEIVED','RECEIVED') then
      select crg.project_id, crg.status
        into v_gate_project, v_gate_status
      from public.commercial_release_gates crg
      where crg.project_id = new.project_id
        and crg.status = 'RELEASED'
      order by crg.updated_at desc
      limit 1;

      if v_gate_project is null or v_gate_project <> new.project_id or v_gate_status <> 'RELEASED' then
        raise exception 'Purchase request requires a RELEASED commercial gate';
      end if;
    end if;

    if new.status = 'APPROVED' and (new.approved_by is null or new.approved_at is null) then
      raise exception 'Approved purchase request requires approved_by and approved_at';
    end if;
  elsif tg_table_name = 'purchase_orders' then
    if new.project_id is null then
      raise exception 'Purchase order requires a project';
    end if;

    if new.purchase_request_id is not null then
      select pr.project_id into v_request_project
      from public.purchase_requests pr
      where pr.id = new.purchase_request_id;

      if v_request_project is null or v_request_project <> new.project_id then
        raise exception 'Purchase order request must belong to the same project';
      end if;

      if new.status in ('PENDING_APPROVAL','APPROVED','SENT','PARTIALLY_RECEIVED','RECEIVED','CLOSED') then
        if not exists (
          select 1 from public.purchase_requests pr
          where pr.id = new.purchase_request_id
            and pr.status = 'APPROVED'
        ) then
          raise exception 'Purchase order requires an APPROVED purchase request';
        end if;
      end if;
    elsif new.status in ('PENDING_APPROVAL','APPROVED','SENT','PARTIALLY_RECEIVED','RECEIVED','CLOSED') then
      raise exception 'Purchase order approval requires a purchase request';
    end if;

    if new.status in ('PENDING_APPROVAL','APPROVED','SENT','PARTIALLY_RECEIVED','RECEIVED','CLOSED') then
      select crg.project_id, crg.status
        into v_gate_project, v_gate_status
      from public.commercial_release_gates crg
      where crg.project_id = new.project_id
        and crg.status = 'RELEASED'
      order by crg.updated_at desc
      limit 1;

      if v_gate_project is null or v_gate_project <> new.project_id or v_gate_status <> 'RELEASED' then
        raise exception 'Purchase order requires a RELEASED commercial gate';
      end if;
    end if;

    if new.status = 'APPROVED' and (new.approved_by is null or new.approved_at is null) then
      raise exception 'Approved purchase order requires approved_by and approved_at';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists purchase_requests_commercial_gate on public.purchase_requests;
create trigger purchase_requests_commercial_gate
before insert or update of project_id, status, approved_by, approved_at
on public.purchase_requests
for each row execute function public.validate_purchase_commercial_gate();

drop trigger if exists purchase_orders_commercial_gate on public.purchase_orders;
create trigger purchase_orders_commercial_gate
before insert or update of project_id, purchase_request_id, status, approved_by, approved_at
on public.purchase_orders
for each row execute function public.validate_purchase_commercial_gate();

-- A purchase request item must reference the same request/project lineage.
create or replace function public.validate_purchase_request_item_lineage()
returns trigger
language plpgsql
as $$
declare
  v_project uuid;
begin
  select pr.project_id into v_project
  from public.purchase_requests pr
  where pr.id = new.purchase_request_id;

  if v_project is null or v_project <> new.project_id then
    raise exception 'Purchase request item must belong to the same project as its request';
  end if;

  return new;
end;
$$;

drop trigger if exists purchase_request_items_lineage on public.purchase_request_items;
create trigger purchase_request_items_lineage
before insert or update of purchase_request_id, project_id
on public.purchase_request_items
for each row execute function public.validate_purchase_request_item_lineage();

-- A PO item must reference the same PO/project lineage.
create or replace function public.validate_purchase_order_item_lineage()
returns trigger
language plpgsql
as $$
declare
  v_project uuid;
  v_request_project uuid;
begin
  select po.project_id into v_project
  from public.purchase_orders po
  where po.id = new.purchase_order_id;

  if v_project is null or v_project <> new.project_id then
    raise exception 'Purchase order item must belong to the same project as its order';
  end if;

  if new.purchase_request_item_id is not null then
    select pri.project_id into v_request_project
    from public.purchase_request_items pri
    where pri.id = new.purchase_request_item_id;

    if v_request_project is null or v_request_project <> new.project_id then
      raise exception 'Purchase order item request item must belong to the same project';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists purchase_order_items_lineage on public.purchase_order_items;
create trigger purchase_order_items_lineage
before insert or update of purchase_order_id, project_id, purchase_request_item_id
on public.purchase_order_items
for each row execute function public.validate_purchase_order_item_lineage();
