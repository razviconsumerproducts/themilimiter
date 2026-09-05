create or replace function public.persist_calculation_run(
  p_project_id uuid,
  p_furniture_item_id uuid,
  p_engine_version text,
  p_input_snapshot jsonb,
  p_result jsonb,
  p_status text,
  p_warnings jsonb,
  p_errors jsonb,
  p_calculated_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_run_id uuid;
  v_cutting_list_id uuid;
  v_version integer;
  v_code text;
begin
  if p_status not in ('valid','invalid','superseded') then
    raise exception 'Invalid calculation status: %', p_status;
  end if;

  insert into calculation_runs(
    project_id, furniture_item_id, engine_version, calculation_version,
    input_snapshot, result, output_snapshot, warnings, errors, status,
    calculated_at, calculated_by
  )
  values(
    p_project_id, p_furniture_item_id, p_engine_version, p_engine_version,
    p_input_snapshot, coalesce(p_result,'{}'::jsonb), p_result,
    coalesce(p_warnings,'[]'::jsonb), coalesce(p_errors,'[]'::jsonb), p_status,
    p_calculated_at, auth.uid()
  )
  returning id into v_run_id;

  if p_status = 'valid' then
    select coalesce(max(version),0) + 1
      into v_version
      from cutting_lists
     where project_id = p_project_id;

    v_code := 'CL-' || to_char(now(),'YYYY') || '-' ||
      upper(substr(replace(p_project_id::text,'-',''),1,8)) || '-V' || v_version;

    insert into cutting_lists(project_id, calculation_run_id, cutting_list_code, version, status)
    values(p_project_id, v_run_id, v_code, v_version, 'GENERATED')
    returning id into v_cutting_list_id;

    insert into cutting_list_items(
      calculation_run_id, project_id, furniture_item_id, sequence_no, piece_code,
      part_name, material_id, length_mm, width_mm, thickness_mm, quantity,
      edge_banding, metadata, grain_direction, edge_top, edge_bottom,
      edge_left, edge_right, cutting_allowance
    )
    select
      v_run_id,
      p_project_id,
      p_furniture_item_id,
      row_number() over (order by x->>'name', x->>'length', x->>'width'),
      coalesce(nullif(x->>'pieceCode',''), 'P-' || row_number() over (order by x->>'name', x->>'length', x->>'width')),
      coalesce(x->>'name','Part'),
      nullif(x->>'materialId','')::uuid,
      (x->>'length')::numeric,
      (x->>'width')::numeric,
      (x->>'thickness')::numeric,
      (x->>'qty')::integer,
      jsonb_build_object('edge',coalesce(x->>'edge','none'),'edgeBandMm',x->'edgeBandMm'),
      jsonb_build_object('areaSqM',x->'areaSqM','edgeLengthM',x->'edgeLengthM','notes',x->'notes'),
      case when coalesce((x->>'grain')::boolean,false) then 'REQUIRED' else 'NONE' end,
      case when x->>'edge' in ('front','all') then 'EDGE' else 'NONE' end,
      case when x->>'edge'='all' then 'EDGE' else 'NONE' end,
      case when x->>'edge' in ('left','all') then 'EDGE' else 'NONE' end,
      case when x->>'edge' in ('right','all') then 'EDGE' else 'NONE' end,
      0
    from jsonb_array_elements(coalesce(p_result->'parts','[]'::jsonb)) x;
  end if;

  return jsonb_build_object(
    'calculation_run_id', v_run_id,
    'cutting_list_id', v_cutting_list_id,
    'version', v_version
  );
end;
$$;

grant execute on function public.persist_calculation_run(uuid,uuid,text,jsonb,jsonb,text,jsonb,jsonb,timestamptz) to authenticated;
