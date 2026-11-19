-- Latest update per project, for the dashboard.
-- security_invoker makes the view apply the caller's row-level security, so
-- private projects' updates stay hidden from non-members.
create view public.project_latest_logs
with (security_invoker = true) as
select distinct on (l.project_id)
  l.project_id,
  l.id as log_id,
  l.body,
  l.created_at,
  l.author_id,
  p.full_name as author_name
from public.progress_logs l
left join public.profiles p on p.id = l.author_id
order by l.project_id, l.created_at desc;

revoke all on public.project_latest_logs from anon, public;
grant select on public.project_latest_logs to authenticated;
