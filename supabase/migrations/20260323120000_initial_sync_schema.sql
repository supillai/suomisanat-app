-- Baseline migration for the optional Supabase sync backend.
-- This matches the already-applied schema for existing projects.

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_goal integer not null default 20 check (daily_goal > 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id integer not null,
  seen integer not null default 0 check (seen >= 0),
  correct integer not null default 0 check (correct >= 0),
  wrong integer not null default 0 check (wrong >= 0),
  known boolean not null default false,
  needs_practice boolean not null default false,
  last_reviewed date,
  updated_at timestamptz not null default now(),
  primary key (user_id, word_id),
  check (not (known and needs_practice))
);

alter table public.user_settings enable row level security;
alter table public.user_progress enable row level security;

drop policy if exists "settings own rows" on public.user_settings;
create policy "settings own rows"
on public.user_settings
for all
to authenticated
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "progress own rows" on public.user_progress;
create policy "progress own rows"
on public.user_progress
for all
to authenticated
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

create index if not exists user_progress_user_id_updated_at_idx
on public.user_progress (user_id, updated_at desc);

create or replace function public.pull_user_sync_state()
returns jsonb
language plpgsql
security invoker
set search_path = public
stable
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  return jsonb_build_object(
    'settings',
    (
      select to_jsonb(settings_row)
      from (
        select daily_goal, updated_at
        from public.user_settings
        where user_id = current_user_id
      ) as settings_row
    ),
    'progress',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'word_id', progress_row.word_id,
            'seen', progress_row.seen,
            'correct', progress_row.correct,
            'wrong', progress_row.wrong,
            'known', progress_row.known,
            'needs_practice', progress_row.needs_practice,
            'last_reviewed', progress_row.last_reviewed,
            'updated_at', progress_row.updated_at
          )
          order by progress_row.word_id
        )
        from public.user_progress as progress_row
        where progress_row.user_id = current_user_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.push_user_sync_batch(
  progress_rows jsonb default '[]'::jsonb,
  settings_row jsonb default null,
  deleted_word_ids integer[] default '{}'::integer[]
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  sync_timestamp timestamptz := now();
  incoming_progress_count integer := 0;
  accepted_progress_count integer := 0;
  deleted_count integer := 0;
  settings_applied boolean := false;
  settings_stale boolean := false;
  next_daily_goal integer;
  next_settings_updated_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if jsonb_typeof(coalesce(progress_rows, '[]'::jsonb)) <> 'array' then
    raise exception 'progress_rows must be a JSON array';
  end if;

  if settings_row is not null and jsonb_typeof(settings_row) <> 'object' then
    raise exception 'settings_row must be a JSON object';
  end if;

  with incoming as (
    select
      payload.word_id
    from jsonb_to_recordset(coalesce(progress_rows, '[]'::jsonb)) as payload(
      word_id integer,
      seen integer,
      correct integer,
      wrong integer,
      known boolean,
      needs_practice boolean,
      last_reviewed date,
      updated_at timestamptz
    )
    where payload.word_id is not null
  )
  select count(*)::integer
  into incoming_progress_count
  from incoming;

  with incoming as (
    select
      current_user_id as user_id,
      payload.word_id,
      greatest(coalesce(payload.seen, 0), 0) as seen,
      greatest(coalesce(payload.correct, 0), 0) as correct,
      greatest(coalesce(payload.wrong, 0), 0) as wrong,
      coalesce(payload.known, false) as known,
      case
        when coalesce(payload.known, false) then false
        else coalesce(payload.needs_practice, false)
      end as needs_practice,
      payload.last_reviewed,
      coalesce(payload.updated_at, sync_timestamp) as updated_at
    from jsonb_to_recordset(coalesce(progress_rows, '[]'::jsonb)) as payload(
      word_id integer,
      seen integer,
      correct integer,
      wrong integer,
      known boolean,
      needs_practice boolean,
      last_reviewed date,
      updated_at timestamptz
    )
    where payload.word_id is not null
  ),
  upserted as (
    insert into public.user_progress (
      user_id,
      word_id,
      seen,
      correct,
      wrong,
      known,
      needs_practice,
      last_reviewed,
      updated_at
    )
    select
      incoming.user_id,
      incoming.word_id,
      incoming.seen,
      incoming.correct,
      incoming.wrong,
      incoming.known,
      incoming.needs_practice,
      incoming.last_reviewed,
      incoming.updated_at
    from incoming
    on conflict (user_id, word_id) do update
    set
      seen = excluded.seen,
      correct = excluded.correct,
      wrong = excluded.wrong,
      known = excluded.known,
      needs_practice = excluded.needs_practice,
      last_reviewed = excluded.last_reviewed,
      updated_at = excluded.updated_at
    where excluded.updated_at >= public.user_progress.updated_at
    returning 1
  )
  select count(*)::integer
  into accepted_progress_count
  from upserted;

  if coalesce(array_length(deleted_word_ids, 1), 0) > 0 then
    delete from public.user_progress
    where user_id = current_user_id
      and word_id = any(deleted_word_ids);

    get diagnostics deleted_count = row_count;
  end if;

  if settings_row is not null then
    select
      greatest(1, round(coalesce((settings_row ->> 'daily_goal')::numeric, 1))::integer),
      coalesce((settings_row ->> 'updated_at')::timestamptz, sync_timestamp)
    into next_daily_goal, next_settings_updated_at;

    insert into public.user_settings (user_id, daily_goal, updated_at)
    values (current_user_id, next_daily_goal, next_settings_updated_at)
    on conflict (user_id) do update
    set
      daily_goal = excluded.daily_goal,
      updated_at = excluded.updated_at
    where excluded.updated_at >= public.user_settings.updated_at;

    settings_applied := found;
    settings_stale := settings_row is not null and not settings_applied;
  end if;

  return jsonb_build_object(
    'progress_accepted_count', accepted_progress_count,
    'progress_stale_count', greatest(incoming_progress_count - accepted_progress_count, 0),
    'settings_applied', settings_applied,
    'settings_stale', settings_stale,
    'deleted_count', deleted_count,
    'synced_at', sync_timestamp
  );
end;
$$;

create or replace function public.overwrite_user_sync_snapshot(
  progress_rows jsonb default '[]'::jsonb,
  settings_row jsonb default null,
  deleted_word_ids integer[] default '{}'::integer[]
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  sync_timestamp timestamptz := now();
  upserted_progress_count integer := 0;
  deleted_count integer := 0;
  settings_applied boolean := false;
  next_daily_goal integer;
  next_settings_updated_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if jsonb_typeof(coalesce(progress_rows, '[]'::jsonb)) <> 'array' then
    raise exception 'progress_rows must be a JSON array';
  end if;

  if settings_row is not null and jsonb_typeof(settings_row) <> 'object' then
    raise exception 'settings_row must be a JSON object';
  end if;

  if coalesce(array_length(deleted_word_ids, 1), 0) > 0 then
    delete from public.user_progress
    where user_id = current_user_id
      and word_id = any(deleted_word_ids);

    get diagnostics deleted_count = row_count;
  end if;

  with incoming as (
    select
      current_user_id as user_id,
      payload.word_id,
      greatest(coalesce(payload.seen, 0), 0) as seen,
      greatest(coalesce(payload.correct, 0), 0) as correct,
      greatest(coalesce(payload.wrong, 0), 0) as wrong,
      coalesce(payload.known, false) as known,
      case
        when coalesce(payload.known, false) then false
        else coalesce(payload.needs_practice, false)
      end as needs_practice,
      payload.last_reviewed,
      coalesce(payload.updated_at, sync_timestamp) as updated_at
    from jsonb_to_recordset(coalesce(progress_rows, '[]'::jsonb)) as payload(
      word_id integer,
      seen integer,
      correct integer,
      wrong integer,
      known boolean,
      needs_practice boolean,
      last_reviewed date,
      updated_at timestamptz
    )
    where payload.word_id is not null
  ),
  upserted as (
    insert into public.user_progress (
      user_id,
      word_id,
      seen,
      correct,
      wrong,
      known,
      needs_practice,
      last_reviewed,
      updated_at
    )
    select
      incoming.user_id,
      incoming.word_id,
      incoming.seen,
      incoming.correct,
      incoming.wrong,
      incoming.known,
      incoming.needs_practice,
      incoming.last_reviewed,
      incoming.updated_at
    from incoming
    on conflict (user_id, word_id) do update
    set
      seen = excluded.seen,
      correct = excluded.correct,
      wrong = excluded.wrong,
      known = excluded.known,
      needs_practice = excluded.needs_practice,
      last_reviewed = excluded.last_reviewed,
      updated_at = excluded.updated_at
    returning 1
  )
  select count(*)::integer
  into upserted_progress_count
  from upserted;

  if settings_row is not null then
    select
      greatest(1, round(coalesce((settings_row ->> 'daily_goal')::numeric, 1))::integer),
      coalesce((settings_row ->> 'updated_at')::timestamptz, sync_timestamp)
    into next_daily_goal, next_settings_updated_at;

    insert into public.user_settings (user_id, daily_goal, updated_at)
    values (current_user_id, next_daily_goal, next_settings_updated_at)
    on conflict (user_id) do update
    set
      daily_goal = excluded.daily_goal,
      updated_at = excluded.updated_at;

    settings_applied := found;
  end if;

  return jsonb_build_object(
    'progress_accepted_count', upserted_progress_count,
    'progress_stale_count', 0,
    'settings_applied', settings_applied,
    'settings_stale', false,
    'deleted_count', deleted_count,
    'synced_at', sync_timestamp
  );
end;
$$;
