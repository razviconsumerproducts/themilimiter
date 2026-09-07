create or replace function public.persist_bom_run(
  p_project_id uuid,
  p_calculation_run_id uuid,
  p_bom_code text,
  p_version integer,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_bom_id uuid;
  v_status text;
  v_item jsonb;
  v_index integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if coalesce(trim(p_bom_code),'') = '' then raise exception 'BOM code is required'; end if;
  if p_version is null or p_version < 1 or p_version <> trunc(p_version) then raise exception 'BOM version must be a positive integer'; end if;

  select status into v_status
  from calculation_runs
  where id = p_calculation_run_id and project_id = p_project_id;
  if not found then raise exception 'Calculation run does not belong to project'; end if;
  if v_status <> 'valid' then raise exception 'BOM requires a valid calculation run'; end if;

  if jsonb_typeof(coalesce(p_items,'[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_items,'[]'::jsonb)) = 0 then
    raise exception 'At least one BOM item is required';
  end if;

  insert into boms(project_id, calculation_run_id, bom_code, version, status)
  values (p_project_id, p_calculation_run_id, p_bom_code, p_version, 'GENERATED')
  returning id into v_bom_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_index := v_index + 1;
    if coalesce(trim(v_item->>'description'),'') = '' then raise exception 'BOM item % description is required', v_index; end if;
    if coalesce(trim(v_item->>'unit'),'') = '' then raise exception 'BOM item % unit is required', v_index; end if;
    if not (v_item->>'quantity') ~ '^[0-9]+(\\.[0-9]+)?$' or (v_item->>'quantity')::numeric < 0 then raise exception 'BOM item % quantity is invalid', v_index; end if;
    if (v_item->>'itemType') not in ('BOARD','LAMINATE','EDGE_BAND','HARDWARE','ACCESSORY','CONSUMABLE','OTHER') then raise exception 'BOM item % type is invalid', v_index; end if;

    insert into bom_items(
      bom_id, project_id, furniture_item_id, item_type, item_id, item_code,
      description, quantity, unit, calculation_basis, source_component_id,
      notes, sort_order
    ) values (
      v_bom_id, p_project_id,
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
      v_index - 1
    );
  end loop;

  return jsonb_build_object('bom_id',v_bom_id,'project_id',p_project_id,'calculation_run_id',p_calculation_run_id,'version',p_version,'status','GENERATED','item_count',v_index);
end;
$$;

grant execute on function public.persist_bom_run(uuid,uuid,text,integer,jsonb) to authenticated;
