# GONA's Sky Adventure — 온라인(계정 · 클라우드 저장 · 공유 랭킹) 연결 방법

현재 상태: **코드 · DB 구조 · 보안 정책 · 서버 함수는 저장소에 준비됨. 실제 Supabase 프로젝트는 아직 없음.**
→ 라이브 게임은 `ONLINE=false` 로 동작 (게스트 · 기기 저장 · 백업 코드). 아래 설정을 마치고 다시 빌드하면 켜짐.

## 사용자가 직접 해야 하는 일 (약 15분 · 무료 플랜으로 가능)

1. https://supabase.com 에서 무료 프로젝트 만들기 (지역: Northeast Asia (Seoul) 권장)
2. **Authentication → Providers → Email** 켜기
   - 바로 로그인되게 하려면 "Confirm email" 끄기 (켜 두면 가입 후 메일 확인 링크를 눌러야 로그인됨)
   - **URL Configuration → Site URL**: `https://uipcjhj.github.io/GoNa/sky-adventure/`
3. **SQL Editor** 에 `supabase/migrations/20261126000000_sky_online.sql` 내용을 붙여 넣고 실행
4. 서버 함수 배포 (컴퓨터에 Supabase CLI 필요: `npm i -g supabase`)
   ```bash
   supabase login
   supabase link --project-ref <프로젝트 ref>
   supabase functions deploy start-play
   supabase functions deploy submit-score
   supabase functions deploy delete-account
   supabase secrets set SKY_ALLOWED_ORIGIN=https://uipcjhj.github.io
   ```
5. **Project Settings → API** 의 `Project URL` 과 `anon public` 키를 알려 주기
   (anon 키는 공개돼도 되는 키 · **service_role 키는 절대 공유하지 말 것** — 서버 함수에만 자동으로 들어감)

그 다음은 개발 쪽에서: 빌드할 때 아래 두 값을 넣어 다시 빌드 · 배포

```bash
VITE_SUPABASE_URL=https://<ref>.supabase.co VITE_SUPABASE_ANON_KEY=<anon key> ./tools/sky-adventure-build.sh
```

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
