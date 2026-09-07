create or replace function public.persist_costing_run(
  p_project_id uuid,
  p_bom_id uuid,
  p_optimization_run_id uuid,
  p_costing_code text,
  p_version integer,
  p_currency text,
  p_subtotal numeric,
  p_discount numeric,
  p_tax numeric,
  p_margin numeric,
  p_selling_price numeric,
  p_input_snapshot jsonb,
  p_output_snapshot jsonb,
  p_items jsonb
)
returns public.costing_runs
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_run public.costing_runs;
  v_item jsonb;
begin
  if p_project_id is null then raise exception 'Project is required'; end if;
  if p_bom_id is null then raise exception 'BOM is required'; end if;
  if p_optimization_run_id is null then raise exception 'Approved optimization run is required'; end if;
  if p_version is null or p_version < 1 then raise exception 'Costing version must be positive'; end if;
  if coalesce(p_currency, '') = '' then raise exception 'Currency is required'; end if;
  if p_subtotal < 0 or p_discount < 0 or p_tax < 0 or p_margin < 0 or p_selling_price < 0 then
    raise exception 'Costing monetary values cannot be negative';
  end if;

  if not exists (
    select 1 from public.boms b
    where b.id = p_bom_id and b.project_id = p_project_id and b.status in ('APPROVED','RELEASED')
  ) then
    raise exception 'Costing requires an approved or released BOM belonging to the same project';
  end if;

  if not exists (
    select 1
    from public.optimization_runs o
    join public.cutting_lists cl on cl.id = o.cutting_list_id
    join public.boms b on b.id = p_bom_id
    where o.id = p_optimization_run_id
      and o.project_id = p_project_id
      and o.status = 'APPROVED'
      and cl.project_id = p_project_id
      and cl.status in ('APPROVED','RELEASED')
      and b.project_id = p_project_id
      and b.calculation_run_id = cl.calculation_run_id
  ) then
    raise exception 'Costing requires an approved optimization run aligned to the same project, cutting list and calculation lineage';
  end if;

  if exists (
    select 1 from public.costing_runs
    where costing_code = p_costing_code
  ) then
    raise exception 'Costing code already exists';
  end if;

  insert into public.costing_runs (
    project_id, bom_id, optimization_run_id, costing_code, version, status, currency,
    subtotal, discount, tax, margin, selling_price, input_snapshot, output_snapshot
  ) values (
    p_project_id, p_bom_id, p_optimization_run_id, p_costing_code, p_version, 'CALCULATED', p_currency,
    p_subtotal, p_discount, p_tax, p_margin, p_selling_price,
    coalesce(p_input_snapshot, '{}'::jsonb), coalesce(p_output_snapshot, '{}'::jsonb)
  ) returning * into v_run;

  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    insert into public.costing_items (
      costing_run_id, project_id, category, source_type, source_id, item_code,
      description, quantity, unit, unit_cost, wastage_quantity, calculation_basis, notes
    ) values (
      v_run.id,
      p_project_id,
      v_item->>'category',
      v_item->>'sourceType',
      nullif(v_item->>'sourceId','')::uuid,
      nullif(v_item->>'itemCode',''),
      v_item->>'description',
      (v_item->>'quantity')::numeric,
      v_item->>'unit',
      (v_item->>'unitCost')::numeric,
      coalesce((v_item->>'wastageQuantity')::numeric, 0),
      nullif(v_item->>'calculationBasis',''),
      nullif(v_item->>'notes','')
    );
  end loop;

  if not exists (select 1 from public.costing_items where costing_run_id = v_run.id) then
    raise exception 'At least one costing item is required';
  end if;

  return v_run;
exception
  when unique_violation then
    raise exception 'Costing code/version already exists';
end;
$$;

grant execute on function public.persist_costing_run(uuid, uuid, uuid, text, integer, text, numeric, numeric, numeric, numeric, numeric, jsonb, jsonb, jsonb) to authenticated;
