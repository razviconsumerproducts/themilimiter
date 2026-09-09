create or replace function public.persist_optimization_run(
  p_project_id uuid,
  p_calculation_run_id uuid,
  p_algorithm_version text,
  p_sheet_count integer,
  p_panel_count integer,
  p_cut_count integer,
  p_wastage_percent numeric,
  p_result jsonb,
  p_sheets jsonb
)
returns public.millimetre_optimization_runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run public.millimetre_optimization_runs;
  v_sheet jsonb;
  v_index integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if not public.millimetre_user_has_project_access(p_project_id) then
    raise exception 'Project access denied.' using errcode = '42501';
  end if;
  if p_algorithm_version is null or btrim(p_algorithm_version) = '' then
    raise exception 'algorithm version is required.';
  end if;
  if coalesce(p_sheet_count, 0) < 0 or coalesce(p_panel_count, 0) < 0 or coalesce(p_cut_count, 0) < 0 then
    raise exception 'Optimization counts must be non-negative.';
  end if;
  if coalesce(p_wastage_percent, 0) < 0 or coalesce(p_wastage_percent, 0) > 100 then
    raise exception 'wastage percent must be between 0 and 100.';
  end if;
  if jsonb_typeof(coalesce(p_sheets, '[]'::jsonb)) <> 'array' then
    raise exception 'sheets must be a JSON array.';
  end if;
  if p_calculation_run_id is not null and not exists (
    select 1 from public.calculation_runs cr
    where cr.id = p_calculation_run_id and cr.project_id = p_project_id and cr.status = 'valid'
  ) then
    raise exception 'Calculation run must be valid and belong to the project.';
  end if;

  insert into public.millimetre_optimization_runs (
    project_id, calculation_run_id, algorithm_version,
    sheet_count, panel_count, cut_count, wastage_percent, status, result
  ) values (
    p_project_id, p_calculation_run_id, p_algorithm_version,
    coalesce(p_sheet_count, 0), coalesce(p_panel_count, 0), coalesce(p_cut_count, 0),
    coalesce(p_wastage_percent, 0), 'completed', coalesce(p_result, '{}'::jsonb)
  ) returning * into v_run;

  for v_sheet in select value from jsonb_array_elements(coalesce(p_sheets, '[]'::jsonb)) loop
    v_index := v_index + 1;
    insert into public.millimetre_optimization_sheets (
      optimization_run_id, sheet_no, material_id, sheet_length_mm, sheet_width_mm,
      allocated_area_sqm, wastage_percent, panel_count, cut_count, allocation
    ) values (
      v_run.id,
      coalesce((v_sheet->>'sheetNo')::integer, v_index),
      nullif(v_sheet->>'materialId', '')::uuid,
      (v_sheet->>'sheetLengthMm')::numeric,
      (v_sheet->>'sheetWidthMm')::numeric,
      coalesce((v_sheet->>'allocatedAreaSqM')::numeric, 0),
      coalesce((v_sheet->>'wastagePercent')::numeric, 0),
      coalesce((v_sheet->>'panelCount')::integer, 0),
      coalesce((v_sheet->>'cutCount')::integer, 0),
      coalesce(v_sheet->'allocation', '[]'::jsonb)
    );
  end loop;
  return v_run;
end;
$$;

revoke all on function public.persist_optimization_run(uuid, uuid, text, integer, integer, integer, numeric, jsonb, jsonb) from public;
grant execute on function public.persist_optimization_run(uuid, uuid, text, integer, integer, integer, numeric, jsonb, jsonb) to authenticated;
