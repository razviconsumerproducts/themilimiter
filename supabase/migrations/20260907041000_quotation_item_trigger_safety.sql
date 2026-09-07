-- PostgreSQL trigger functions must return OLD for DELETE and NEW otherwise.
create or replace function public.prevent_accepted_quotation_item_mutation()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select q.status into v_status
  from public.quotations q
  where q.id = case when tg_op = 'DELETE' then old.quotation_id else new.quotation_id end;

  if v_status = 'ACCEPTED' then
    raise exception 'Accepted quotation items are immutable; create a new quotation version instead';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
