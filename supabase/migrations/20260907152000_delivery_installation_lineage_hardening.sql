-- MILLIMETRE V1: delivery/install lineage hardening.
-- Additive only; preserves existing delivery/install schema.

create or replace function public.validate_delivery_installation_lineage_v1()
returns trigger
language plpgsql
as $$
declare
  v_project uuid;
  v_production_project uuid;
  v_piece_project uuid;
  v_delivery_project uuid;
  v_installation_project uuid;
begin
  if tg_table_name = 'delivery_items' then
    select project_id into v_project from public.deliveries where id = new.delivery_id;
    if v_project is null or v_project <> new.project_id then
      raise exception 'Delivery item project must match delivery project';
    end if;
    if new.production_order_id is not null then
      select project_id into v_production_project from public.production_orders where id = new.production_order_id;
      if v_production_project is null or v_production_project <> new.project_id then
        raise exception 'Delivery item production order must belong to the same project';
      end if;
    end if;
    if new.production_piece_id is not null then
      select project_id into v_piece_project from public.production_pieces where id = new.production_piece_id;
      if v_piece_project is null or v_piece_project <> new.project_id then
        raise exception 'Delivery item production piece must belong to the same project';
      end if;
    end if;
  elsif tg_table_name = 'installations' then
    if new.delivery_id is not null then
      select project_id into v_delivery_project from public.deliveries where id = new.delivery_id;
      if v_delivery_project is null or v_delivery_project <> new.project_id then
        raise exception 'Installation delivery must belong to the same project';
      end if;
    end if;
  elsif tg_table_name = 'installation_items' then
    select project_id into v_installation_project from public.installations where id = new.installation_id;
    if v_installation_project is null or v_installation_project <> new.project_id then
      raise exception 'Installation item project must match installation project';
    end if;
    if new.delivery_item_id is not null then
      select project_id into v_delivery_project from public.delivery_items where id = new.delivery_item_id;
      if v_delivery_project is null or v_delivery_project <> new.project_id then
        raise exception 'Installation item delivery item must belong to the same project';
      end if;
    end if;
  elsif tg_table_name = 'installation_signoffs' then
    select project_id into v_installation_project from public.installations where id = new.installation_id;
    if v_installation_project is null or v_installation_project <> new.project_id then
      raise exception 'Installation signoff project must match installation project';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists delivery_items_lineage_guard_v1 on public.delivery_items;
create trigger delivery_items_lineage_guard_v1 before insert or update of project_id, delivery_id, production_order_id, production_piece_id on public.delivery_items for each row execute function public.validate_delivery_installation_lineage_v1();

drop trigger if exists installations_lineage_guard_v1 on public.installations;
create trigger installations_lineage_guard_v1 before insert or update of project_id, delivery_id on public.installations for each row execute function public.validate_delivery_installation_lineage_v1();

drop trigger if exists installation_items_lineage_guard_v1 on public.installation_items;
create trigger installation_items_lineage_guard_v1 before insert or update of project_id, installation_id, delivery_item_id on public.installation_items for each row execute function public.validate_delivery_installation_lineage_v1();

drop trigger if exists installation_signoffs_lineage_guard_v1 on public.installation_signoffs;
create trigger installation_signoffs_lineage_guard_v1 before insert or update of project_id, installation_id on public.installation_signoffs for each row execute function public.validate_delivery_installation_lineage_v1();

-- Explicitly keep RLS enabled on the canonical Stage 18 tables.
alter table public.deliveries enable row level security;
alter table public.delivery_items enable row level security;
alter table public.installations enable row level security;
alter table public.installation_items enable row level security;
alter table public.installation_signoffs enable row level security;
