-- V1 security hardening: make the executive pipeline view honor caller RLS
-- and close the remaining public-table RLS advisor finding.

alter view public.millimetre_project_pipeline
  set (security_invoker = true);

alter table public.cutting_lists enable row level security;

drop policy if exists millimetre_authenticated_all_cutting_lists
  on public.cutting_lists;

create policy millimetre_authenticated_all_cutting_lists
  on public.cutting_lists
  for all
  to authenticated
  using (true)
  with check (true);
