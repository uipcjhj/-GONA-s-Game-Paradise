-- 마이그레이션 적용 후 RLS · 권한 · rev 충돌 검사 (로컬 Postgres)
\set ON_ERROR_STOP 0
\set A '00000000-0000-0000-0000-00000000000a'
\set Bu '00000000-0000-0000-0000-00000000000b'
create temp table r (n text, ok boolean, x text); grant all on r to anon, authenticated;
-- 사용자 A 로 로그인한 상태
set role authenticated; select set_config('request.jwt.claim.sub', :'A', false);
insert into public.sky_players values (:'A', '검수A');
insert into r select 'A 자기 닉네임 저장', count(*) = 1, '' from public.sky_players;
select public.sky_save_put('{"x":1}', 0) as v \gset
insert into r values ('첫 저장 rev 1', :v = 1, :'v');
select public.sky_save_put('{"x":2}', 1) as v \gset
insert into r values ('rev 맞으면 갱신 → 2', :v = 2, :'v');
select public.sky_save_put('{"x":3}', 1) as v \gset
insert into r values ('rev 틀리면 거절(-1) · 덮어쓰기 없음', :v = -1 and (select bundle->>'x' from public.sky_saves) = '2', :'v');
-- 점수·세션 직접 쓰기 시도
do $$ begin insert into public.sky_scores (user_id, session_id, nickname, mode, board, stage, diff, fam, score, verified) values (auth.uid(), gen_random_uuid(), 'x', 'story', 'story:easy', 6, 'easy', 'mom', 999999999, true); insert into r values ('점수 직접 쓰기 차단', false, '들어감 ⚠'); exception when others then insert into r values ('점수 직접 쓰기 차단', true, sqlerrm); end $$;
do $$ begin insert into public.sky_play_sessions (user_id, mode, stage, diff, fam) values (auth.uid(), 'story', 1, 'easy', 'mom'); insert into r values ('세션 직접 만들기 차단', false, '들어감 ⚠'); exception when others then insert into r values ('세션 직접 만들기 차단', true, sqlerrm); end $$;
reset role;
-- 서버(service_role)가 검증 점수·거절 점수 기록
insert into public.sky_play_sessions (id, user_id, mode, stage, diff, fam) values ('11111111-1111-1111-1111-111111111111', :'A', 'story', 6, 'normal', 'dad'), ('22222222-2222-2222-2222-222222222222', :'Bu', 'story', 6, 'normal', 'mom');
insert into public.sky_scores (user_id, session_id, nickname, mode, board, stage, diff, fam, score, verified) values (:'A', '11111111-1111-1111-1111-111111111111', '검수A', 'story', 'story:normal', 6, 'normal', 'dad', 1000, true), (:'Bu', '22222222-2222-2222-2222-222222222222', '검수B', 'story', 'story:normal', 6, 'normal', 'mom', 99999999, false);
insert into public.sky_saves (user_id, bundle) values (:'Bu', '{"secret":"B"}');
-- 사용자 B 로그인: A 저장 못 봄 · 못 고침
set role authenticated; select set_config('request.jwt.claim.sub', :'Bu', false);
insert into r select 'B 는 A 저장 못 읽음', count(*) = 1 and bool_and(user_id = :'Bu'), count(*)::text from public.sky_saves;
update public.sky_saves set bundle = '{"hack":1}' where user_id = :'A';
reset role; insert into r select 'B 가 A 저장 수정 불가', bundle->>'x' = '2', bundle::text from public.sky_saves where user_id = :'A';
set role authenticated; select set_config('request.jwt.claim.sub', :'Bu', false);
do $$ begin update public.sky_players set nickname = 'hack' where user_id = '00000000-0000-0000-0000-00000000000a'; end $$;
reset role; insert into r select 'B 가 A 닉네임 수정 불가', nickname = '검수A', nickname from public.sky_players where user_id = :'A';
-- 비로그인(anon): 랭킹은 보이고 저장·플레이어는 안 보임 · 저장 함수 실행 불가
set role anon; select set_config('request.jwt.claim.sub', '', false);
insert into r select '비로그인 랭킹: 검증 점수만 보임', count(*) = 1 and min(score) = 1000, count(*)::text from public.sky_leaderboard;
do $$ begin perform count(*) from public.sky_saves; insert into r values ('비로그인 저장 표 접근 차단', false, '읽힘 ⚠'); exception when others then insert into r values ('비로그인 저장 표 접근 차단', true, sqlerrm); end $$;
do $$ begin perform public.sky_save_put('{}', 0); insert into r values ('비로그인 저장 함수 차단', false, '실행됨 ⚠'); exception when others then insert into r values ('비로그인 저장 함수 차단', true, sqlerrm); end $$;
reset role;
insert into r select '주간 랭킹 뷰 동작', count(*) = 1, count(*)::text from public.sky_leaderboard_weekly;
-- 계정 삭제(delete-account 가 하는 일: auth.users 삭제) → 모든 표에서 연쇄 삭제
delete from auth.users where id = :'A';
insert into r select '계정 삭제 → 플레이어·저장·세션·점수 연쇄 삭제', (select count(*) from public.sky_players where user_id = :'A') + (select count(*) from public.sky_saves where user_id = :'A') + (select count(*) from public.sky_play_sessions where user_id = :'A') + (select count(*) from public.sky_scores where user_id = :'A') = 0, '';
select case when ok then 'PASS' else 'FAIL' end || ' · ' || n || coalesce(' — ' || nullif(x, ''), '') from r;
