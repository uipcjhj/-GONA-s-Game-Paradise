import { AVATARS } from './avatars';
import { GAMES } from './registry';
import type { PlayerData } from './types';

/** 도감: 이 플랫폼에서 확인 가능한 사실만으로 해금(이미지 없는 항목은 아이콘 사용 — 신규 이미지는 승인 후) */
export type CodexCategory = '캐릭터' | '게임' | '성장' | '미니게임' | '특별';
export interface CodexDef {
  id: string;
  category: CodexCategory;
  name: string;
  desc: string;
  /** 해금 조건 설명(미해금일 때 힌트) */
  hint: string;
  unlocked: (p: PlayerData) => boolean;
  /** 아바타 id (캐릭터 도감 이미지) */
  avatar?: string;
}

export const CODEX: CodexDef[] = [
  ...AVATARS.map<CodexDef>((a) => ({
    id: `char-${a.id}`,
    category: '캐릭터',
    name: a.name,
    desc: a.desc,
    hint: '아바타로 선택하면 도감에 기록돼요',
    avatar: a.id,
    unlocked: (p) => a.id === 'gona' || p.avatarId === a.id,
  })),
  ...GAMES.map<CodexDef>((g) => ({
    id: `game-${g.gameId}`,
    category: '게임',
    name: g.name,
    desc: `${g.name} 을(를) 플레이했어요`,
    hint: '이 게임을 1판 끝까지 하면 열려요',
    unlocked: (p) => (p.gameRecords[g.gameId]?.plays ?? 0) > 0,
  })),
  ...[1, 2, 3, 4].map<CodexDef>((n) => ({
    id: `food-stage-${n}`,
    category: '성장',
    name: `성장 ${n}단계`,
    desc: `Food Adventure 에서 ${n}단계에 도달했어요`,
    hint: `Food Adventure 에서 ${n}단계까지 가면 열려요`,
    unlocked: (p) => (p.gameRecords['food-island']?.bestStage ?? 0) >= n,
  })),
  ...[
    ['sort', '편가르기 대소동'],
    ['tower', '아슬아슬 탑'],
    ['toyroom', '엉망진창 장난감방'],
  ].map<CodexDef>(([s, n]) => ({
    id: `mini-${s}`,
    category: '미니게임',
    name: n,
    desc: `미니게임천국의 ${n} 을(를) 플레이했어요`,
    hint: `미니게임천국에서 ${n} 을(를) 1판 하면 열려요`,
    unlocked: (p) => (p.gameRecords['minigame-paradise']?.subGames?.[s]?.plays ?? 0) > 0,
  })),
  { id: 'sp-level10', category: '특별', name: '레벨 10 달성', desc: '게임천국 레벨 10에 올랐어요', hint: '레벨 10 달성', unlocked: (p) => p.playerLevel >= 10 },
  { id: 'sp-streak7', category: '특별', name: '7일 연속 출석', desc: '일주일 동안 매일 놀러 왔어요', hint: '7일 연속 출석', unlocked: (p) => (p.missions?.attendance.streak ?? 0) >= 7 },
  { id: 'sp-clear', category: '특별', name: '첫 클리어', desc: '처음으로 게임을 클리어했어요', hint: '아무 게임이나 클리어', unlocked: (p) => (p.stats.clears ?? 0) > 0 },
];
export const CODEX_CATEGORIES: CodexCategory[] = ['캐릭터', '게임', '성장', '미니게임', '특별'];

/** 새로 열린 도감 항목 id (이미 열린 것 제외) */
export function newlyCodex(p: PlayerData): CodexDef[] {
  return CODEX.filter((c) => !p.codex[c.id] && c.unlocked(p));
}
