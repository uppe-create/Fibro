create or replace function public.get_home_metrics()
returns table (
  registrations_total bigint,
  issued_total bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  has_deleted_at boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'public_validations'
      and column_name = 'deleted_at'
  )
  into has_deleted_at;

  if has_deleted_at then
    return query
      select
        count(*)::bigint as registrations_total,
        count(*) filter (
          where status in ('issued', 'active')
            and deleted_at is null
        )::bigint as issued_total
      from public.public_validations
      where deleted_at is null;
  end if;

  return query
    select
      count(*)::bigint as registrations_total,
      count(*) filter (
        where status in ('issued', 'active')
      )::bigint as issued_total
    from public.public_validations;
end;
$$;

revoke all on function public.get_home_metrics() from public;
grant execute on function public.get_home_metrics() to anon, authenticated;
