-- GONA's Sky Adventure 온라인: 계정 · 클라우드 저장 · 공유 랭킹
-- 원칙: 클라이언트(anon 키)는 자기 저장만 읽고 쓸 수 있고, 점수·플레이 세션은 직접 쓸 수 없음 (Edge Function = service_role 만 기록)

create extension if not exists pgcrypto;

-- 1) 플레이어 (Supabase Auth 사용자 1명 = 1행)
create table if not exists public.sky_players (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) 클라우드 저장 (계정당 1벌 · 병합은 클라이언트의 mergeBundle 규칙 · rev 로 동시 저장 충돌 감지)
create table if not exists public.sky_saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  bundle jsonb not null,
  schema int not null default 3,
  rev int not null default 1,
  updated_at timestamptz not null default now()
);

-- 3) 플레이 세션 (서버가 발급 · 점수 제출은 발급된 세션 1개당 1번)
create table if not exists public.sky_play_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null check (mode in ('story', 'hunt', 'daily')),
  stage int not null check (stage between 1 and 6),
  diff text not null check (diff in ('easy', 'normal', 'hard')),
  fam text not null check (fam in ('mom', 'dad', 'imo', 'samchon', 'halmeoni', 'halabeoji')),
  daily_date date,
  started_at timestamptz not null default now(),
  used_at timestamptz
);
create index if not exists sky_play_sessions_user on public.sky_play_sessions (user_id, started_at desc);

-- 4) 점수 (검증 통과 = verified · 공식 랭킹은 verified 만)
create table if not exists public.sky_scores (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null unique references public.sky_play_sessions (id) on delete cascade,
  nickname text not null,
  mode text not null,
  board text not null,            -- 'story:normal' · 'hunt:3:hard' · 'daily:2026-11-26'
  stage int not null,
  diff text not null,
  fam text not null,
  score int not null check (score >= 0),
  rank text,
  time_s int,
  verified boolean not null default false,
  reject_reason text,
  created_at timestamptz not null default now()
);
create index if not exists sky_scores_board on public.sky_scores (board, verified, score desc);
create index if not exists sky_scores_week on public.sky_scores (created_at);

-- RLS
alter table public.sky_players enable row level security;
alter table public.sky_saves enable row level security;
alter table public.sky_play_sessions enable row level security;
alter table public.sky_scores enable row level security;

-- 플레이어: 자기 행만 읽기·쓰기 (닉네임은 랭킹 뷰로만 공개)
create policy sky_players_self_select on public.sky_players for select using (auth.uid() = user_id);
create policy sky_players_self_insert on public.sky_players for insert with check (auth.uid() = user_id);
create policy sky_players_self_update on public.sky_players for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- 저장: 자기 것만
create policy sky_saves_self_select on public.sky_saves for select using (auth.uid() = user_id);
create policy sky_saves_self_insert on public.sky_saves for insert with check (auth.uid() = user_id);
create policy sky_saves_self_update on public.sky_saves for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- 세션: 자기 것 읽기만 (만들기·사용 처리는 Edge Function)
create policy sky_sessions_self_select on public.sky_play_sessions for select using (auth.uid() = user_id);
-- 점수: 누구나 검증된 점수 읽기 (쓰기 정책 없음 = anon/authenticated 직접 insert 불가)
create policy sky_scores_public_select on public.sky_scores for select using (verified);

-- 저장 낙관적 잠금: rev 가 맞을 때만 갱신 (다른 기기가 먼저 저장했으면 0행 → 클라이언트가 다시 받아 병합)
create or replace function public.sky_save_put(p_bundle jsonb, p_rev int)
returns int language plpgsql security invoker as $$
declare new_rev int;
begin
  if auth.uid() is null then raise exception 'login required' using errcode = '28000'; end if;
  insert into public.sky_saves (user_id, bundle, rev) values (auth.uid(), p_bundle, 1)
  on conflict (user_id) do update set bundle = excluded.bundle, rev = public.sky_saves.rev + 1, updated_at = now()
    where public.sky_saves.rev = p_rev
  returning rev into new_rev;
  return coalesce(new_rev, -1);
end $$;
revoke all on function public.sky_save_put(jsonb, int) from public, anon;
grant execute on function public.sky_save_put(jsonb, int) to authenticated;

-- 랭킹 뷰: 보드별 사용자 최고 기록 1개 · TOP 100
create or replace view public.sky_leaderboard with (security_invoker = true) as
select distinct on (board, user_id) board, user_id, nickname, fam, diff, stage, score, rank, time_s, created_at
from public.sky_scores where verified
order by board, user_id, score desc, created_at asc;

create or replace view public.sky_leaderboard_weekly with (security_invoker = true) as
select distinct on (board, user_id) board, user_id, nickname, fam, diff, stage, score, rank, time_s, created_at
from public.sky_scores where verified and created_at >= date_trunc('week', now())
order by board, user_id, score desc, created_at asc;

grant select on public.sky_leaderboard, public.sky_leaderboard_weekly to anon, authenticated;

-- 클라이언트 키(anon/authenticated)는 점수·세션 표에 직접 쓰기 권한 자체가 없음 (RLS 정책 + 권한 이중 차단)
revoke insert, update, delete on public.sky_scores, public.sky_play_sessions from anon, authenticated;
revoke all on public.sky_players, public.sky_saves from anon;
