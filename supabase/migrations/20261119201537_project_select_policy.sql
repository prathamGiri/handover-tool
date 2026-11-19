-- The projects SELECT policy called can_view_project(id), which looks the row
-- up again by id. During INSERT ... RETURNING the new row isn't visible to
-- that lookup yet, so creating a project and reading it back failed.
-- Check the row's own columns instead.

create or replace function public.is_project_member(p_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project and user_id = auth.uid()
  );
$$;
revoke execute on function public.is_project_member(uuid) from public, anon;
grant execute on function public.is_project_member(uuid) to authenticated;

drop policy "projects: visible ones" on public.projects;
create policy "projects: visible ones" on public.projects
  for select to authenticated
  using (
    public.is_team_member(team_id)
    and (
      not is_private
      or created_by = auth.uid()
      or owner_id = auth.uid()
      or public.is_project_member(id)
    )
  );
