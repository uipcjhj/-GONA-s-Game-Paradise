# GONA's Sky Adventure — 온라인(계정 · 클라우드 저장 · 공유 랭킹) 연결 방법

## 현재 상태 (2026-11-26 · 솔직하게)
| 항목 | 상태 |
|---|---|
| 게임 쪽 코드 (가입·로그인·동기화·병합·세션·제출·랭킹) | ✅ 준비됨 · 가짜 서버로 흐름 검사 통과 (`tools/sky-online-mock-check.cjs`) |
| DB 구조 · RLS · 권한 (`supabase/migrations/…sql`) | ✅ 실제 Postgres 16 에 적용해 14개 항목 검사 통과 (`tools/sky-online/sql-test.sh`) — Supabase 와 같은 역할(anon/authenticated/service_role)을 흉내 낸 환경 |
| 서버 함수 3개 (start-play · submit-score · delete-account) | ✅ Deno 타입 검사 통과 · 점수 규칙 = 게임 계산 18,833건 일치 · ⚠ **실제 Supabase 에서 실행해 본 적은 없음** |
| CORS 사전 요청 | ✅ `supabase/config.toml` 에서 함수별 `verify_jwt = false` (토큰 확인은 함수 안에서 직접) |
| 실제 Supabase 프로젝트 | ❌ **없음** → 라이브 게임은 온라인 꺼짐 (게스트·기기 저장·백업 코드로 정상 동작) |

→ **서버가 만들어지기 전까지 온라인 기능은 '완료'가 아닙니다.**

## 0. 먼저 확인: 지금 쓰는 Supabase 프로젝트가 레이더(Global Opportunity Radar) 것인가? (2026-11-27)
- GitHub 조사 결과: 접근 가능한 저장소 5개(GoNa · -GONA-s-Game-Paradise · portfolio · movex-marketing-dashboard · gpt) 어디에도 Supabase 주소·키·설정이 없음.
  레이더는 `portfolio` 의 소개 글만 있고 **레이더 코드 저장소는 이 계정에서 찾을 수 없음** → GitHub 만으로는 같은 프로젝트인지 판별 불가.
- 고나 게임에는 아직 어떤 Supabase 프로젝트도 연결돼 있지 않음 (`online-config.js` 비어 있음 · 배포 워크플로에 Supabase 값 없음).
- 대시보드에서 직접 확인 (보기만 · 아무것도 바꾸지 않음):
  1. 왼쪽 위 프로젝트 이름 옆 ▾ → 프로젝트 목록에서 지금 연 프로젝트 이름 확인
  2. **Table Editor** → 스키마 `public` 에 레이더용 표(기사·뉴스·보고서 등 `sky_` 로 시작하지 않는 표)가 있으면 레이더 프로젝트
  3. **Authentication → Users** 에 이미 사용자가 있으면 기존 프로젝트
- ⚠ 레이더 프로젝트였다면: 방금 바꾼 **Site URL · Redirect URL 을 원래 레이더 값으로 되돌려야** 레이더 로그인 메일 링크가 계속 레이더로 감 (원래 값을 기록해 두지 않았다면 레이더 배포 주소).
- 권장: 레이더와 섞지 말고 **고나 전용 프로젝트를 새로 만들기** (무료 플랜 2개까지 · 인증 설정·사용자·Edge Function 이름이 프로젝트 단위로 분리됨)

### 고나 전용 프로젝트 만들기
1. 대시보드 왼쪽 위 ▾ 또는 https://supabase.com/dashboard/projects → **New project**
2. Organization: 지금 쓰는 조직 · **Name: `gona-sky`** · Database Password: **Generate a password** → 본인만 보관(채팅 금지)
3. Region: **Northeast Asia (Seoul)** · Plan: **Free** → **Create new project** (1~2분)
4. 새 프로젝트에서 아래 1~10단계 진행 (Site URL · Redirect URL 은 **새 프로젝트**에 설정)

## 사용자가 직접 해야 하는 일 — 10단계 (무료 플랜 · 약 20분)

> ⚠ 이 문서를 쓰는 환경에서는 supabase.com 공식 문서에 접속할 수 없어(네트워크 차단) **메뉴 이름은 2026년 기준 기억에 의존**합니다. 화면 이름이 조금 달라도 같은 뜻의 메뉴를 찾으면 됩니다.
> 비밀 값(DB 비밀번호 · service_role / secret 키 · 개인 액세스 토큰)은 **채팅 · 파일 · GitHub 어디에도 붙여 넣지 마세요.**

| # | 할 일 | 어디서 · 무엇을 입력 | 정상 완료 확인 |
|---|---|---|---|
| 1 | 무료 프로젝트 만들기 | https://supabase.com → Sign in → **New project** · 이름 `gona-sky` · DB 비밀번호는 본인만 보관 · 요금제 **Free** | 대시보드에 프로젝트가 'Healthy/Active' |
| 2 | 지역 | New project 화면의 **Region** → `Northeast Asia (Seoul)` (만든 뒤엔 바꿀 수 없음) | Project Settings → General 에 Seoul |
| 3 | 이메일 로그인 | **Authentication → Sign In / Providers → Email** 켜기 · 바로 로그인되게 하려면 **Confirm email 끄기** | Providers 목록에 Email = Enabled |
| 4 | 주소 등록 | **Authentication → URL Configuration** · Site URL `https://uipcjhj.github.io/GoNa/sky-adventure/` · Redirect URLs 에 같은 주소와 `https://uipcjhj.github.io/GoNa/sky-adventure/**` 추가 | 저장 후 목록에 두 주소 |
| 5 | DB 만들기 | **SQL Editor → New query** 에 `supabase/migrations/20261126000000_sky_online.sql` 전체를 붙여 넣고 **Run** (한 번만) | 'Success. No rows returned' · Table Editor 에 `sky_players` `sky_saves` `sky_play_sessions` `sky_scores` |
| 6 | 서버 함수 올리기 | 본인 컴퓨터 터미널 (Node 설치 필요 · 전역 설치 없이 `npx supabase` 가능):<br>`npx supabase login` (브라우저 로그인)<br>`npx supabase link --project-ref <ref>` (ref = 프로젝트 주소의 `xxxx` 부분)<br>`npx supabase functions deploy start-play`<br>`npx supabase functions deploy submit-score`<br>`npx supabase functions deploy delete-account` | **Edge Functions** 메뉴에 함수 3개 · 각각 'Active' · `supabase/config.toml` 의 `verify_jwt = false` 가 반영됨 (로그인 확인은 함수 안에서) |
| 7 | 서버 설정 | `npx supabase secrets set SKY_ALLOWED_ORIGIN=https://uipcjhj.github.io` · 함수가 쓰는 서버 키(service_role / secret)는 **Supabase 가 자동으로 넣어 줌** — 직접 입력하지 않음 | **Edge Functions → Secrets** 에 `SKY_ALLOWED_ORIGIN` |
| 8 | 공개 값 2개 확인 | **Project Settings → API** (또는 **API Keys**) · `Project URL` + 공개 키(`anon public` 또는 `sb_publishable_…`) | 두 값 복사 (공개 키는 브라우저에 공개되는 값이라 알려 줘도 안전) |
| 9 | 게임에 반영 | 두 공개 값을 채팅으로 알려 주면 개발 쪽이 `sky-adventure/online-config.js` 에 넣어 배포 (다시 빌드 없음) — 직접 하려면 GoNa 저장소 `sky-test` 브랜치의 그 파일에 `window.SKY_ONLINE = { url: "…", anonKey: "…" };` | 게임 프로필 창에 이메일 · 비밀번호 입력칸이 보임 |
| 10 | 실제 테스트 | 개발 쪽이 실행: `SKY_URL=… SKY_KEY=<공개 키> node --experimental-strip-types tools/sky-online/live-test.mts` (테스트 계정 2개 자동 생성·삭제) + 아이폰에서 가입 → 사진 1장 얻기 → 다른 기기 로그인 → 사진 합쳐짐 → 랭킹 확인 | 검사 전부 PASS 일 때만 '온라인 완료'로 보고 |

### 사용자가 하지 않아도 되는 것 (자동 · 개발 쪽)
- GitHub Secrets · Actions 설정: 필요 없음 (공개 값만 쓰는 정적 페이지)
- DB 권한 · RLS · 함수 코드: 저장소에 준비됨 (로컬 Postgres 검사 14/14 · Deno 타입 검사 통과)

## 스토리 체크포인트 클라우드 동기화 (2026-11-27 추가)
- 저장 묶음(`sky_saves.bundle`)에 `story` 추가 → SQL 변경 없음 (jsonb)
- 병합: 칸마다 더 최근 저장 · 완주 기록은 모드별 높은 점수 · 다른 기기에서 완주해 비운 칸은 지움 (`src/sky/story-merge.ts` · 검사 `node --experimental-strip-types tools/sky-online/story-merge-test.mts`)
- 언제: 로그인 · '지금 동기화' · 체크포인트 저장 3초 뒤 · 로비 들어올 때 (로그인했을 때만)
- 온라인 공식 스토리 랭킹(`story:<diff>`) = ARCADE 연속 완주만 제출됨 (이어하기 판은 제출 안 함)

## 구조

| 표 | 내용 | 클라이언트 권한 (RLS) |
|---|---|---|
| `sky_players` | 계정별 닉네임 | 자기 행만 읽기·쓰기 |
| `sky_saves` | 계정별 기록 묶음(JSON) · `rev` | 자기 것만 · `sky_save_put(rev)` 로 충돌 감지 |
| `sky_play_sessions` | 서버가 발급한 플레이 세션 | 자기 것 읽기만 (만들기 = `start-play`) |
| `sky_scores` | 점수 · `verified` · 거절 사유 | **검증된 점수 읽기만** (쓰기 = `submit-score`) |
| `sky_leaderboard` / `_weekly` (뷰) | 보드별 사용자 최고 기록 | 누구나 읽기 |

## 저장 병합 규칙 (`src/sky/sync.ts`)

- 추억사진 · 배지 · 깃발 · 완주 엽서: **합집합** (얻은 건 사라지지 않음)
- 최고 점수 · 랭크 = 더 좋은 쪽 / 최소 피격·폭탄 = 더 작은 쪽 / 얻은 날 = 더 이른 쪽
- 점수판: 두 쪽 기록 합쳐 중복 제거 후 상위 10
- 계정은 **그 기기에서 고른 모험가(프로필) 하나에만** 연결 — 닉네임이 같아도 다른 프로필과 섞지 않음
- 서버 저장은 `rev` 가 맞을 때만 → 다른 기기가 먼저 저장했으면 다시 받아 병합 후 저장 (덮어쓰기 없음)
- 처음 로그인 직전 기기 기록 전체를 `gona.skyadv.backup.prelogin` 에 보관 · 저장 구조 버전 변경 전 기록은 `gona.skyadv.backup.v2`
- 동기화 실패 → 기기 기록은 그대로

## 점수 검증 수준 (솔직한 한계)

서버(`submit-score`)가 하는 일:
- 로그인 토큰 확인 · 서버가 발급한 세션인지 · 그 세션으로 이미 냈는지(1회) · 모드·스테이지·난이도·동료 일치
- 스테이지별 보고(시간·피격·폭탄·체력·콤보·부위·스테이지 점수)를 **게임과 같은 식으로 랭크·보너스 재계산** → 합계 일치 확인
  (게임 식과 같은지: `node --experimental-strip-types tools/sky-online-rules-test.mjs` — 18,833건 불일치 0)
- 합리성: 너무 빠른 클리어(기준 시간 55% 미만) · 기준 점수 4배 초과 · 체력/부위/폭탄 범위 밖 → 거절
- 실제 경과 시간(서버 시계) < 게임 속 플레이 시간 → 거절
- 남용: 1분에 세션 20개 초과 거절

하지 못하는 일: **입력 리플레이 재현 검증은 없음** → 숙련된 사람이 브라우저에서 수치를 '그럴듯하게' 조작하면 막을 수 없음.
그래서 랭킹 화면에 "서버 확인을 통과한 기록"이라고만 표기하고, 거절 기록은 `verified=false` + 사유로 따로 남겨 운영자가 볼 수 있게 함.
리플레이 검증까지 하려면: 게임 엔진을 고정 시드 + 입력 기록으로 서버(Deno)에서 다시 돌리는 작업이 별도로 필요.

## 테스트

- `tools/sky-online-mock-check.cjs` — 가짜 서버로 클라이언트 흐름 전체(가입 → 병합 업로드 → 세션 → 제출 → 랭킹) 확인 (실서버 검증 아님)
- `tools/sky-online-rules-test.mjs` — 서버 점수 규칙 = 게임 계산 확인 + 위조 3종 거절 확인
