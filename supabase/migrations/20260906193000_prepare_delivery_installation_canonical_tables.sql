-- MILLIMETRE migration-order repair.
-- The older 20260906120000 foundation migration created delivery_items and
-- installation_items with legacy schemas. Stage 18 owns different canonical
-- schemas, so reconcile the names BEFORE 20260906194000 runs.
-- Existing legacy data is preserved; nothing is deleted.

do $$
begin
  if to_regclass('public.delivery_items') is not null
     and to_regclass('public.deliveries') is null then
    execute 'alter table public.delivery_items rename to legacy_delivery_items';
  end if;

  if to_regclass('public.installation_items') is not null
     and to_regclass('public.installations') is null then
    execute 'alter table public.installation_items rename to legacy_installation_items';
  end if;
end
$$;

-- Preserve the legacy records under explicit names for future migration/audit work.
create index if not exists legacy_delivery_items_project_idx
  on public.legacy_delivery_items(project_id)
  where to_regclass('public.legacy_delivery_items') is not null;

create index if not exists legacy_installation_items_id_idx
  on public.legacy_installation_items(id)
  where to_regclass('public.legacy_installation_items') is not null;
