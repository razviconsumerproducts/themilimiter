create table if not exists public.project_approvals (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete restrict,
  quotation_id uuid not null references public.quotations(id) on delete restrict,
  approval_code text not null unique, status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','REVOKED','SUPERSEDED')),
  approval_type text not null default 'CUSTOMER_APPROVAL' check (approval_type in ('CUSTOMER_APPROVAL','INTERNAL_APPROVAL','COMMERCIAL_APPROVAL')),
  approved_amount numeric(14,2), approved_by uuid, approved_at timestamptz, approval_method text, reference text, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.payment_schedules (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete restrict,
  quotation_id uuid not null references public.quotations(id) on delete restrict,
  schedule_code text not null unique, sequence_no integer not null check (sequence_no > 0), milestone text not null,
  description text, percentage numeric(7,3) not null default 0 check (percentage >= 0 and percentage <= 100),
  amount numeric(14,2) not null default 0 check (amount >= 0), due_date date,
  status text not null default 'PENDING' check (status in ('PENDING','DUE','PARTIALLY_PAID','PAID','WAIVED','CANCELLED')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(quotation_id, sequence_no)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete restrict,
  quotation_id uuid not null references public.quotations(id) on delete restrict,
  payment_schedule_id uuid references public.payment_schedules(id) on delete set null,
  payment_code text not null unique, payment_date date not null default current_date,
  amount numeric(14,2) not null check (amount > 0), currency text not null default 'INR',
  payment_method text not null check (payment_method in ('BANK_TRANSFER','UPI','CARD','CASH','CHEQUE','OTHER')),
  reference_number text, status text not null default 'PENDING' check (status in ('PENDING','RECEIVED','VERIFIED','FAILED','REVERSED','REFUNDED')),
  received_by uuid, verified_by uuid, verified_at timestamptz, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(), payment_id uuid not null references public.payments(id) on delete cascade,
  payment_schedule_id uuid not null references public.payment_schedules(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0), created_at timestamptz not null default now(), unique(payment_id, payment_schedule_id)
);

create table if not exists public.commercial_release_gates (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete restrict,
  quotation_id uuid not null references public.quotations(id) on delete restrict,
  status text not null default 'NOT_READY' check (status in ('NOT_READY','READY','RELEASED','BLOCKED','REVOKED')),
  required_approval boolean not null default true, approval_satisfied boolean not null default false,
  required_advance numeric(14,2) not null default 0, verified_advance numeric(14,2) not null default 0,
  gate_snapshot jsonb not null default '{}'::jsonb, released_by uuid, released_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(quotation_id)
);

create index if not exists project_approvals_project_idx on public.project_approvals(project_id);
create index if not exists payment_schedules_project_idx on public.payment_schedules(project_id);
create index if not exists payments_project_idx on public.payments(project_id);
create index if not exists payments_schedule_idx on public.payments(payment_schedule_id);
create index if not exists payment_allocations_schedule_idx on public.payment_allocations(payment_schedule_id);
create index if not exists commercial_release_project_idx on public.commercial_release_gates(project_id);

alter table public.project_approvals enable row level security;
alter table public.payment_schedules enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.commercial_release_gates enable row level security;

create policy "authenticated access project approvals" on public.project_approvals for all to authenticated using (true) with check (true);
create policy "authenticated access payment schedules" on public.payment_schedules for all to authenticated using (true) with check (true);
create policy "authenticated access payments" on public.payments for all to authenticated using (true) with check (true);
create policy "authenticated access payment allocations" on public.payment_allocations for all to authenticated using (true) with check (true);
create policy "authenticated access commercial release gates" on public.commercial_release_gates for all to authenticated using (true) with check (true);
