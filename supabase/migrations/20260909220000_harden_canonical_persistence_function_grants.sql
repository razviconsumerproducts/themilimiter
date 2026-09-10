-- Keep canonical persistence RPCs server-side/authenticated only.
-- SECURITY DEFINER functions in public must not remain callable by anon/PUBLIC.

revoke all on function public.persist_costing_run(uuid, uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, jsonb, jsonb) from public;
grant execute on function public.persist_costing_run(uuid, uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, jsonb, jsonb) to authenticated;

revoke all on function public.persist_bom_run(uuid, uuid, text, integer, jsonb) from public;
grant execute on function public.persist_bom_run(uuid, uuid, text, integer, jsonb) to authenticated;
