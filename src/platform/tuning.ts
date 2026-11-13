/**
 * 플랫폼 수치 표(임시 설계값 — 운영 전 승인 필요, D7). 규칙 코드는 이 표만 읽는다.
 * 점수·XP·코인은 분리: 코인은 꾸미기 전용 무료 재화(현금 결제·능력치 아이템 없음).
 */
export const TUNING = {
  /** 판 1회 보상 */
  reward: {
    baseXP: 15,
    clearXP: 25,
    newBestXP: 10,
    scoreXPMax: 40,
    baseCoins: 3,
    clearCoins: 7,
    newBestCoins: 5,
  },
  /** 일일 상한 (KST 날짜 기준, 게임별 / 전체) */
  dailyCap: { xpPerGame: 240, coinsPerGame: 60, xpTotal: 600, coinsTotal: 150 },
  /** 레벨 */
  maxLevel: 99,
  /** 출석 보상(연속 일수 1~7일차, 이후 7일차 반복) */
  attendanceCoins: [5, 5, 8, 8, 10, 10, 20],
  attendanceXP: 10,
  /** 저장 크기 제한 */
  ledgerMax: 100,
  coinLogMax: 30,
  topMax: 10,
} as const;
