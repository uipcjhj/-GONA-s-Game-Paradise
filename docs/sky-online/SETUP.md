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

## 사용자가 해야 하는 일 (최소 순서 · 무료 플랜)

1. **프로젝트 만들기** — https://supabase.com → New project (지역: Northeast Asia (Seoul)) · DB 비밀번호는 본인만 보관
2. **이메일 로그인 켜기** — Authentication → Sign In / Providers → Email 켜기
   - 바로 로그인되게 하려면 "Confirm email" 끄기 (켜 두면 메일 확인 후 로그인)
   - Authentication → URL Configuration → Site URL: `https://uipcjhj.github.io/GoNa/sky-adventure/`
3. **DB 만들기** — SQL Editor → `supabase/migrations/20261126000000_sky_online.sql` 전체 붙여 넣고 Run (1번만)
4. **서버 함수 올리기** — 본인 컴퓨터 터미널에서 (Supabase CLI: `npm i -g supabase`)
   ```bash
   cd -GONA-s-Game-Paradise          # 이 저장소
   supabase login                    # 브라우저로 로그인 (토큰을 채팅에 붙이지 마세요)
   supabase link --project-ref <프로젝트 ref>
   supabase functions deploy start-play
   supabase functions deploy submit-score
   supabase functions deploy delete-account
   supabase secrets set SKY_ALLOWED_ORIGIN=https://uipcjhj.github.io
   ```
   - 함수가 쓰는 `SUPABASE_SERVICE_ROLE_KEY` 는 Supabase 가 함수 안에 **자동으로** 넣어 줌 → 사용자가 어디에도 입력할 필요 없음
5. **공개 값 2개 전달** — Project Settings → API (또는 API Keys) 에서
   - `Project URL` (예: `https://abcd1234.supabase.co`)
   - **공개 키**: `anon public` 또는 `sb_publishable_…` 로 시작하는 키
   - 이 두 값은 원래 브라우저에 공개되는 값이라 채팅으로 알려 줘도 됨
   - ⛔ `service_role` · `sb_secret_…` · DB 비밀번호 · 액세스 토큰은 **절대 채팅·파일·GitHub 에 넣지 말 것**
     (게임은 비밀 키가 들어오면 감지해서 온라인을 아예 끔)

## 개발 쪽이 하는 일 (값을 받은 뒤)
- 다시 빌드하지 않고 켜는 방법: 배포 폴더 `sky-adventure/online-config.js` 한 파일에 공개 값만 기록
  ```js
  window.SKY_ONLINE = { url: "https://<ref>.supabase.co", anonKey: "<anon 또는 sb_publishable 키>" };
  ```
  (빌드 때 `SKY_ONLINE_URL` · `SKY_ONLINE_ANON_KEY` 환경변수를 주면 이 파일이 그 값으로 만들어짐 · 다시 배포할 때도 기존 값 유지)
- GitHub Pages 는 이미 만들어진 정적 파일만 올리므로 **GitHub Secrets/Actions 설정은 필요 없음** (공개 값만 쓰기 때문)
- 연결 후 실서버 검사: 가입 → 동기화 → 다른 기기 병합 → 출격/제출 → 랭킹 → 계정 삭제 순서로 실제 확인 후에만 '완료' 보고

## 비밀 키를 쓰는 곳 (안전한 경로만)
| 키 | 어디에 | 누가 넣나 |
|---|---|---|
| anon / publishable | 게임 화면 (`online-config.js`) | 공개 값 — 개발 쪽 |
| service_role / secret | Edge Function 실행 환경 | Supabase 가 자동 주입 (사람이 안 넣음) |
| DB 비밀번호 · CLI 로그인 | 사용자 컴퓨터 | 사용자 본인만 |

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
