-- MILLIMETRE V1: canonical executive dashboard pipeline
-- Replaces the legacy delivery_orders / installation_jobs dashboard source.
-- Additive and non-destructive: existing legacy tables remain untouched.

create or replace view public.millimetre_project_pipeline as
select
  p.id as project_id,
  p.code as project_code,
  p.name as project_name,
  p.status,
  p.current_stage,
  c.name as customer_name,
  count(distinct f.id) as furniture_count,
  count(distinct d.id) as delivery_count,
  count(distinct i.id) as installation_count,
  count(distinct h.id) as handover_count,
  count(distinct s.id) as service_request_count
from public.projects p
left join public.customers c on c.id = p.customer_id
left join public.furniture_items f on f.project_id = p.id
left join public.deliveries d on d.project_id = p.id
left join public.installations i on i.project_id = p.id
left join public.handovers h on h.project_id = p.id
left join public.service_requests s on s.project_id = p.id
group by p.id, p.code, p.name, p.status, p.current_stage, c.name;

comment on view public.millimetre_project_pipeline is
'Canonical V1 project pipeline. Uses deliveries/installations and preserves legacy delivery tables for historical compatibility.';
