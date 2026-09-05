-- MILLIMETRE Stage 16: Production QC
-- Additive migration. Existing production tables/work are preserved.

create table if not exists public.production_qc_inspections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  production_order_id uuid not null references public.production_orders(id) on delete restrict,
  production_piece_id uuid not null references public.production_pieces(id) on delete restrict,
  work_order_id uuid references public.work_orders(id) on delete restrict,
  inspection_code text not null unique,
  inspected_quantity numeric(14,3) not null check (inspected_quantity > 0),
  accepted_quantity numeric(14,3) not null default 0 check (accepted_quantity >= 0),
  rework_quantity numeric(14,3) not null default 0 check (rework_quantity >= 0),
  rejected_quantity numeric(14,3) not null default 0 check (rejected_quantity >= 0),
  status text not null default 'PENDING' check (status in ('PENDING','PASS','PARTIAL','REWORK','FAIL','REJECTED')),
  remarks text,
  inspected_by uuid,
  inspected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint production_qc_inspection_allocation_chk
    check (accepted_quantity + rework_quantity + rejected_quantity = inspected_quantity)
);

create table if not exists public.production_qc_defects (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  production_qc_inspection_id uuid not null references public.production_qc_inspections(id) on delete cascade,
  production_piece_id uuid not null references public.production_pieces(id) on delete restrict,
  defect_code text not null,
  severity text not null default 'MEDIUM' check (severity in ('LOW','MEDIUM','HIGH','CRITICAL')),
  quantity numeric(14,3) not null default 0 check (quantity >= 0),
  description text,
  rework_required boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.production_release_gates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  production_order_id uuid not null references public.production_orders(id) on delete restrict,
  status text not null default 'NOT_READY' check (status in ('NOT_READY','READY','RELEASED','BLOCKED','REVOKED')),
  required_quantity numeric(14,3) not null default 0 check (required_quantity >= 0),
  accepted_quantity numeric(14,3) not null default 0 check (accepted_quantity >= 0),
  rework_quantity numeric(14,3) not null default 0 check (rework_quantity >= 0),
  rejected_quantity numeric(14,3) not null default 0 check (rejected_quantity >= 0),
  gate_snapshot jsonb not null default '{}'::jsonb,
  released_by uuid,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (production_order_id)
);

create index if not exists production_qc_inspections_project_idx on public.production_qc_inspections(project_id);
create index if not exists production_qc_inspections_order_idx on public.production_qc_inspections(production_order_id);
create index if not exists production_qc_inspections_piece_idx on public.production_qc_inspections(production_piece_id);
create index if not exists production_qc_defects_inspection_idx on public.production_qc_defects(production_qc_inspection_id);
create index if not exists production_release_gates_project_idx on public.production_release_gates(project_id);
create index if not exists production_release_gates_order_idx on public.production_release_gates(production_order_id);

-- Preserve project consistency across linked production records.
create or replace function public.validate_production_qc_project()
returns trigger
language plpgsql
as $$
declare
  order_project uuid;
  piece_project uuid;
begin
  select project_id into order_project from public.production_orders where id = new.production_order_id;
  select po.project_id into piece_project
  from public.production_pieces pp
  join public.production_orders po on po.id = pp.production_order_id
  where pp.id = new.production_piece_id;

  if order_project is null or piece_project is null or order_project <> new.project_id or piece_project <> new.project_id then
    raise exception 'Production QC records must belong to the same project as the production order and piece';
  end if;

  if new.work_order_id is not null then
    if not exists (
      select 1 from public.work_orders wo
      where wo.id = new.work_order_id and wo.production_order_id = new.production_order_id
    ) then
      raise exception 'Production QC work order must belong to the same production order';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists production_qc_inspections_validate_project on public.production_qc_inspections;
create trigger production_qc_inspections_validate_project
before insert or update on public.production_qc_inspections
for each row execute function public.validate_production_qc_project();

create or replace function public.validate_production_qc_defect_project()
returns trigger
language plpgsql
as $$
declare
  inspection_project uuid;
  inspection_piece uuid;
begin
  select project_id, production_piece_id into inspection_project, inspection_piece
  from public.production_qc_inspections where id = new.production_qc_inspection_id;
  if inspection_project is null or inspection_project <> new.project_id or inspection_piece <> new.production_piece_id then
    raise exception 'Production QC defect must match its inspection project and piece';
  end if;
  return new;
end;
$$;

drop trigger if exists production_qc_defects_validate_project on public.production_qc_defects;
create trigger production_qc_defects_validate_project
before insert or update on public.production_qc_defects
for each row execute function public.validate_production_qc_defect_project();

-- A release gate can only be released when every required quantity is accepted.
create or replace function public.validate_production_release_gate()
returns trigger
language plpgsql
as $$
begin
  if new.accepted_quantity > new.required_quantity then
    raise exception 'Accepted production QC quantity cannot exceed required quantity';
  end if;
  if new.status = 'RELEASED' and new.accepted_quantity < new.required_quantity then
    raise exception 'Production release gate cannot be released before all required quantity is QC accepted';
  end if;
  return new;
end;
$$;

drop trigger if exists production_release_gates_validate on public.production_release_gates;
create trigger production_release_gates_validate
before insert or update on public.production_release_gates
for each row execute function public.validate_production_release_gate();

alter table public.production_qc_inspections enable row level security;
alter table public.production_qc_defects enable row level security;
alter table public.production_release_gates enable row level security;

drop policy if exists production_qc_inspections_authenticated on public.production_qc_inspections;
create policy production_qc_inspections_authenticated on public.production_qc_inspections for all to authenticated using (true) with check (true);
drop policy if exists production_qc_defects_authenticated on public.production_qc_defects;
create policy production_qc_defects_authenticated on public.production_qc_defects for all to authenticated using (true) with check (true);
drop policy if exists production_release_gates_authenticated on public.production_release_gates;
create policy production_release_gates_authenticated on public.production_release_gates for all to authenticated using (true) with check (true);
