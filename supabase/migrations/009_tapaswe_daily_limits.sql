-- Applied 2026-11-03 via Supabase MCP to project qyjzqzqqjimittltttph (shared DB).
-- Atomic per-user daily limits for Tapaswe (recordings, practice attempts).
create table if not exists public.tapaswe_daily_limits (
  user_id text not null,
  day     date not null default current_date,
  kind    text not null,
  n       int  not null default 0,
  primary key (user_id, day, kind)
);
alter table public.tapaswe_daily_limits enable row level security;
revoke all on table public.tapaswe_daily_limits from anon, authenticated;

create or replace function public.tapaswe_take_slot(p_user text, p_kind text, p_max int)
returns boolean language sql security definer set search_path = public as $$
  with hit as (
    insert into public.tapaswe_daily_limits (user_id, day, kind, n)
    values (p_user, current_date, p_kind, 1)
    on conflict (user_id, day, kind)
      do update set n = public.tapaswe_daily_limits.n + 1
      where public.tapaswe_daily_limits.n < p_max
    returning 1
  )
  select exists (select 1 from hit);
$$;
revoke all on function public.tapaswe_take_slot(text, text, int) from public, anon, authenticated;
grant execute on function public.tapaswe_take_slot(text, text, int) to service_role;
