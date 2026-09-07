-- Stage 13 hardening: POSTED goods receipts atomically create inventory RECEIPT
-- transactions for accepted quantities. Re-running the operation is idempotent.

create or replace function public.post_goods_receipt_to_inventory(
  p_goods_receipt_id uuid,
  p_location_id uuid,
  p_actor uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_receipt public.goods_receipts%rowtype;
  v_item record;
  v_posted numeric := 0;
  v_rows integer := 0;
  v_existing numeric;
  v_delta numeric;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_receipt
  from public.goods_receipts
  where id = p_goods_receipt_id
  for update;

  if not found then
    raise exception 'Goods receipt not found';
  end if;

  if v_receipt.status not in ('QC_COMPLETE','POSTED') then
    raise exception 'Goods receipt must be QC_COMPLETE before inventory posting';
  end if;

  if not exists (
    select 1 from public.inventory_locations
    where id = p_location_id and active = true
  ) then
    raise exception 'Active inventory location is required';
  end if;

  for v_item in
    select gri.*
    from public.goods_receipt_items gri
    where gri.goods_receipt_id = p_goods_receipt_id
    order by gri.id
  loop
    if v_item.accepted_quantity <= 0 then
      continue;
    end if;

    select coalesce(sum(it.quantity), 0)
      into v_existing
    from public.inventory_transactions it
    where it.source_type = 'GOODS_RECEIPT'
      and it.source_id = v_item.id
      and it.transaction_type = 'RECEIPT';

    v_delta := v_item.accepted_quantity - v_existing;
    if v_delta < 0 then
      raise exception 'Existing inventory posting exceeds accepted quantity for receipt item %', v_item.id;
    end if;

    if v_delta > 0 then
      insert into public.inventory_transactions (
        project_id, location_id, item_code, description, quantity, unit,
        transaction_type, source_type, source_id, reference, created_by
      ) values (
        v_item.project_id, p_location_id, v_item.item_code, v_item.description,
        v_delta, v_item.unit, 'RECEIPT', 'GOODS_RECEIPT', v_item.id,
        v_receipt.receipt_code, coalesce(p_actor, auth.uid())
      );
      v_posted := v_posted + v_delta;
      v_rows := v_rows + 1;
    end if;
  end loop;

  if v_receipt.status = 'QC_COMPLETE' then
    update public.goods_receipts
    set status = 'POSTED',
        updated_at = now(),
        received_by = coalesce(received_by, coalesce(p_actor, auth.uid()))
    where id = p_goods_receipt_id;
  end if;

  return jsonb_build_object(
    'goods_receipt_id', p_goods_receipt_id,
    'status', 'POSTED',
    'posted_quantity', v_posted,
    'transaction_rows_created', v_rows,
    'idempotent', v_rows = 0
  );
end;
$$;

revoke all on function public.post_goods_receipt_to_inventory(uuid, uuid, uuid) from public;
grant execute on function public.post_goods_receipt_to_inventory(uuid, uuid, uuid) to authenticated;

comment on function public.post_goods_receipt_to_inventory(uuid, uuid, uuid) is
'Atomically posts only accepted goods-receipt quantities into inventory. Repeated calls do not duplicate stock.';
