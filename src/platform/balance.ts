/**
 * 보상·밸런스 설정 — 수치는 모두 여기서만 바꾼다(임시 초기값, 운영 전 별도 승인 필요: 결정 D7).
 * 로직(rewards.ts 등)은 이 값을 읽기만 하므로 수치 수정은 이 파일만 고치면 된다.
 */
export const BALANCE = {
  maxLevel: 99,
  /** 레벨 L → L+1 에 필요한 XP */
  xpToNext: (level: number): number => 100 + 40 * (Math.max(1, level) - 1),
  /** 레벨 달성 보너스 코인 (레벨당 1회) */
  levelUpCoins: (level: number): number => Math.min(100, 10 + level * 2),

  /** 게임 결과 보상 */
  play: {
    minDurationSec: 15, // 이보다 짧은 판은 보상 없음(기록은 반영)
    baseXp: 20,
    scoreXpPer: 200, // 점수 200점마다 +1 XP
    scoreXpCap: 60,
    clearXp: 100,
    clearCoins: 50,
    newBestXp: 30,
    newBestCoins: 20,
    baseCoins: 5,
    scoreCoinPer: 1000, // 점수 1000점마다 +1 코인
    scoreCoinCap: 10,
  },
  /** 어뷰징 방지: 하루(KST) 보상을 받는 판 수 / 클리어 보너스 횟수 / 세션당 판 수 */
  caps: { dailyRewardedRuns: 10, dailyClearBonuses: 3, perSessionRewardedRuns: 6 },

  /** 출석: 연속 일수(1~7, 이후 반복)에 따른 코인 */
  attendance: { coins: [10, 10, 15, 15, 20, 20, 50], xp: 10 },

  /** 일일 미션 보상 */
  mission: { smallCoins: 10, mediumCoins: 20, xp: 15 },

  /** 결과 검증(이상치) — Food 실제 점수 구조 기반: 간식 최대 50점/개, 몬스터 40~60점, 보스 300/600 */
  validation: {
    maxAgeDays: 30, // 이보다 오래된 결과는 거부
    clockSkewSec: 300,
    sessionHours: 12,
    carryAllowance: 60000, // 체크포인트·보스전 재도전은 이전 점수를 이어서 시작
  },

  recentPlaysKept: 20,
  ledgerKept: 100,
  historyKept: 100,
} as const;
