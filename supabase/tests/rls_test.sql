-- Access-rule checks. Run against a local database:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql
-- Everything runs in a transaction that is rolled back.
begin;

create or replace function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAIL: %', label; end if;
  raise notice 'ok - %', label;
end $$;

-- Users: alice (admin), bob (member), carol (member), dave (other team)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@x.test', '{"full_name":"Alice"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@x.test',   '{"full_name":"Bob"}'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@x.test', '{"full_name":"Carol"}'),
  ('00000000-0000-0000-0000-00000000000d', 'dave@x.test',  '{"full_name":"Dave"}');

select pg_temp.check((select count(*) from public.profiles) >= 4, 'profiles auto-created');

-- Alice creates the team; Bob and Carol join with the code.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
create temp table t as select * from public.create_team('Product');
grant select on t to authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.join_team((select invite_code from t));
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.join_team((select invite_code from t));

-- Dave has his own team.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.create_team('Other');
select pg_temp.check((select count(*) from public.teams) = 1, 'dave sees only his own team');
select pg_temp.check((select count(*) from public.profiles) = 1, 'dave sees only his own profile');

-- Alice: one public project, one private project shared with Bob.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.projects (id, team_id, name, owner_id, created_at)
values ('10000000-0000-0000-0000-000000000001', (select id from t), 'Website', '00000000-0000-0000-0000-00000000000a', '2000-01-01');
insert into public.projects (id, team_id, name, is_private)
values ('10000000-0000-0000-0000-000000000002', (select id from t), 'Secret', true);
insert into public.project_members (project_id, user_id)
values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select created_at > '2001-01-01' from public.projects where name = 'Website'), 'project created_at set by server');
select pg_temp.check((select count(*) from public.profiles) = 3, 'alice sees her 3 teammates');

-- Bob sees both, Carol only the public one, Dave none.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) from public.projects) = 2, 'bob (private member) sees 2 projects');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check((select count(*) from public.projects) = 1, 'carol sees only the public project');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.check((select count(*) from public.projects) = 0, 'other team sees no projects');

-- Carol posts on the public project with a fake timestamp and author.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into public.progress_logs (project_id, body, status, progress, created_at, author_id)
values ('10000000-0000-0000-0000-000000000001', 'Homepage done', 'at_risk', 60, '2000-01-01', '00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select author_id = '00000000-0000-0000-0000-00000000000c' and created_at > '2001-01-01'
                      from public.progress_logs), 'log author and time forced by server');
select pg_temp.check((select status = 'at_risk' and progress = 60 and last_log_at is not null
                      from public.projects where name = 'Website'), 'log updates project status/progress');

-- Carol cannot post on, or see logs of, the private project.
do $$ begin
  insert into public.progress_logs (project_id, body) values ('10000000-0000-0000-0000-000000000002', 'sneaky');
  raise exception 'FAIL: carol posted on a private project';
exception when insufficient_privilege then raise notice 'ok - carol blocked from private project';
end $$;

-- Carol (not manager) cannot change project settings directly.
update public.projects set is_private = true, progress = 0 where name = 'Website';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select not is_private and progress = 60 from public.projects where name = 'Website'),
                     'non-manager cannot change project settings');

-- Alice cannot edit Carol's log; Carol's edit keeps timestamp and marks edited.
update public.progress_logs set body = 'hacked';
select pg_temp.check((select body = 'Homepage done' from public.progress_logs), 'others cannot edit a log');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
update public.progress_logs set body = 'Homepage done, forms next', created_at = '2000-01-01';
select pg_temp.check((select edited_at is not null and created_at > '2001-01-01' from public.progress_logs),
                     'author edit marks edited, keeps timestamp');

-- Bob can post on the private project he's a member of.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.progress_logs (project_id, body) values ('10000000-0000-0000-0000-000000000002', 'Private update');
select pg_temp.check((select count(*) from public.progress_logs) = 2, 'bob sees logs on both projects');

-- Only admins can reset the invite link.
do $$ begin
  perform public.regenerate_invite_code((select id from public.teams limit 1));
  raise exception 'FAIL: member reset invite';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok - member cannot reset invite link';
end $$;

rollback;
