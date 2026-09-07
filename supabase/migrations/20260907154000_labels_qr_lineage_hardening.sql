-- MILLIMETRE: Labels / QR lineage hardening
-- Additive migration. Existing label and print work is preserved.

create or replace function public.validate_labels_qr_lineage_v1()
returns trigger
language plpgsql
as $$
declare
  order_project uuid;
  piece_project uuid;
  piece_order uuid;
  piece_exists boolean;
  label_project uuid;
begin
  if tg_table_name = 'production_labels' then
    select project_id into order_project
    from public.production_orders where id = new.production_order_id;
    if order_project is null or order_project <> new.project_id then
      raise exception 'Label production order must belong to the same project';
    end if;

    if new.production_piece_id is not null then
      select po.project_id, pp.production_order_id into piece_project, piece_order
      from public.production_pieces pp
      join public.production_orders po on po.id = pp.production_order_id
      where pp.id = new.production_piece_id;
      if piece_project is null or piece_project <> new.project_id or piece_order <> new.production_order_id then
        raise exception 'Label production piece must belong to the same project and production order';
      end if;
    end if;

  elsif tg_table_name = 'label_print_jobs' then
    select project_id into label_project
    from public.production_labels where id = new.label_id;
    if label_project is null or label_project <> new.project_id then
      raise exception 'Label print job must belong to the label project';
    end if;
    if new.status = 'PRINTED' and new.printed_at is null then
      raise exception 'Printed label job requires printed_at';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists production_labels_validate_lineage_v1 on public.production_labels;
create trigger production_labels_validate_lineage_v1
before insert or update of project_id, production_order_id, production_piece_id
on public.production_labels
for each row execute function public.validate_labels_qr_lineage_v1();

drop trigger if exists label_print_jobs_validate_lineage_v1 on public.label_print_jobs;
create trigger label_print_jobs_validate_lineage_v1
before insert or update of project_id, label_id, status, printed_at
on public.label_print_jobs
for each row execute function public.validate_labels_qr_lineage_v1();

-- Explicit RLS defense for Stage 17 tables.
alter table public.production_labels enable row level security;
alter table public.label_print_jobs enable row level security;
