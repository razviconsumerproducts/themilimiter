create or replace function public.persist_bom_run(
  p_project_id uuid,
  p_calculation_run_id uuid,
  p_bom_code text,
  p_version integer,
  p_status text,
  p_items jsonb
)
returns public.boms
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_bom public.boms;
  v_item jsonb;
  v_sort integer := 0;
begin
  if p_status not in ('DRAFT','GENERATED','REVIEW','APPROVED','RELEASED','SUPERSEDED','CANCELLED') then
    raise exception 'Invalid BOM status: %', p_status;
  end if;

  if not exists (
    select 1 from public.calculation_runs cr
    where cr.id = p_calculation_run_id
      and cr.project_id = p_project_id
      and cr.status = 'valid'
  ) then
    raise exception 'Calculation run is not valid or does not belong to project';
  end if;

  if p_version < 1 then
    raise exception 'BOM version must be positive';
  end if;

  insert into public.boms(project_id, calculation_run_id, bom_code, version, status)
  values(p_project_id, p_calculation_run_id, p_bom_code, p_version, p_status)
  returning * into v_bom;

  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    if coalesce(v_item->>'description','') = '' then
      raise exception 'BOM item description is required';
    end if;
    if coalesce(v_item->>'unit','') = '' then
      raise exception 'BOM item unit is required';
    end if;
    if coalesce((v_item->>'quantity')::numeric, -1) < 0 then
      raise exception 'BOM item quantity cannot be negative';
    end if;

    insert into public.bom_items(
      bom_id, project_id, furniture_item_id, item_type, item_id, item_code,
      description, quantity, unit, calculation_basis, source_component_id,
      notes, sort_order
    ) values (
      v_bom.id,
      p_project_id,
      nullif(v_item->>'furnitureItemId','')::uuid,
      v_item->>'itemType',
      nullif(v_item->>'itemId','')::uuid,
      nullif(v_item->>'itemCode',''),
      v_item->>'description',
      (v_item->>'quantity')::numeric,
      v_item->>'unit',
      nullif(v_item->>'calculationBasis',''),
      nullif(v_item->>'sourceComponentId','')::uuid,
      nullif(v_item->>'notes',''),
      v_sort
    );
    v_sort := v_sort + 1;
  end loop;

  return v_bom;
end;
$$;

revoke all on function public.persist_bom_run(uuid,uuid,text,integer,text,jsonb) from public;
grant execute on function public.persist_bom_run(uuid,uuid,text,integer,text,jsonb) to authenticated;
