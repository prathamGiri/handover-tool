-- Handover: team progress tracker
-- Core schema + row-level security.
--
-- Access model
--   * A user belongs to one or more teams (team_members).
--   * Public projects: every team member can see them and post logs.
--   * Private projects: only the creator, the owner and users listed in
--     project_members can see them or post logs.
--   * Log timestamps are always set by the database, never by the client.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '' check (char_length(full_name) <= 80),
  avatar_url  text,
  created_at  timestamptz not null default now()
);

create table public.teams (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 80),
  invite_code  text not null unique
                 default encode(extensions.gen_random_bytes(6), 'hex'),
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create table public.team_members (
  team_id    uuid not null references public.teams (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       text not null default 'member' check (role in ('admin', 'member')),
  joined_at  timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index team_members_user_idx on public.team_members (user_id);

create type public.project_status as enum ('on_track', 'at_risk', 'blocked', 'done');

create table public.projects (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 120),
  description  text not null default '' check (char_length(description) <= 2000),
  owner_id     uuid references public.profiles (id) on delete set null,
  status       public.project_status not null default 'on_track',
  progress     smallint not null default 0 check (progress between 0 and 100),
  target_date  date,
  is_private   boolean not null default false,
  created_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  last_log_at  timestamptz
);
create index projects_team_idx on public.projects (team_id);

create table public.project_members (
  project_id  uuid not null references public.projects (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index project_members_user_idx on public.project_members (user_id);

create table public.progress_logs (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  author_id   uuid references public.profiles (id) on delete set null default auth.uid(),
  body        text not null check (char_length(body) between 1 and 5000),
  -- Optional status / progress set together with this update.
  status      public.project_status,
  progress    smallint check (progress between 0 and 100),
  created_at  timestamptz not null default now(),
  edited_at   timestamptz
);
create index progress_logs_project_idx on public.progress_logs (project_id, created_at desc);

create table public.log_photos (
  id            uuid primary key default gen_random_uuid(),
  log_id        uuid not null references public.progress_logs (id) on delete cascade,
  storage_path  text not null unique,
  width         int,
  height        int,
  created_at    timestamptz not null default now()
);
create index log_photos_log_idx on public.log_photos (log_id);

-- ---------------------------------------------------------------------------
-- Access helpers (security definer so policies don't recurse through RLS)
-- ---------------------------------------------------------------------------

create or replace function public.is_team_member(p_team uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team and user_id = auth.uid()
  );
$$;

create or replace function public.is_team_admin(p_team uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team and user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.can_view_project(p_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.projects p
    join public.team_members tm
      on tm.team_id = p.team_id and tm.user_id = auth.uid()
    where p.id = p_project
      and (
        not p.is_private
        or p.created_by = auth.uid()
        or p.owner_id = auth.uid()
        or exists (
          select 1 from public.project_members pm
          where pm.project_id = p.id and pm.user_id = auth.uid()
        )
      )
  );
$$;

-- Who may change a project's settings / private member list.
create or replace function public.can_manage_project(p_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.projects p
    where p.id = p_project
      and public.is_team_member(p.team_id)
      and (
        p.created_by = auth.uid()
        or p.owner_id = auth.uid()
        or public.is_team_admin(p.team_id)
      )
  );
$$;

create or replace function public.shares_team_with(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.team_members a
    join public.team_members b on a.team_id = b.team_id
    where a.user_id = auth.uid() and b.user_id = p_user
  );
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Create a profile for every new auth user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.touch_updated_at();

-- Logs: server-controlled timestamps and authorship.
create or replace function public.guard_progress_log()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.edited_at  := null;
    new.author_id  := auth.uid();
  else
    new.id          := old.id;
    new.project_id  := old.project_id;
    new.author_id   := old.author_id;
    new.created_at  := old.created_at;
    new.status      := old.status;
    new.progress    := old.progress;
    if new.body is distinct from old.body then
      new.edited_at := now();
    else
      new.edited_at := old.edited_at;
    end if;
  end if;
  return new;
end;
$$;

create trigger progress_logs_guard
  before insert or update on public.progress_logs
  for each row execute function public.guard_progress_log();

-- A new log bumps the project's last activity and applies status/progress.
create or replace function public.apply_progress_log()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.projects
  set last_log_at = new.created_at,
      status      = coalesce(new.status, status),
      progress    = coalesce(new.progress, progress)
  where id = new.project_id;
  return new;
end;
$$;

create trigger progress_logs_apply
  after insert on public.progress_logs
  for each row execute function public.apply_progress_log();

-- Projects: team and creator can't be reassigned by a client.
create or replace function public.guard_project()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
    new.last_log_at := null;
  else
    new.team_id    := old.team_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

create trigger projects_guard
  before insert or update on public.projects
  for each row execute function public.guard_project();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_team(p_name text)
returns public.teams language plpgsql security definer set search_path = '' as $$
declare
  t public.teams;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.teams (name, created_by)
  values (trim(p_name), auth.uid())
  returning * into t;
  insert into public.team_members (team_id, user_id, role)
  values (t.id, auth.uid(), 'admin');
  return t;
end;
$$;

create or replace function public.join_team(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_team uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select id into v_team from public.teams where invite_code = lower(trim(p_code));
  if v_team is null then
    raise exception 'invalid invite code';
  end if;
  insert into public.team_members (team_id, user_id)
  values (v_team, auth.uid())
  on conflict do nothing;
  return v_team;
end;
$$;

-- Public preview of an invite (team name only) for the join screen.
create or replace function public.invite_preview(p_code text)
returns text language sql stable security definer set search_path = '' as $$
  select name from public.teams where invite_code = lower(trim(p_code));
$$;

create or replace function public.regenerate_invite_code(p_team uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_code text;
begin
  if not public.is_team_admin(p_team) then
    raise exception 'only admins can reset the invite link';
  end if;
  update public.teams
  set invite_code = encode(extensions.gen_random_bytes(6), 'hex')
  where id = p_team
  returning invite_code into v_code;
  return v_code;
end;
$$;

revoke execute on function public.create_team(text) from public, anon;
revoke execute on function public.join_team(text) from public, anon;
revoke execute on function public.regenerate_invite_code(uuid) from public, anon;
grant execute on function public.create_team(text) to authenticated;
grant execute on function public.join_team(text) to authenticated;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;
grant execute on function public.invite_preview(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.teams           enable row level security;
alter table public.team_members    enable row level security;
alter table public.projects        enable row level security;
alter table public.project_members enable row level security;
alter table public.progress_logs   enable row level security;
alter table public.log_photos      enable row level security;

-- profiles
create policy "profiles: read self and teammates" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_team_with(id));
create policy "profiles: update self" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- teams (created via create_team RPC)
create policy "teams: members read" on public.teams
  for select to authenticated using (public.is_team_member(id));
create policy "teams: admins update" on public.teams
  for update to authenticated
  using (public.is_team_admin(id)) with check (public.is_team_admin(id));

-- team_members (joined via RPCs)
create policy "team_members: members read" on public.team_members
  for select to authenticated using (public.is_team_member(team_id));
create policy "team_members: admins change roles" on public.team_members
  for update to authenticated
  using (public.is_team_admin(team_id)) with check (public.is_team_admin(team_id));
create policy "team_members: admins remove, anyone leaves" on public.team_members
  for delete to authenticated
  using (user_id = auth.uid() or public.is_team_admin(team_id));

-- projects
create policy "projects: visible ones" on public.projects
  for select to authenticated using (public.can_view_project(id));
create policy "projects: members create" on public.projects
  for insert to authenticated
  with check (public.is_team_member(team_id));
-- Status / progress change through a progress log (see apply_progress_log),
-- so every change has a timestamped entry. Settings are for managers.
create policy "projects: managers update" on public.projects
  for update to authenticated
  using (public.can_manage_project(id)) with check (public.is_team_member(team_id));
create policy "projects: managers delete" on public.projects
  for delete to authenticated using (public.can_manage_project(id));

-- project_members
create policy "project_members: viewers read" on public.project_members
  for select to authenticated using (public.can_view_project(project_id));
create policy "project_members: managers add" on public.project_members
  for insert to authenticated
  with check (
    public.can_manage_project(project_id)
    and exists (
      select 1 from public.projects p
      join public.team_members tm on tm.team_id = p.team_id
      where p.id = project_id and tm.user_id = project_members.user_id
    )
  );
create policy "project_members: managers remove" on public.project_members
  for delete to authenticated using (public.can_manage_project(project_id));

-- progress_logs
create policy "logs: viewers read" on public.progress_logs
  for select to authenticated using (public.can_view_project(project_id));
create policy "logs: viewers post" on public.progress_logs
  for insert to authenticated with check (public.can_view_project(project_id));
create policy "logs: authors edit" on public.progress_logs
  for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "logs: authors or admins delete" on public.progress_logs
  for delete to authenticated
  using (
    author_id = auth.uid()
    or exists (
      select 1 from public.projects p
      where p.id = project_id and public.is_team_admin(p.team_id)
    )
  );

-- log_photos
create policy "photos: viewers read" on public.log_photos
  for select to authenticated
  using (exists (
    select 1 from public.progress_logs l
    where l.id = log_id and public.can_view_project(l.project_id)
  ));
create policy "photos: log author adds" on public.log_photos
  for insert to authenticated
  with check (exists (
    select 1 from public.progress_logs l
    where l.id = log_id and l.author_id = auth.uid()
  ));
create policy "photos: log author removes" on public.log_photos
  for delete to authenticated
  using (exists (
    select 1 from public.progress_logs l
    where l.id = log_id and l.author_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- Photo storage
--   Bucket is private. Object path: <project_id>/<log_id>/<file>
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('log-photos', 'log-photos', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create or replace function public.storage_project_id(p_name text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  return (storage.foldername(p_name))[1]::uuid;
exception when others then
  return null;
end;
$$;

create policy "log-photos: viewers read" on storage.objects
  for select to authenticated
  using (bucket_id = 'log-photos'
         and public.can_view_project(public.storage_project_id(name)));
create policy "log-photos: viewers upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'log-photos'
              and public.can_view_project(public.storage_project_id(name)));
create policy "log-photos: uploader deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'log-photos' and owner_id = auth.uid()::text);
