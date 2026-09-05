-- MILLIMETRE Stage 19: Handover integrity hardening
-- Existing handover schema is preserved; this migration adds safety constraints only.

alter table public.handover_checklist_items
  drop constraint if exists handover_checklist_result_check;
alter table public.handover_checklist_items
  add constraint handover_checklist_result_check
  check (result in ('pending','pass','fail','na'));

alter table public.handover_snags
  drop constraint if exists handover_snag_status_check;
alter table public.handover_snags
  add constraint handover_snag_status_check
  check (status in ('open','in_progress','resolved','closed','cancelled'));

create index if not exists handover_checklist_handover_idx on public.handover_checklist_items(handover_id);
create index if not exists handover_snags_handover_status_idx on public.handover_snags(handover_id,status);

create or replace function public.validate_handover_acceptance()
returns trigger
language plpgsql
as $$
declare
  failed_required integer;
  pending_required integer;
  open_snags integer;
begin
  if new.customer_acceptance_status = 'accepted' then
    select count(*) into failed_required
    from public.handover_checklist_items
    where handover_id = new.id and required = true and result = 'fail';

    select count(*) into pending_required
    from public.handover_checklist_items
    where handover_id = new.id and required = true and result = 'pending';

    select count(*) into open_snags
    from public.handover_snags
    where handover_id = new.id and status in ('open','in_progress');

    if failed_required > 0 or pending_required > 0 then
      raise exception 'Handover cannot be accepted while required checklist items are failed or pending';
    end if;
    if open_snags > 0 then
      raise exception 'Handover cannot be accepted while open snags remain';
    end if;
    if new.accepted_at is null then
      raise exception 'Accepted handover requires accepted_at';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists handovers_validate_acceptance on public.handovers;
create trigger handovers_validate_acceptance
before insert or update on public.handovers
for each row execute function public.validate_handover_acceptance();

create or replace function public.validate_handover_snag_project()
returns trigger
language plpgsql
as $$
declare handover_project uuid;
begin
  select project_id into handover_project from public.handovers where id = new.handover_id;
  if handover_project is null or handover_project <> new.project_id then
    raise exception 'Handover snag must belong to the same project as its handover';
  end if;
  return new;
end;
$$;

drop trigger if exists handover_snags_validate_project on public.handover_snags;
create trigger handover_snags_validate_project
before insert or update on public.handover_snags
for each row execute function public.validate_handover_snag_project();
