-- MILLIMETRE Stage 17: Labels / QR
create table if not exists public.production_labels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  production_order_id uuid not null references public.production_orders(id) on delete restrict,
  production_piece_id uuid references public.production_pieces(id) on delete restrict,
  label_code text not null unique,
  label_type text not null default 'PIECE' check (label_type in ('PIECE','BOX','BUNDLE','PRODUCT','SHIPMENT')),
  qr_payload text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','VOID','REPRINTED')),
  print_count integer not null default 0 check (print_count >= 0),
  last_printed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists production_labels_project_idx on public.production_labels(project_id);
create index if not exists production_labels_order_idx on public.production_labels(production_order_id);
create index if not exists production_labels_piece_idx on public.production_labels(production_piece_id);

create table if not exists public.label_print_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  label_id uuid not null references public.production_labels(id) on delete restrict,
  job_code text not null unique,
  quantity integer not null default 1 check (quantity > 0),
  status text not null default 'QUEUED' check (status in ('QUEUED','PRINTED','FAILED','CANCELLED')),
  printer_name text,
  printed_by uuid,
  printed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists label_print_jobs_label_idx on public.label_print_jobs(label_id);

create or replace function public.validate_production_label_project()
returns trigger language plpgsql as $$
declare order_project uuid; piece_project uuid;
begin
 select project_id into order_project from public.production_orders where id = new.production_order_id;
 if order_project is null or order_project <> new.project_id then
   raise exception 'Label must belong to the same project as its production order';
 end if;
 if new.production_piece_id is not null then
   select po.project_id into piece_project from public.production_pieces pp join public.production_orders po on po.id=pp.production_order_id where pp.id=new.production_piece_id;
   if piece_project is null or piece_project <> new.project_id then
     raise exception 'Label piece must belong to the same project';
   end if;
 end if;
 return new;
end; $$;
drop trigger if exists production_labels_validate_project on public.production_labels;
create trigger production_labels_validate_project before insert or update on public.production_labels for each row execute function public.validate_production_label_project();

alter table public.production_labels enable row level security;
alter table public.label_print_jobs enable row level security;
drop policy if exists production_labels_authenticated on public.production_labels;
create policy production_labels_authenticated on public.production_labels for all to authenticated using (true) with check (true);
drop policy if exists label_print_jobs_authenticated on public.label_print_jobs;
create policy label_print_jobs_authenticated on public.label_print_jobs for all to authenticated using (true) with check (true);
