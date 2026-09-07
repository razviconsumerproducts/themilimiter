alter table public.materials add column if not exists active boolean not null default true;

create table if not exists public.millimetre_supplier_materials (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.millimetre_suppliers(id) on delete restrict,
  material_id uuid not null references public.materials(id) on delete restrict,
  supplier_material_code text not null,
  manufacturer text,
  specification text,
  thickness_mm numeric check (thickness_mm is null or thickness_mm > 0),
  standard_length_mm numeric check (standard_length_mm is null or standard_length_mm > 0),
  standard_width_mm numeric check (standard_width_mm is null or standard_width_mm > 0),
  uom text not null default 'sheet',
  moq numeric not null default 1 check (moq > 0),
  lead_time_days integer not null default 0 check (lead_time_days >= 0),
  current_quoted_rate numeric not null default 0 check (current_quoted_rate >= 0),
  last_purchase_rate numeric check (last_purchase_rate is null or last_purchase_rate >= 0),
  last_purchase_date date,
  procurement_status text not null default 'ACTIVE' check (procurement_status in ('ACTIVE','INACTIVE')),
  preferred boolean not null default false,
  preferred_scope text not null default 'GLOBAL',
  notes text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (supplier_id, material_id), unique (supplier_id, supplier_material_code)
);
create index if not exists idx_sms_material on public.millimetre_supplier_materials(material_id);
create index if not exists idx_sms_supplier on public.millimetre_supplier_materials(supplier_id);
create index if not exists idx_sms_active on public.millimetre_supplier_materials(material_id, procurement_status);
create unique index if not exists ux_sms_one_preferred_scope on public.millimetre_supplier_materials(material_id, preferred_scope) where preferred = true and procurement_status = 'ACTIVE';
create or replace function public.mm_supplier_material_guard() returns trigger language plpgsql as $$
declare s text; mactive boolean;
begin
  select status into s from public.millimetre_suppliers where id=new.supplier_id;
  if s is null then raise exception 'Supplier does not exist'; end if;
  if new.procurement_status='ACTIVE' and s<>'ACTIVE' then raise exception 'Only ACTIVE suppliers may have ACTIVE material mappings'; end if;
  select active into mactive from public.materials where id=new.material_id;
  if mactive is null then raise exception 'Material does not exist'; end if;
  if new.preferred and new.procurement_status<>'ACTIVE' then raise exception 'Preferred mapping must be ACTIVE'; end if;
  new.updated_at=now(); return new;
end; $$;
drop trigger if exists trg_mm_supplier_material_guard on public.millimetre_supplier_materials;
create trigger trg_mm_supplier_material_guard before insert or update on public.millimetre_supplier_materials for each row execute function public.mm_supplier_material_guard();
alter table public.millimetre_supplier_materials enable row level security;
drop policy if exists supplier_materials_authenticated_select on public.millimetre_supplier_materials;
drop policy if exists supplier_materials_authenticated_insert on public.millimetre_supplier_materials;
drop policy if exists supplier_materials_authenticated_update on public.millimetre_supplier_materials;
create policy supplier_materials_authenticated_select on public.millimetre_supplier_materials for select to authenticated using (true);
create policy supplier_materials_authenticated_insert on public.millimetre_supplier_materials for insert to authenticated with check (true);
create policy supplier_materials_authenticated_update on public.millimetre_supplier_materials for update to authenticated using (true) with check (true);
