-- Explicitly revoke anon in addition to PUBLIC.
-- Some existing function grants may have been granted directly to anon.

revoke execute on function public.persist_costing_run(uuid, uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, jsonb, jsonb) from anon;
revoke execute on function public.persist_bom_run(uuid, uuid, text, integer, jsonb) from anon;
