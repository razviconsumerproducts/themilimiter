create or replace function public.guard_bom_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.status = new.status then return new; end if;

  if not (
    (old.status = 'GENERATED' and new.status = 'REVIEW') or
    (old.status = 'REVIEW' and new.status = 'APPROVED') or
    (old.status = 'APPROVED' and new.status in ('RELEASED','SUPERSEDED')) or
    (old.status = 'RELEASED' and new.status = 'SUPERSEDED')
  ) then
    raise exception 'Invalid BOM lifecycle transition: % -> %', old.status, new.status;
  end if;

  if new.status = 'APPROVED' then
    if new.approved_at is null or new.approved_by is null then
      raise exception 'Approved BOM requires approved_by and approved_at';
    end if;
  end if;

  if new.status = 'RELEASED' then
    if new.released_at is null or new.released_by is null then
      raise exception 'Released BOM requires released_by and released_at';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_boms_lifecycle_guard on public.boms;
create trigger trg_boms_lifecycle_guard
before update of status, approved_by, approved_at, released_by, released_at on public.boms
for each row execute function public.guard_bom_lifecycle();

grant execute on function public.guard_bom_lifecycle() to authenticated;
