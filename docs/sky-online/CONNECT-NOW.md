# 고나 전용 Supabase 연결 — 지금 할 일 (2026-11-28)

프로젝트: `https://kzwfxotveadgitfrhyaa.supabase.co` · 공개 키(`sb_publishable_…`)는 받았음 (공개 값 · 안전)

## 서버를 직접 확인한 결과 (공개 키로 읽기만)
| 항목 | 상태 |
|---|---|
| 표 `sky_players` · `sky_saves` · `sky_play_sessions` · `sky_scores` · 랭킹 뷰 2개 | ❌ 없음 → 1단계 |
| 저장 함수 `sky_save_put` | ❌ 없음 → 1단계 |
| Edge Function `start-play` · `submit-score` · `delete-account` | ❌ 없음 → 3단계 |
| 이메일 로그인 | ✅ 켜짐 |
| 이메일 확인(Confirm email) | 켜짐 → 2단계에서 끄기 권장 |

## 1. DB 만들기 (약 1분)
1. 왼쪽 메뉴 **SQL Editor** → **+ New query**
2. 저장소 파일 `supabase/migrations/20261126000000_sky_online.sql` 내용 **전체**를 붙여 넣기
3. 오른쪽 아래 **Run** → `Success. No rows returned`
4. 확인: 왼쪽 **Table Editor** 에 `sky_players` `sky_saves` `sky_play_sessions` `sky_scores` 4개가 보이면 완료
   (한 번만 실행 · 두 번 실행하면 정책 이름이 겹친다는 오류가 날 수 있는데, 표는 그대로라 괜찮음)

## 2. 이메일 확인 끄기 (권장)
- **Authentication → Sign In / Providers → Email** → **Confirm email** 끄기 → **Save**
- 이유: Supabase 무료 기본 메일 발송은 **시간당 몇 통**만 가능 → 가족이 동시에 가입하면 확인 메일이 막힘. 끄면 가입 즉시 로그인
- 켜 두고 싶다면: 확인 메일 링크를 누르면 게임으로 돌아와 **자동 로그인**되도록 이번에 만들어 둠 (Site URL · Redirect URL 은 이미 설정하셨음)

## 3. 서버 함수 3개 만들기 (CLI 없이 대시보드에서)
함수마다 아래를 반복:
1. 왼쪽 메뉴 **Edge Functions** → **Deploy a new function** → **Via Editor**
2. **Function name**: 아래 이름 그대로
3. 편집기 내용을 모두 지우고, 저장소의 해당 파일 **전체**를 붙여 넣기
4. **Deploy function**
5. 만든 함수 → **Details**(또는 Settings) → **Verify JWT** (Enforce JWT verification) **끄기** → 저장
   (브라우저의 사전 요청이 막히지 않게 · 로그인 확인은 함수 안에서 직접 함)

| 이름 | 붙여 넣을 파일 |
|---|---|
| `start-play` | `supabase/dashboard/start-play.ts` |
| `submit-score` | `supabase/dashboard/submit-score.ts` |
| `delete-account` | `supabase/dashboard/delete-account.ts` |

## 4. 서버 설정 1개
- **Edge Functions → Secrets** (또는 Project Settings → Edge Functions) → **Add new secret**
- Name `SKY_ALLOWED_ORIGIN` · Value `https://uipcjhj.github.io` → Save
- 서버 함수가 쓰는 비밀 키(service_role / secret)는 Supabase 가 **자동으로** 넣어 줌 → 직접 입력 · 복사 · 채팅 금지

## 5. 끝나면 "다 했어" 라고만 알려 주기
그다음은 제가 실제 서버로 검사합니다 (공개 키만 사용):
- 테스트 계정 2개 가입 → 저장 분리(RLS) · 동시 저장 충돌 · 사진·배지·체크포인트 동기화
- 위조 점수 거절 · 같은 판 중복 제출 거절 · 정상 점수 통과(약 1분 40초 대기) · 주간/일일/스테이지 랭킹 분리
- 계정 삭제 → 테스트 계정은 검사 끝에 스스로 지움
- 게임 화면(393×636 · 390×844)에서 가입 → 동기화 → 랭킹
모두 통과해야 정식 사이트에 온라인을 켭니다. 그 전까지 정식 사이트는 지금처럼 게스트 · 기기 저장.

## 기존 기기 기록 보호 (이미 들어 있음)
- 처음 로그인 직전 기기 기록 전체를 `gona.skyadv.backup.prelogin` 에 보관
- 병합은 합집합 · 더 좋은 기록 · 더 최근 체크포인트 — 서버 값으로 덮어쓰지 않음
- 동기화 실패 → 기기 기록 그대로
