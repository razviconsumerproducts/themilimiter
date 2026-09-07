create or replace function public.persist_optimization_run(
  p_project_id uuid,
  p_cutting_list_id uuid,
  p_optimization_code text,
  p_version integer,
  p_algorithm text,
  p_kerf_mm numeric,
  p_trim_allowance_mm numeric,
  p_sheet_count integer,
  p_total_required_area numeric,
  p_total_sheet_area numeric,
  p_waste_area numeric,
  p_utilization_percentage numeric,
  p_sheets jsonb,
  p_placements jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_run_id uuid;
  v_sheet_id uuid;
  v_sheet jsonb;
  v_placement jsonb;
  v_cutting_list_project uuid;
  v_sheet_count integer := 0;
begin
  if p_version < 1 then raise exception 'Optimization version must be positive'; end if;
  if p_kerf_mm < 0 or p_trim_allowance_mm < 0 then raise exception 'Kerf and trim allowance must be non-negative'; end if;

  select project_id into v_cutting_list_project
    from cutting_lists
   where id = p_cutting_list_id
     and status in ('APPROVED','RELEASED');
  if v_cutting_list_project is null or v_cutting_list_project <> p_project_id then
    raise exception 'Cutting list does not belong to the project or is not approved/released';
  end if;

  insert into optimization_runs(
    project_id, cutting_list_id, optimization_code, version, status, algorithm,
    kerf_mm, trim_allowance_mm, sheet_count, total_required_area, total_sheet_area,
    waste_area, utilization_percentage, completed_at
  ) values (
    p_project_id, p_cutting_list_id, p_optimization_code, p_version, 'COMPLETED', p_algorithm,
    p_kerf_mm, p_trim_allowance_mm, p_sheet_count, p_total_required_area, p_total_sheet_area,
    p_waste_area, p_utilization_percentage, now()
  ) returning id into v_run_id;

  for v_sheet in select * from jsonb_array_elements(coalesce(p_sheets,'[]'::jsonb)) loop
    insert into optimization_sheets(
      optimization_run_id, sheet_number, material_id, length_mm, width_mm, thickness_mm,
      grain_direction, used_area, waste_area, utilization_percentage
    ) values (
      v_run_id,
      (v_sheet->>'sheetNumber')::integer,
      (v_sheet->>'materialId')::uuid,
      (v_sheet->>'length')::numeric,
      (v_sheet->>'width')::numeric,
      (v_sheet->>'thickness')::numeric,
      coalesce(v_sheet->>'grainDirection','NONE'),
      coalesce((v_sheet->>'usedArea')::numeric,0),
      coalesce((v_sheet->>'wasteArea')::numeric,0),
      coalesce((v_sheet->>'utilizationPercentage')::numeric,0)
    ) returning id into v_sheet_id;
    v_sheet_count := v_sheet_count + 1;

    for v_placement in select * from jsonb_array_elements(coalesce(v_sheet->'placements','[]'::jsonb)) loop
      insert into optimization_placements(
        optimization_sheet_id, cutting_list_item_id, piece_instance_id,
        x_mm, y_mm, length_mm, width_mm, rotation, grain_orientation
      ) values (
        v_sheet_id,
        (v_placement->>'cuttingListItemId')::uuid,
        v_placement->>'pieceInstanceId',
        (v_placement->>'x')::numeric,
        (v_placement->>'y')::numeric,
        (v_placement->>'length')::numeric,
        (v_placement->>'width')::numeric,
        coalesce((v_placement->>'rotation')::boolean,false),
        coalesce(v_placement->>'grainOrientation','NONE')
      );
    end loop;
  end loop;

  if v_sheet_count <> p_sheet_count then
    raise exception 'Persisted sheet count does not match optimization result';
  end if;

  return jsonb_build_object('optimization_run_id', v_run_id);
end;
$$;

grant execute on function public.persist_optimization_run(uuid,uuid,text,integer,text,numeric,numeric,integer,numeric,numeric,numeric,numeric,jsonb,jsonb) to authenticated;
