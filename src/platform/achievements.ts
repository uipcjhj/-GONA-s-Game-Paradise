import { GAMES } from './registry';
import type { PlayerData } from './types';

export interface AchievementDef {
  id: string;
  /** 없으면 공통 업적 */
  gameId?: string;
  name: string;
  desc: string;
  target: number;
  rewardCoins: number;
  rewardTitle?: string;
  /** 현재 진행 값을 플레이어 데이터에서 계산 */
  value: (p: PlayerData) => number;
}
const rec = (p: PlayerData, g: string) => p.gameRecords[g];
const sub = (p: PlayerData, s: string) => p.gameRecords['minigame-paradise']?.subGames?.[s];

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'play-1', name: '첫 걸음', desc: '게임을 1판 끝까지 해요', target: 1, rewardCoins: 10, value: (p) => p.totalPlayCount },
  { id: 'play-10', name: '단골 손님', desc: '게임을 10판 끝까지 해요', target: 10, rewardCoins: 30, value: (p) => p.totalPlayCount },
  { id: 'play-50', name: '게임천국 주민', desc: '게임을 50판 끝까지 해요', target: 50, rewardCoins: 100, rewardTitle: 'title-master', value: (p) => p.totalPlayCount },
  { id: 'clear-1', name: '첫 클리어', desc: '아무 게임이나 1번 클리어해요', target: 1, rewardCoins: 30, rewardTitle: 'title-clear', value: (p) => p.stats.clears ?? 0 },
  { id: 'clear-10', name: '클리어 수집가', desc: '클리어를 10번 해요', target: 10, rewardCoins: 80, value: (p) => p.stats.clears ?? 0 },
  { id: 'newbest-5', name: '기록 경신', desc: '내 최고 기록을 5번 갈아치워요', target: 5, rewardCoins: 40, value: (p) => p.stats.newBests ?? 0 },
  { id: 'games-2', name: '이 섬 저 섬', desc: '서로 다른 게임을 2종류 플레이해요', target: 2, rewardCoins: 30, value: (p) => Object.keys(p.gameRecords).filter((g) => (p.gameRecords[g].plays ?? 0) > 0).length },
  { id: 'time-1h', name: '1시간 놀이', desc: '총 플레이 시간 1시간', target: 3600, rewardCoins: 50, value: (p) => p.totalPlayTimeSec },
  { id: 'level-5', name: '레벨 5', desc: '플레이어 레벨 5 달성', target: 5, rewardCoins: 40, value: (p) => p.playerLevel },
  { id: 'level-10', name: '레벨 10', desc: '플레이어 레벨 10 달성', target: 10, rewardCoins: 100, value: (p) => p.playerLevel },
  { id: 'streak-3', name: '3일 연속 출석', desc: '3일 연속으로 접속해요', target: 3, rewardCoins: 20, value: (p) => p.missions?.attendance.streak ?? 0 },
  { id: 'streak-7', name: '7일 연속 출석', desc: '7일 연속으로 접속해요', target: 7, rewardCoins: 60, rewardTitle: 'title-streak', value: (p) => p.missions?.attendance.streak ?? 0 },
  { id: 'mission-5', name: '미션 5개', desc: '미션 보상을 5번 받아요', target: 5, rewardCoins: 30, value: (p) => p.stats.missionsClaimed ?? 0 },
  { id: 'shop-1', name: '첫 쇼핑', desc: '상점에서 아이템을 1개 사요', target: 1, rewardCoins: 10, value: (p) => p.stats.purchases ?? 0 },
  { id: 'codex-5', name: '도감 5개', desc: '도감을 5개 채워요', target: 5, rewardCoins: 30, value: (p) => Object.keys(p.codex).length },
  // 게임별
  { id: 'food-stage-2', gameId: 'food-island', name: '쑥쑥 자라는 고나', desc: 'Food Adventure 에서 2단계에 도달해요', target: 2, rewardCoins: 20, value: (p) => rec(p, 'food-island')?.bestStage ?? 0 },
  { id: 'food-stage-4', gameId: 'food-island', name: '어엿한 고나', desc: 'Food Adventure 에서 4단계에 도달해요', target: 4, rewardCoins: 60, value: (p) => rec(p, 'food-island')?.bestStage ?? 0 },
  { id: 'food-clear', gameId: 'food-island', name: '간식 대모험 완주', desc: 'Food Adventure 를 클리어해요', target: 1, rewardCoins: 100, value: (p) => rec(p, 'food-island')?.clears ?? 0 },
  { id: 'mini-3', gameId: 'minigame-paradise', name: '미니게임 탐험', desc: '미니게임 3종류를 모두 플레이해요', target: 3, rewardCoins: 50, rewardTitle: 'title-mini', value: (p) => ['sort', 'tower', 'toyroom'].filter((s) => (sub(p, s)?.plays ?? 0) > 0).length },
  { id: 'mini-sort-clear', gameId: 'minigame-paradise', name: '편가르기 심판', desc: '편가르기를 클리어해요', target: 1, rewardCoins: 20, value: (p) => sub(p, 'sort')?.clears ?? 0 },
  { id: 'mini-tower-clear', gameId: 'minigame-paradise', name: '탑 쌓기 성공', desc: '아슬아슬 탑을 클리어해요', target: 1, rewardCoins: 20, value: (p) => sub(p, 'tower')?.clears ?? 0 },
  { id: 'mini-toy-clear', gameId: 'minigame-paradise', name: '장난감 정리 끝', desc: '장난감방을 클리어해요', target: 1, rewardCoins: 20, value: (p) => sub(p, 'toyroom')?.clears ?? 0 },
];
export const getAchievement = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);

/** 새로 달성한 업적 id 목록 (이미 달성한 것은 제외 → 멱등) */
export function newlyUnlocked(p: PlayerData): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !p.achievements[a.id] && a.value(p) >= a.target);
}
export function achievementGames(): string[] {
  return GAMES.map((g) => g.gameId);
}
