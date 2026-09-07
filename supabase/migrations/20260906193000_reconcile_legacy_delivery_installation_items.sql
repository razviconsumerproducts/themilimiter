-- Reconcile the legacy item table names created by the earlier V1 foundation migration.
-- The canonical Stage 18 migration immediately follows this migration and owns
-- delivery_items / installation_items with the production-linked schema.
-- No rows are deleted; renaming preserves existing foreign-key relationships.

do $$
begin
  if to_regclass('public.delivery_items') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema='public' and table_name='delivery_items' and column_name='delivery_order_id'
     )
     and not exists (
       select 1 from information_schema.columns
       where table_schema='public' and table_name='delivery_items' and column_name='delivery_id'
     ) then
    alter table public.delivery_items rename to delivery_items_legacy;
  end if;

  if to_regclass('public.installation_items') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema='public' and table_name='installation_items' and column_name='installation_job_id'
     )
     and not exists (
       select 1 from information_schema.columns
       where table_schema='public' and table_name='installation_items' and column_name='installation_id'
     ) then
    alter table public.installation_items rename to installation_items_legacy;
  end if;
end;
$$;
