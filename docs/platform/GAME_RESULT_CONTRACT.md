# 공통 게임 결과 인터페이스 (Game Result Contract v1)

Food Adventure · Sky Battle · Mini Game Land 가 **같은 방식**으로 결과를 게임천국에 넘기기 위한 계약. (설계 단계 — 코드 없음)

## 1. 결과 봉투 (게임 → 게임천국)
```ts
interface GpResultEnvelope {
  kind: 'gp-result';
  v: 1;                         // 봉투 형식 버전 (모르는 값이면 게임천국이 보류)
  sdk: string;                  // 예 'gp-sdk/0.1' — 디버깅용
  result: GameResult;
}
interface GameResult {
  resultId: string;             // 판마다 새로 만든 무작위 UUID — 중복 제거의 유일한 기준
  sessionId: string;            // 게임천국이 PLAY 때 발급한 실행 세션
  gameId: string;               // 'food-island' | 'sky-battle' | 'minigame-paradise' (= Island.id)
  subGameId?: string;           // Mini Game Land 안의 개별 미니게임 (없으면 생략)
  gameVersion: string;          // 게임 빌드 버전 (예 '1.0.0')
  scoreSchemaVersion: number;   // 점수 규칙 버전 — 규칙이 바뀌면 +1 (랭킹 분리용)
  outcome: 'cleared' | 'failed'; // 한 판의 끝: 클리어(엔딩) / 실패(게임 오버)
  score: number;                // 0 이상 정수 (게임이 화면에 보여준 점수 그대로)
  stage?: number;               // 도달 단계(1부터) — 의미는 GameDef.stageLabel 이 설명
  stageLabel?: string;          // 표시용 이름 (예 '직립보행 고나')
  startedAt: string;            // ISO 8601
  endedAt: string;              // ISO 8601
  durationMs: number;           // 일시정지 제외 플레이 시간
  extra?: Record<string, number | string | boolean>; // 게임별 부가 정보 (Food: snacks, bossRetry …)
}
```
- `quit`(중도 포기)은 v1에서 **기록하지 않음** — 끝까지 가지 않은 판은 결과가 없다(플레이 횟수에 안 셈).
- 모든 필드는 게임천국이 **다시 검증**한다(타입·범위·시간). 게임이 보낸 값은 신뢰하지 않는다.

## 2. 게임 등록 정보 (Game Registry, 게임천국 쪽)
`src/data/islands.ts` 의 섬 항목에 결과 규칙을 붙인다(코드 변경 없이 새 게임 추가):
```ts
interface GameResultRule {
  higherIsBetter: true;
  maxScore: number;             // 이보다 크면 '의심'으로 분류(기록 반영 안 함)
  maxScorePerSec?: number;      // 초당 최대 점수 — 초과하면 의심
  stageLabel?: string;          // '성장 단계' | '스테이지' …
  stageCount?: number;          // Food: 4
  hasClear: boolean;            // 클리어 개념이 있는 게임인가
  scoreSchemaVersion: number;   // 지금 받는 점수 규칙 버전
  minVersion?: string;          // 이 버전 미만 결과는 거부
}
```
Food(제안값, 운영 전 승인): `maxScore 5,000,000 · maxScorePerSec 600 · stageCount 4 · hasClear true · scoreSchemaVersion 1`.

## 3. 저장 위치 (같은 출처 localStorage — 키는 모두 `gp.v1.` 접두사)
| 키 | 쓰는 쪽 | 읽는 쪽 | 내용 |
|---|---|---|---|
| `gp.v1.session.<sid>` | 게임천국 | 게임, 게임천국 | 실행 세션(아래 §4) |
| `gp.v1.inbox.<resultId>` | **게임** | 게임천국 | 결과 봉투 1개(= 키 1개 → 동시 쓰기 충돌 없음) |
| `gp.v1.player` | **게임천국만** | 게임천국 | 플레이어 데이터(기록 포함) — 게임은 절대 쓰지 않음 |
- 게임이 쓰는 건 `inbox.<resultId>` **새 키 하나뿐**. 기존 키를 덮어쓰지 않으므로 어느 쪽 데이터도 깨지지 않는다.
- 크기 제한: 봉투 ≤ 2KB, inbox 동시 보관 ≤ 20개(넘으면 게임이 가장 오래된 것부터 정리), 30일 지난 inbox/세션은 게임천국이 삭제.

## 4. 실행 세션
```ts
interface LaunchSession {
  sessionId: string;            // UUID
  gameId: string;
  playerId: string;             // 발급 당시 플레이어 — 다른 플레이어에게 반영 금지
  startedAt: string; expiresAt: string;   // 기본 +12시간
  returnUrl: string;            // 게임천국 주소 (게임은 이 값으로만 돌아감 → 임의 주소 이동 방지)
  version: 1;
}
```
- 게임 실행 주소는 `…/GoNa/?gp=<sessionId>` **한 개 파라미터**뿐. 돌아갈 주소·플레이어 ID 는 주소에 싣지 않는다(세션 레코드에서 읽음).
- 게임(SDK)은 `gp` 가 **있고 + 세션 레코드가 실제로 존재하고 + 만료 전 + gameId 가 일치**할 때만 활성화. 아니면 완전한 no-op.

## 5. SDK (게임 쪽, 의존성 없는 한 파일 ~60줄 + 게임별 어댑터)
```ts
GP.init(gameId): boolean               // 세션 검증, 활성 여부
GP.runStart(): void                    // 한 판 시작 (runId 생성)
GP.runPause()/runResume(): void        // 일시정지 시간 제외
GP.runEnd({ outcome, score, stage, stageLabel, extra }): void  // 봉투 1회 기록 (runId 당 1번만)
GP.returnUrl(): string | null          // '돌아가기' 버튼용
```
- `runEnd` 는 runId 당 **1번만** 동작(엔딩 다시보기·중복 이벤트 방지). 쓰기 실패 시 메모리에 보관 후 `visibilitychange`/`pagehide`에 재시도.
- Food 어댑터: `bus` 이벤트(`EV.start`→runStart, `EV.pause/resume`, `EV.gameOver`→failed, `EV.endingStart`→cleared)만 구독. 게임 로직·점수·저장 키는 읽기만 하고 쓰지 않음.
- Sky Battle / Mini Game Land: 같은 SDK 를 복사해 넣고 자기 종료 지점에서 `GP.runEnd` 호출. Mini Game Land 는 `subGameId` 로 개별 미니게임 구분(기록은 `minigame-paradise` 와 `minigame-paradise/<subGameId>` 둘 다 갱신 가능).

## 6. 게임천국 수신 규칙 (consumeInbox)
1. `navigator.locks`(Web Locks) 로 한 탭만 실행 (미지원 환경은 락 없이 진행 — 아래 5번이 중복을 막음).
2. `gp.v1.inbox.*` 를 모두 읽어 **검증**: 봉투 형식·`v`·크기·필드 타입/범위·`gameId` 등록 여부·`scoreSchemaVersion`/`gameVersion`·세션 존재·세션의 `playerId` = 현재 플레이어·`endedAt` 이 세션 시간대 안·`score ≤ maxScore`·`score/초 ≤ maxScorePerSec`.
3. 통과한 결과를 **메모리의 플레이어 데이터에 모두 적용**(원장에 없는 resultId 만) → `gp.v1.player` **한 번만 저장** → 성공한 뒤에 해당 inbox 키 삭제.
4. 의심/형식 오류 결과는 반영하지 않고 `gp.v1.rejected.<resultId>`(요약)로 옮겨 보관(최대 20개, 7일) — 사용자 화면에는 "일부 기록을 확인할 수 없었어요" 정도만.
5. 중복 방지의 최종 기준 = 플레이어 데이터의 `resultLedger`(최근 100개 resultId). 저장은 성공했는데 삭제 전에 앱이 꺼져도 다음 실행에서 원장에 있으므로 **건너뛰고 inbox 만 정리**한다.
6. 알 수 없는 버전(`v`/`scoreSchemaVersion` 이 더 새로움)은 지우지 않고 보류 → 게임천국이 업데이트되면 처리.

## 7. 기록 갱신 규칙(applyResult)
`plays += 1` · `outcome==='cleared'` 이면 `clears += 1` · `score > bestScore` 이면 `bestScore/bestScoreAt` 갱신(동점은 먼저 달성한 기록 유지) · `stage > bestStage` 이면 갱신 · `lastPlayedAt = endedAt` · `lastResult` 갱신 · `totalPlayTimeSec += durationMs/1000` · 총 플레이 횟수/시간 합산 · 원장에 resultId 추가. 모두 **한 번의 저장**으로 반영.
