/**
 * 업적 · 칭호 · 도감 · 미션 · 상점 정의(데이터). 조건/수치는 여기와 balance.ts 만 고치면 된다.
 * 모든 달성/발견은 실제 기록(PlayerData)으로만 판정한다.
 */
import type { PlayerData, ShopSlot } from './types';

// ───────── 지표(metric): 플레이어 데이터에서 계산 ─────────
export type MetricKey =
  | 'launches' | 'plays' | 'clears' | 'newBests' | 'coinsEarned' | 'level' | 'checkinStreak' | 'missions' | 'purchases' | 'codex'
  | 'food.bestScore' | 'food.bestStage' | 'food.clears'
  | 'sky.plays' | 'sky.clears' | 'sky.bestStage' | 'mini.plays' | 'mini.subCount';

export function metric(p: PlayerData, k: MetricKey): number {
  const food = p.gameRecords['food-island'];
  switch (k) {
    case 'launches': return p.stats.launches;
    case 'plays': return p.stats.totalPlayCount;
    case 'clears': return Object.values(p.gameRecords).reduce((a, r) => a + r.clears, 0);
    case 'newBests': return p.stats.newBestCount;
    case 'coinsEarned': return p.stats.totalCoinsEarned;
    case 'level': return p.playerLevel;
    case 'checkinStreak': return p.attendance.longest;
    case 'missions': return p.stats.missionsCompleted;
    case 'purchases': return p.stats.purchases;
    case 'codex': return Object.keys(p.codex).length;
    case 'food.bestScore': return food?.bestScore ?? 0;
    case 'food.bestStage': return food?.bestStage ?? 0;
    case 'food.clears': return food?.clears ?? 0;
    case 'sky.plays': return p.gameRecords['sky-battle']?.plays ?? 0;
    case 'sky.clears': return p.gameRecords['sky-battle']?.clears ?? 0;
    case 'sky.bestStage': return p.gameRecords['sky-battle']?.bestStage ?? 0;
    case 'mini.plays': return p.gameRecords['minigame-paradise']?.plays ?? 0;
    case 'mini.subCount': return Object.keys(p.gameRecords['minigame-paradise']?.subGames ?? {}).length;
  }
}

// ───────── 업적 ─────────
export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  metric: MetricKey;
  target: number;
  coins: number;
  xp: number;
  /** 달성 시 해금되는 칭호 */
  titleId?: string;
  /** 게임 연동(결과 수신)이 있어야 달성 가능한가 */
  needsGameLink?: boolean;
  group: 'common' | 'food' | 'sky' | 'mini';
}
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_adventure', name: '첫 모험 시작', desc: '게임천국에서 게임을 처음 실행하기', metric: 'launches', target: 1, coins: 10, xp: 20, group: 'common' },
  { id: 'first_complete', name: '첫 게임 완료', desc: '게임을 한 판 끝까지 마치기', metric: 'plays', target: 1, coins: 20, xp: 30, needsGameLink: true, group: 'common' },
  { id: 'first_clear', name: '첫 클리어', desc: '게임을 처음 클리어하기', metric: 'clears', target: 1, coins: 50, xp: 80, titleId: 't_cleared', needsGameLink: true, group: 'common' },
  { id: 'first_best', name: '첫 신기록', desc: '내 최고 점수를 처음 경신하기', metric: 'newBests', target: 1, coins: 20, xp: 30, needsGameLink: true, group: 'common' },
  { id: 'plays_10', name: '단골 모험가', desc: '누적 플레이 10회', metric: 'plays', target: 10, coins: 30, xp: 50, needsGameLink: true, group: 'common' },
  { id: 'plays_50', name: '게임천국 주민', desc: '누적 플레이 50회', metric: 'plays', target: 50, coins: 100, xp: 150, titleId: 't_regular', needsGameLink: true, group: 'common' },
  { id: 'coins_100', name: '코인 모으기', desc: '누적 코인 100개 획득', metric: 'coinsEarned', target: 100, coins: 10, xp: 20, group: 'common' },
  { id: 'coins_1000', name: '코인 부자', desc: '누적 코인 1,000개 획득', metric: 'coinsEarned', target: 1000, coins: 100, xp: 100, group: 'common' },
  { id: 'level_5', name: '레벨 5 달성', desc: '플레이어 레벨 5', metric: 'level', target: 5, coins: 30, xp: 0, group: 'common' },
  { id: 'level_10', name: '레벨 10 달성', desc: '플레이어 레벨 10', metric: 'level', target: 10, coins: 80, xp: 0, group: 'common' },
  { id: 'streak_3', name: '3일 연속 출석', desc: '3일 연속으로 접속하기', metric: 'checkinStreak', target: 3, coins: 20, xp: 20, group: 'common' },
  { id: 'streak_7', name: '일주일 출석', desc: '7일 연속으로 접속하기', metric: 'checkinStreak', target: 7, coins: 60, xp: 60, titleId: 't_streak', group: 'common' },
  { id: 'mission_10', name: '미션 수행가', desc: '일일 미션 10개 완료', metric: 'missions', target: 10, coins: 50, xp: 50, group: 'common' },
  { id: 'first_shop', name: '첫 쇼핑', desc: '상점에서 아이템 구매하기', metric: 'purchases', target: 1, coins: 10, xp: 10, group: 'common' },
  { id: 'codex_5', name: '도감 수집가', desc: '도감 5종 발견', metric: 'codex', target: 5, coins: 40, xp: 40, needsGameLink: true, group: 'common' },
  { id: 'food_stage_3', name: '두 발로 걷다', desc: 'Food Adventure 성장 3단계 도달', metric: 'food.bestStage', target: 3, coins: 30, xp: 50, needsGameLink: true, group: 'food' },
  { id: 'food_stage_4', name: '자이언트 곤룡', desc: 'Food Adventure 성장 4단계 도달', metric: 'food.bestStage', target: 4, coins: 60, xp: 80, titleId: 't_giant', needsGameLink: true, group: 'food' },
  { id: 'food_score_5000', name: '간식 사냥꾼', desc: 'Food Adventure 5,000점 달성', metric: 'food.bestScore', target: 5000, coins: 30, xp: 40, needsGameLink: true, group: 'food' },
  { id: 'food_score_20000', name: '간식 대왕', desc: 'Food Adventure 20,000점 달성', metric: 'food.bestScore', target: 20000, coins: 100, xp: 150, titleId: 't_snackking', needsGameLink: true, group: 'food' },
  { id: 'food_clear_3', name: '가족 엔딩 단골', desc: 'Food Adventure 3회 클리어', metric: 'food.clears', target: 3, coins: 80, xp: 100, needsGameLink: true, group: 'food' },
  // Sky Battle · Mini Game Land — 실제 게임 연동(결과 수신)이 있어야 달성 가능. 게임이 출시되면 자동으로 진행됨
  { id: 'sky_first', name: '첫 출격', desc: 'Sky Battle 첫 판 완료', metric: 'sky.plays', target: 1, coins: 20, xp: 30, needsGameLink: true, group: 'sky' },
  { id: 'sky_clear', name: '하늘 평정', desc: 'Sky Battle 클리어', metric: 'sky.clears', target: 1, coins: 80, xp: 120, needsGameLink: true, group: 'sky' },
  { id: 'mini_first', name: '미니게임 입문', desc: '미니게임 첫 판 완료', metric: 'mini.plays', target: 1, coins: 20, xp: 30, needsGameLink: true, group: 'mini' },
  { id: 'mini_three', name: '미니게임 탐험가', desc: '서로 다른 미니게임 3종 플레이', metric: 'mini.subCount', target: 3, coins: 60, xp: 80, needsGameLink: true, group: 'mini' },
  { id: 'mini_20', name: '미니게임 단골', desc: '미니게임 누적 20판', metric: 'mini.plays', target: 20, coins: 60, xp: 80, needsGameLink: true, group: 'mini' },
];

// ───────── 칭호 ─────────
export interface TitleDef {
  id: string;
  name: string;
  kind: 'default' | 'level' | 'achievement' | 'game';
  desc: string;
  /** 해금 조건 */
  level?: number;
  achievementId?: string;
}
export const TITLES: TitleDef[] = [
  { id: 'rookie', name: '고나 친구', kind: 'default', desc: '처음부터 가지고 있는 칭호' },
  { id: 't_lv5', name: '새싹 모험가', kind: 'level', desc: '레벨 5 달성', level: 5 },
  { id: 't_lv10', name: '용감한 고나', kind: 'level', desc: '레벨 10 달성', level: 10 },
  { id: 't_lv20', name: '전설의 모험가', kind: 'level', desc: '레벨 20 달성', level: 20 },
  { id: 't_cleared', name: '모험을 끝낸 자', kind: 'achievement', desc: '업적 「첫 클리어」', achievementId: 'first_clear' },
  { id: 't_regular', name: '게임천국 주민', kind: 'achievement', desc: '업적 「게임천국 주민」', achievementId: 'plays_50' },
  { id: 't_streak', name: '개근상', kind: 'achievement', desc: '업적 「일주일 출석」', achievementId: 'streak_7' },
  { id: 't_giant', name: '자이언트 곤룡', kind: 'game', desc: 'Food 업적 「자이언트 곤룡」', achievementId: 'food_stage_4' },
  { id: 't_snackking', name: '간식 대왕', kind: 'game', desc: 'Food 업적 「간식 대왕」', achievementId: 'food_score_20000' },
];
export const DEFAULT_TITLE = 'rookie';
export function isTitleUnlocked(p: PlayerData, t: TitleDef): boolean {
  if (t.kind === 'default') return true;
  if (t.level !== undefined) return p.playerLevel >= t.level;
  if (t.achievementId) return !!p.achievements[t.achievementId];
  return false;
}
export const unlockedTitles = (p: PlayerData): TitleDef[] => TITLES.filter((t) => isTitleUnlocked(p, t));

// ───────── 도감 (Food Adventure 에 실제 존재하는 것만. 이미지는 기존 에셋이 있는 것만) ─────────
export type CodexCategory = '가족' | '몬스터' | '보스' | '간식' | '특별';
export interface CodexDef {
  id: string;
  category: CodexCategory;
  name: string;
  desc: string;
  /** 기존 에셋(없으면 undefined → 이미지 없이 이름/설명만) */
  image?: string;
  /** 발견 조건 설명 + 판정 */
  condition: string;
  test: (p: PlayerData) => boolean;
}
const food = (p: PlayerData) => p.gameRecords['food-island'];
const stage = (p: PlayerData) => food(p)?.bestStage ?? 0;
const cleared = (p: PlayerData) => (food(p)?.clears ?? 0) >= 1;
const played = (p: PlayerData) => (food(p)?.plays ?? 0) >= 1;
const avatars = './assets/avatars/';
export const CODEX: CodexDef[] = [
  { id: 'c_gona', category: '가족', name: '고나', desc: '연두색 공룡 옷을 입은 아기. 이 이야기의 주인공!', image: `${avatars}gona.png`, condition: '처음부터 발견됨', test: () => true },
  { id: 'c_mom', category: '가족', name: '엄마', desc: '고나를 가장 먼저 품에 안아 주는 사람.', image: `${avatars}mom.png`, condition: 'Food Adventure 클리어(가족 엔딩)', test: cleared },
  { id: 'c_dad', category: '가족', name: '아빠', desc: '고나를 번쩍 안아 올리는 든든한 아빠.', image: `${avatars}dad.png`, condition: 'Food Adventure 클리어(가족 엔딩)', test: cleared },
  { id: 'c_imo', category: '가족', name: '이모', desc: '고나가 달려오길 기다리던 이모.', image: `${avatars}imo.png`, condition: 'Food Adventure 클리어(가족 엔딩)', test: cleared },
  { id: 'c_halmeoni', category: '가족', name: '할머니', desc: '뽀뽀가 많은 할머니.', image: `${avatars}halmeoni.png`, condition: 'Food Adventure 클리어(가족 엔딩)', test: cleared },
  { id: 'c_halabeoji', category: '가족', name: '할아버지', desc: '말없이 웃어 주는 할아버지.', image: `${avatars}halabeoji.png`, condition: 'Food Adventure 클리어(가족 엔딩)', test: cleared },
  { id: 'c_samchon', category: '가족', name: '삼촌', desc: '안경을 쓴 삼촌. 킁킁 냄새 맡기가 특기.', image: `${avatars}samchon.png`, condition: 'Food Adventure 클리어(가족 엔딩)', test: cleared },
  { id: 'c_kiss', category: '보스', name: '뽀뽀괴물', desc: '쪽쪽 뽀뽀로 고나를 괴롭히는 첫 번째 보스.', condition: '성장 3단계 도달(뽀뽀괴물을 물리침)', test: (p) => stage(p) >= 3 },
  { id: 'c_sniff', category: '보스', name: '킁카괴물', desc: '킁킁 냄새를 맡으며 고나를 흡입하는 최종 보스.', condition: 'Food Adventure 클리어', test: cleared },
  { id: 'c_glasses', category: '몬스터', name: '화학과안경잽이', desc: '커다란 안경에서 번쩍 빛이 나는 보라색 몬스터. 물약 플라스크를 던져요.', condition: '성장 3단계 도달(일반 몬스터 등장)', test: (p) => stage(p) >= 3 },
  { id: 'c_farter', category: '몬스터', name: '방구할배', desc: '배불뚝이 할아버지 몬스터. 돌진한 뒤 방귀를 뀌어요.', condition: '성장 3단계 도달(일반 몬스터 등장)', test: (p) => stage(p) >= 3 },
  { id: 'c_strawberry', category: '간식', name: '딸기', desc: '10점. 달콤한 기본 간식.', image: './assets/snacks/strawberry.png', condition: 'Food Adventure 한 판 완료', test: played },
  { id: 'c_banana', category: '간식', name: '바나나', desc: '20점. 길쭉하고 든든한 간식.', image: './assets/snacks/banana.png', condition: 'Food Adventure 성장 2단계 도달', test: (p) => stage(p) >= 2 },
  { id: 'c_cookie', category: '간식', name: '쿠키', desc: '30점. 바삭한 쿠키.', image: './assets/snacks/cookie.png', condition: 'Food Adventure 성장 3단계 도달', test: (p) => stage(p) >= 3 },
  { id: 'c_jelly', category: '특별', name: '별 젤리', desc: '50점짜리 반짝이는 특별 간식.', condition: 'Food Adventure 성장 4단계 도달', test: (p) => stage(p) >= 4 },
  { id: 'c_boomerang', category: '특별', name: '머리카락 부메랑', desc: '고나의 머리카락 한 가닥을 던져 괴물을 공격해요.', condition: '성장 3단계 도달(뽀뽀괴물전 승리 후 각성)', test: (p) => stage(p) >= 3 },
];

// ───────── 일일 미션 ─────────
export type MissionKind = 'visit' | 'launch' | 'result';
export interface MissionDef {
  id: string;
  title: string;
  desc: string;
  kind: MissionKind;
  /** visit: 방문 종류 / result: 판정 */
  visit?: string;
  target: number;
  coins: number;
  xp: number;
  /** 게임 연동(결과 수신) 필요 */
  needsGameLink: boolean;
}
export const MISSION_POOL: Record<'visit' | 'launch' | 'play' | 'challenge', MissionDef[]> = {
  visit: [
    { id: 'm_profile', title: '프로필 확인하기', desc: '내 프로필 화면 열기', kind: 'visit', visit: 'profile', target: 1, coins: 10, xp: 15, needsGameLink: false },
    { id: 'm_codex', title: '도감 구경하기', desc: '도감 화면 열기', kind: 'visit', visit: 'codex', target: 1, coins: 10, xp: 15, needsGameLink: false },
    { id: 'm_shop', title: '상점 둘러보기', desc: '상점 화면 열기', kind: 'visit', visit: 'shop', target: 1, coins: 10, xp: 15, needsGameLink: false },
    { id: 'm_islands', title: '섬 둘러보기', desc: '월드맵에서 섬 2곳 눌러 보기', kind: 'visit', visit: 'islands', target: 2, coins: 10, xp: 15, needsGameLink: false },
  ],
  launch: [{ id: 'm_launch', title: 'Food Adventure 출발!', desc: '게임천국에서 Food Adventure 실행하기', kind: 'launch', target: 1, coins: 15, xp: 15, needsGameLink: false }],
  play: [{ id: 'm_play1', title: '게임 1회 완료', desc: '게임을 한 판 끝까지 마치기', kind: 'result', visit: 'play', target: 1, coins: 20, xp: 20, needsGameLink: true }],
  challenge: [
    { id: 'm_score3000', title: '3,000점 달성', desc: 'Food Adventure 한 판에서 3,000점 넘기기', kind: 'result', visit: 'score3000', target: 1, coins: 20, xp: 20, needsGameLink: true },
    { id: 'm_best', title: '신기록 도전', desc: '내 최고 점수를 경신하기', kind: 'result', visit: 'best', target: 1, coins: 25, xp: 25, needsGameLink: true },
  ],
};
export const ALL_MISSIONS: MissionDef[] = [...MISSION_POOL.visit, ...MISSION_POOL.launch, ...MISSION_POOL.play, ...MISSION_POOL.challenge];
export const getMission = (id: string) => ALL_MISSIONS.find((m) => m.id === id);

// ───────── 상점 (코인 전용 · 꾸미기만 · 능력치 없음) ─────────
export interface ShopItem {
  id: string;
  slot: ShopSlot;
  name: string;
  price: number;
  desc: string;
  /** CSS 클래스 접미사 (ui/pixel.css 의 .sh-<slot>-<style>) */
  style: string;
}
export const SHOP_SLOTS: { id: ShopSlot; label: string }[] = [
  { id: 'frame', label: '프로필 테두리' },
  { id: 'nameplate', label: '닉네임 플레이트' },
  { id: 'titleStyle', label: '칭호 꾸미기' },
  { id: 'background', label: '프로필 배경' },
  { id: 'avatarDeco', label: '아바타 장식' },
];
export const SHOP_ITEMS: ShopItem[] = [
  { id: 'frame_basic', slot: 'frame', name: '기본 금테', price: 0, desc: '기본 테두리', style: 'basic' },
  { id: 'frame_leaf', slot: 'frame', name: '잎사귀 테두리', price: 150, desc: '풀빛 도트 테두리', style: 'leaf' },
  { id: 'frame_star', slot: 'frame', name: '별빛 테두리', price: 300, desc: '반짝이는 노란 테두리', style: 'star' },
  { id: 'frame_flame', slot: 'frame', name: '불꽃 테두리', price: 500, desc: '타오르는 주황 테두리', style: 'flame' },
  { id: 'frame_rainbow', slot: 'frame', name: '무지개 테두리', price: 800, desc: '일곱 빛깔 테두리', style: 'rainbow' },
  { id: 'np_default', slot: 'nameplate', name: '기본 이름표', price: 0, desc: '기본 닉네임 플레이트', style: 'default' },
  { id: 'np_mint', slot: 'nameplate', name: '민트 이름표', price: 120, desc: '시원한 민트색', style: 'mint' },
  { id: 'np_sunset', slot: 'nameplate', name: '노을 이름표', price: 250, desc: '주황-분홍 노을색', style: 'sunset' },
  { id: 'np_night', slot: 'nameplate', name: '밤하늘 이름표', price: 400, desc: '어두운 보라 바탕', style: 'night' },
  { id: 'ts_plain', slot: 'titleStyle', name: '기본 칭호', price: 0, desc: '기본 칭호 꾸밈', style: 'plain' },
  { id: 'ts_gold', slot: 'titleStyle', name: '황금 칭호', price: 100, desc: '금색 칭호', style: 'gold' },
  { id: 'ts_pink', slot: 'titleStyle', name: '분홍 칭호', price: 100, desc: '분홍색 칭호', style: 'pink' },
  { id: 'ts_ribbon', slot: 'titleStyle', name: '리본 칭호', price: 300, desc: '리본 모양 칭호', style: 'ribbon' },
  { id: 'bg_check', slot: 'background', name: '하늘 체크', price: 0, desc: '기본 배경', style: 'check' },
  { id: 'bg_grass', slot: 'background', name: '풀밭 배경', price: 150, desc: '초록 줄무늬', style: 'grass' },
  { id: 'bg_sunset', slot: 'background', name: '노을 배경', price: 250, desc: '노을빛 줄무늬', style: 'sunset' },
  { id: 'bg_night', slot: 'background', name: '밤하늘 배경', price: 350, desc: '보라 체크', style: 'night' },
  { id: 'bg_candy', slot: 'background', name: '사탕 배경', price: 350, desc: '분홍·하늘 체크', style: 'candy' },
  { id: 'deco_none', slot: 'avatarDeco', name: '장식 없음', price: 0, desc: '아바타 장식 해제', style: 'none' },
  { id: 'deco_sprout', slot: 'avatarDeco', name: '새싹', price: 150, desc: '머리 위 작은 새싹', style: 'sprout' },
  { id: 'deco_heart', slot: 'avatarDeco', name: '하트', price: 250, desc: '반짝이는 하트', style: 'heart' },
  { id: 'deco_star', slot: 'avatarDeco', name: '별', price: 250, desc: '노란 별', style: 'star' },
  { id: 'deco_crown', slot: 'avatarDeco', name: '왕관', price: 400, desc: '작은 금색 왕관', style: 'crown' },
];
export const getItem = (id: string) => SHOP_ITEMS.find((i) => i.id === id);
/** 슬롯별 기본(무료) 아이템 — 처음부터 보유·장착 */
export const DEFAULT_ITEMS: Record<ShopSlot, string> = { frame: 'frame_basic', nameplate: 'np_default', titleStyle: 'ts_plain', background: 'bg_check', avatarDeco: 'deco_none' };
