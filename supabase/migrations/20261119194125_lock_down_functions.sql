-- Supabase grants EXECUTE on new functions to anon and authenticated by
-- default, which exposes them at /rest/v1/rpc/*. Narrow that down.

-- Trigger functions: never called directly (triggers still fire).
revoke execute on function public.handle_new_user()     from public, anon, authenticated;
revoke execute on function public.apply_progress_log()  from public, anon, authenticated;
revoke execute on function public.guard_progress_log()  from public, anon, authenticated;
revoke execute on function public.guard_project()       from public, anon, authenticated;
revoke execute on function public.touch_updated_at()    from public, anon, authenticated;

-- Access helpers: used by row-level security for signed-in users only.
revoke execute on function public.is_team_member(uuid)     from public, anon;
revoke execute on function public.is_team_admin(uuid)      from public, anon;
revoke execute on function public.can_view_project(uuid)   from public, anon;
revoke execute on function public.can_manage_project(uuid) from public, anon;
revoke execute on function public.shares_team_with(uuid)   from public, anon;
revoke execute on function public.storage_project_id(text) from public, anon;
