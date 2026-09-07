create or replace function public.persist_optimization_run(
  p_project_id uuid,
  p_cutting_list_id uuid,
  p_optimization_code text,
  p_version integer,
  p_status text,
  p_algorithm text,
  p_kerf_mm numeric,
  p_trim_allowance_mm numeric,
  p_sheet_count integer,
  p_total_required_area numeric,
  p_total_sheet_area numeric,
  p_waste_area numeric,
  p_utilization_percentage numeric,
  p_completed_at timestamptz,
  p_sheets jsonb,
  p_placements jsonb
)
returns public.optimization_runs
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_run public.optimization_runs;
  v_sheet jsonb;
  v_sheet_id uuid;
begin
  if not exists (
    select 1 from public.cutting_lists cl
    where cl.id = p_cutting_list_id
      and cl.project_id = p_project_id
      and cl.status in ('APPROVED','RELEASED')
  ) then
    raise exception 'Cutting list is not approved/released or does not belong to project';
  end if;

  insert into public.optimization_runs (
    project_id, cutting_list_id, optimization_code, version, status, algorithm,
    kerf_mm, trim_allowance_mm, sheet_count, total_required_area, total_sheet_area,
    waste_area, utilization_percentage, completed_at
  ) values (
    p_project_id, p_cutting_list_id, p_optimization_code, p_version, p_status, p_algorithm,
    p_kerf_mm, p_trim_allowance_mm, p_sheet_count, p_total_required_area, p_total_sheet_area,
    p_waste_area, p_utilization_percentage, p_completed_at
  ) returning * into v_run;

  for v_sheet in select value from jsonb_array_elements(coalesce(p_sheets, '[]'::jsonb)) loop
    insert into public.optimization_sheets (
      optimization_run_id, sheet_number, material_id, length_mm, width_mm, thickness_mm,
      used_area, waste_area, utilization_percentage
    ) values (
      v_run.id,
      (v_sheet->>'sheetNumber')::integer,
      (v_sheet->>'materialId')::uuid,
      (v_sheet->>'length')::numeric,
      (v_sheet->>'width')::numeric,
      (v_sheet->>'thickness')::numeric,
      coalesce((v_sheet->>'usedArea')::numeric, 0),
      coalesce((v_sheet->>'wasteArea')::numeric, 0),
      coalesce((v_sheet->>'utilizationPercentage')::numeric, 0)
    ) returning id into v_sheet_id;

    insert into public.optimization_placements (
      optimization_sheet_id, cutting_list_item_id, piece_instance_id,
      x_mm, y_mm, length_mm, width_mm, rotation, grain_orientation
    )
    select
      v_sheet_id,
      (p->>'cuttingListItemId')::uuid,
      p->>'pieceInstanceId',
      (p->>'x')::numeric,
      (p->>'y')::numeric,
      (p->>'length')::numeric,
      (p->>'width')::numeric,
      coalesce((p->>'rotation')::boolean, false),
      coalesce(p->>'grainOrientation', 'NONE')
    from jsonb_array_elements(coalesce(v_sheet->'placements', '[]'::jsonb)) p;
  end loop;

  return v_run;
end;
$$;

revoke all on function public.persist_optimization_run(uuid,uuid,text,integer,text,text,numeric,numeric,integer,numeric,numeric,numeric,numeric,timestamptz,jsonb,jsonb) from public;
grant execute on function public.persist_optimization_run(uuid,uuid,text,integer,text,text,numeric,numeric,integer,numeric,numeric,numeric,numeric,timestamptz,jsonb,jsonb) to authenticated;
