/**
 * 테마 팩 — 같은 엔진·같은 가족·같은 스테이지 구조에 '이야기 옷'만 갈아입힘.
 *  - cake (기본값): 기존 '고나의 첫 생일 케이크' 버전. 아무 설정이 없으면 항상 이 팩 → 기존 공개 테스트판과 똑같이 동작.
 *  - poop: '고나의 응가 대탈출 대작전' 신규 버전 (빌드 때 VITE_SKY_THEME=poop).
 * 그래픽은 아직 신규 제작 전이라 poop 팩도 기존 에셋을 씀 → 이름만 바뀐 것은 화면에 '임시 그래픽'으로 표시.
 */
import type { StageDef } from './stages';

export type ThemeId = 'cake' | 'poop';
export const THEME_ID: ThemeId = (import.meta.env.VITE_SKY_THEME as string | undefined) === 'poop' ? 'poop' : 'cake';

export interface Slide { img: 'family' | string; text: string }
interface StageText { sub: string; name: string; story: string; midName: string; midIntro: string; bossName: string; bossIntro: string; banner?: string }
export interface ThemePack {
  id: ThemeId;
  titleLine: string;        // 타이틀 아래 부제
  copy: string;             // 타이틀 하단 안내
  opening: Slide[];         // 첫 플레이 전 오프닝 (스킵 가능)
  ending: Slide[];          // 엔딩 컷신
  credits: [string, string][];
  stages: StageText[];      // 1~6
  tempNote: boolean;        // 기존 그래픽을 쓰는 임시 연출임을 표시
}

const CAKE: ThemePack = {
  id: 'cake',
  titleLine: '',
  copy: '6 STAGES',
  opening: [],
  ending: [
    { img: 'v2/title/keyart.jpg', text: '마왕성의 심장이 부서지자, 하늘을 뒤덮던 어둠이 걷혔다.' },
    { img: 'v2/chars/gona/illust.png', text: '고나: "아부부부!" — 작은 날개로 끝까지 날아낸 고나.' },
    { img: 'family', text: '엄마 · 아빠 · 이모 · 할머니 · 할아버지 · 삼촌. 온 가족이 함께였기에 가능했던 비행.' },
    { img: 'v2/title/keyart.jpg', text: '부유왕국에 다시 노을빛이 돌아오고, 고나네 가족은 집으로 향한다.' },
    { img: 'v2/chars/gona/illust.png', text: '그리고 고나의 다음 모험은… 게임천국 어딘가에서 계속된다!' },
  ],
  credits: [
    ["GONA's Sky Adventure", ''], ['기획 · 원작', '고나네 가족'], ['캐릭터', '고나 · 엄마 · 아빠 · 이모 · 할머니 · 할아버지 · 안경쟁이 삼촌'],
    ['게임 프로그래밍 · 사운드 합성', 'Claude Code'], ['음악 · 효과음', '오리지널 합성 (tools/sky-audio)'], ['원화 · 스프라이트', '승인 원화 + 스테이지 2~6 임시 그래픽'],
    ['스페셜 땡스', '게임천국에 놀러 와 준 모든 친구들'], ['', 'THANK YOU FOR PLAYING!'],
  ],
  stages: [], // 비워 두면 stages.ts 의 원래 문구를 그대로 씀
  tempNote: false,
};

const POOP: ThemePack = {
  id: 'poop',
  titleLine: 'The Great Poo Escape! · 고나의 응가 대탈출 대작전',
  copy: '6 STAGES · 신규 세계관 테스트',
  opening: [
    { img: 'family', text: '따뜻한 오후. 고나가 가족들과 첫 이유식을 먹고 있어요.' },
    { img: 'v2/chars/gona/illust.png', text: '꾸르르르륵……? 고나의 배에서 이상한 소리가 나요.' },
    { img: 'family', text: '엄마: "어머, 우리 고나 왜 그래?"  아빠: "응가하려는 거 아니야?"' },
    { img: 'v2/chars/gona/illust.png', text: '끙끙대던 고나가 결국 울음을 터뜨리고, 지쳐서 잠이 들어요.' },
    { img: 'v2/title/keyart.jpg', text: '배 속을 상상하며 꾸는 꿈. 눈을 뜨자 하늘에 거대한 숟가락이 떠 있었어요!' },
    { img: 'family', text: '음식물 괴물들이 왕국의 길을 막고 응가 열차를 세웠어요. 가족들이 함께 출격합니다!' },
  ],
  ending: [
    { img: 'v2/title/keyart.jpg', text: '변비마왕 꽉막혀가 쓰러지자, 막혔던 소화왕국의 길이 열렸다.' },
    { img: 'v2/chars/gona/illust.png', text: '응가 열차가 출발하고, 왕국 전체가 환호한다. 고나: "해냈고나!"' },
    { img: 'v2/chars/gona/illust.png', text: '…잠시 정적. 고나: "끄으으응…… 뿡!"' },
    { img: 'family', text: '엄마: "어머! 고나 응가했어!"  아빠: 만세!  이모: (코 막고 웃음)  할머니: 방글방글' },
    { img: 'family', text: '할아버지: 능청스럽게 웃음 · 삼촌: 발명품처럼 기뻐함 · 고나: 가족 품에 안겨 해맑게 웃음' },
    { img: 'v2/title/keyart.jpg', text: '세상에서 가장 작은 영웅의, 가장 위대한 탈출.' },
  ],
  credits: [
    ["GONA's Sky Adventure", 'The Great Poo Escape!'], ['기획 · 원작', '고나네 가족'], ['캐릭터', '고나 · 엄마 · 아빠 · 이모 · 할머니 · 할아버지 · 삼촌'],
    ['게임 프로그래밍 · 사운드 합성', 'Claude Code'], ['음악 · 효과음', '오리지널 합성 (tools/sky-audio)'], ['원화 · 스프라이트', '가족 원화·비행 스프라이트 · STAGE 1 신규 그래픽 (STAGE 2~6 은 임시 그래픽 — 정식 그림 제작 전)'],
    ['스페셜 땡스', '게임천국에 놀러 와 준 모든 친구들'], ['', 'THANK YOU FOR PLAYING!'],
  ],
  stages: [
    { sub: '이유식 왕국', name: '이유식 왕국', story: '이유식 왕국의 반란 — 꿈속 소화왕국의 이유식 강 위로 쌀알 병사들이 쏟아진다. 응가 열차를 세운 건 누구?', midName: '이유식 냄비 장군', midIntro: '뜨거운 국물을 튀기며 등장한 냄비 장군!', bossName: '거대 쌀떡 골렘', bossIntro: '온 왕국의 쌀알을 뭉쳐 만든 거대한 떡 골렘!' },
    { sub: '버섯가스 숲', name: '버섯가스 숲', story: '버섯숲의 가스 대폭발 — 숲의 가스 구름이 부풀어 오른다. 뿡뿡 버섯대왕이 깨어났다!', midName: '방귀 풍선 비행정', midIntro: '가스 풍선이 한가득 떠 있다!', bossName: '뿡뿡 버섯대왕', bossIntro: '버섯 갓마다 가스를 가득 품은 대왕 버섯!' },
    { sub: '소화 공장', name: '소화 공장', story: '소화공장의 폭주 — 소화 공장의 톱니가 멈추지 않는다. 컨베이어가 미친 듯이 돌아간다!', midName: '감자 로봇 비행정', midIntro: '감자로 만든 로봇 비행정이 공장을 지킨다!', bossName: '철벽 믹서 3000', bossIntro: '모든 것을 갈아 버리는 거대 믹서!' },
    { sub: '수분의 바다', name: '수분의 바다', story: '수분의 바다 — 바다가 말라 간다. 물방울 도둑들이 길을 막았다.', midName: '물방울 도둑 대장', midIntro: '훔친 물방울을 잔뜩 두른 도둑 대장!', bossName: '젤리 크라켄', bossIntro: '온몸이 말랑한 젤리로 된 거대 문어!' },
    { sub: '딱딱 응가 성문', name: '딱딱 응가 성문', story: '딱딱한 응가의 성 — 굳어 버린 성벽 너머, 돌멩이 병사들이 기다린다.', midName: '변비 유령 대장', midIntro: '굳은 성벽에서 유령들이 쏟아져 나온다!', bossName: '철벽 똥기사', bossIntro: '단단하게 굳은 갑옷의 기사가 길을 막는다!' },
    { sub: '변비마왕성', name: '변비마왕성', story: '변비마왕의 최후 — 막힌 성문 너머, 변비마왕 꽉막혀가 기다린다. 가족과 함께 마지막 봉인을 깨자!', midName: '꽉막혀의 호위 기사', midIntro: '마왕을 지키는 마지막 기사!', bossName: '변비마왕 꽉막혀', bossIntro: '세상에서 가장 막힌 마왕, 꽉막혀 등장!' },
  ],
  tempNote: true,
};

export const THEME: ThemePack = THEME_ID === 'poop' ? POOP : CAKE;

/** 스테이지 정의에 테마 문구를 덮어씀 (기본 cake 팩은 stages 가 비어 있어서 아무것도 바꾸지 않음) */
export function applyTheme(stages: StageDef[]): void {
  if (!THEME.stages.length) return;
  stages.forEach((st, i) => {
    const t = THEME.stages[i];
    if (!t) return;
    st.sub = t.sub;
    st.name = t.name;
    st.story = t.story;
    st.midboss.name = t.midName;
    st.midboss.intro = t.midIntro;
    st.boss.name = t.bossName;
    st.boss.intro = t.bossIntro;
    if (THEME.tempNote) st.temp = true;
    for (const q of st.script) if ('banner' in q) q.sub = t.sub;
  });
}

// ───────── 가족 문구 (직업 · 필살기 이름 · 설명) — 응가 팩에서만 값이 있음 ─────────
export interface FamilyText { job: string; special: string; specialDesc: string; attack?: string }
type FamKey = 'mom' | 'dad' | 'imo' | 'halmeoni' | 'halabeoji' | 'samchon' | 'gona';
const FAMILY_POOP: Partial<Record<FamKey, FamilyText>> = {
  mom: { attack: '물방울 부채꼴', job: '목욕의 물마법사', special: '쏴아아아! 목욕 폭포', specialDesc: '거대한 물줄기와 거품이 화면을 채우는 넓은 범위 공격' },
  dad: { attack: '직선 물대포', job: '수분충전 소방관', special: '수분충전! 급수 브레이커', specialDesc: '물을 마시고 쏘는 굵은 직선 수압 빔' },
  imo: { attack: '프룬 과즙탄', job: '프룬의 보랏빛 요정', special: '프룬주스 퍼플 버스트', specialDesc: '보라색 프룬 에너지를 전방으로 짧고 화려하게 발사' },
  halmeoni: { attack: '약손 포션 투척', job: '불꽃의 약손', special: '현이 배는 똥배! 할미 손은 약손!', specialDesc: '체력 1칸 회복 (최대 체력 초과 없음) · 불꽃과 하트' },
  halabeoji: { attack: '방패 충격파', job: '유해균 방패 수호자', special: '나쁜 세균은 못 지나간다!', specialDesc: '거대한 방패 보호막 (지속 시간 제한)' },
  samchon: { attack: '유산균 에너지탄', job: '유산균 소환사', special: '출동! 유산균 특공대!', specialDesc: '유산균 3마리가 고나 주변을 돌며 위로 공격 (3초)' },
  gona: { job: '아기 익룡 전사', special: '황금 익룡의 포효', specialDesc: '' },
};
/** 현재 팩의 가족 문구 (케이크 팩은 undefined → 원래 문구 사용) */
export function familyText(id: FamKey): FamilyText | undefined {
  return THEME.id === 'poop' ? FAMILY_POOP[id] : undefined;
}
