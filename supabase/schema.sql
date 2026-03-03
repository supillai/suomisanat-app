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
