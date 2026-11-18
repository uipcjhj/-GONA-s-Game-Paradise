/**
 * 응가 대탈출 스토리 대사 (응가 테마 전용 — 케이크 테마는 대사가 없어서 엔진이 그대로 진행)
 *
 *  - 엔진이 대본의 { talk } / { villain } 단계, 보스 등장·페이즈·격파 순간에 `talk(key)` 를 부르면
 *    이 표에 대사가 있을 때만 전투를 멈추고 대화창을 띄움 (SkyGame 의 TalkBox)
 *  - 'partner' 줄은 선택한 동료마다 다른 대사 (by)
 *  - 뽀글이·꾸덕이 face: 0 보통 · 1 놀림 · 2 당황 (villain/*-face.png 3칸)
 */
import { THEME_ID } from './theme';
import type { FamilyId } from './engine';
import type { Step } from './stages';

export type Speaker = 'gona' | 'partner' | FamilyId | 'bbo' | 'kku' | 'mid' | 'boss' | 'narr' | 'train';
export interface Line {
  who: Speaker;
  text?: string;
  /** who='partner' 일 때 동료별 대사 */
  by?: Partial<Record<FamilyId, string>>;
  face?: 0 | 1 | 2;
}
export type TalkKey =
  | 'start' | 'prank' | 'callMid' | 'midIn' | 'midDown' | 'midFlee' | 'callBoss' | 'bossIn' | 'bossP2' | 'bossP3' | 'bossDown';
type StageStory = Partial<Record<TalkKey, Line[]>>;

const P = (by: Partial<Record<FamilyId, string>>): Line => ({ who: 'partner', by });

const S1: StageStory = {
  start: [
    { who: 'gona', text: '아부부! 응가 열차가 멈춰 있고나!' },
    P({ mom: '우리 고나, 엄마가 편하게 해 줄게!', dad: '막힌 길은 아빠가 뚫는다!', imo: '좋아, 이모랑 출격하자!', halmeoni: '할미가 다 고쳐 주마~', halabeoji: '고나야, 할아비 방패 뒤로!', samchon: '유산균 출동 준비 완료!' }),
  ],
  prank: [
    { who: 'bbo', face: 1, text: '킥킥! 꼬마 익룡이다! 여긴 우리 꾸덕꾸덕 길이야!' },
    { who: 'kku', face: 1, text: '쌀알 병사들아~ 저 녀석 막아라!' },
    P({ mom: '어머, 저 장난꾸러기들은 누구니?', dad: '저 녀석들이 길을 막은 범인이군!', imo: '흥, 딱 봐도 수상한 녀석들인데?', halmeoni: '아이고, 저런 말썽꾸러기들 같으니!', halabeoji: '나쁜 균 냄새가 난다. 조심해라!', samchon: '저건… 변비마왕의 부하들이야!' }),
  ],
  callMid: [
    { who: 'bbo', face: 2, text: '으악, 생각보다 세잖아!' },
    { who: 'kku', face: 1, text: '냄비 장군님~ 부탁해요!' },
  ],
  midIn: [{ who: 'mid', text: '뜨끈한 국물 맛 좀 봐라!' }],
  midDown: [{ who: 'mid', text: '끓어 넘친다아~' }],
  midFlee: [{ who: 'mid', text: '흥! 국물이 식었다, 후퇴!' }],
  callBoss: [
    { who: 'bbo', face: 2, text: '히익, 장군님이 졌어!' },
    { who: 'kku', face: 2, text: '골렘 대장님~! 살려 주세요~!' },
  ],
  bossIn: [
    { who: 'boss', text: '떡 하니 막아 주마!' },
    P({ mom: '저 큰 떡이 길을 막고 있었구나!', dad: '떡이든 뭐든 물대포로 불려 주지!', imo: '쫀득한 건 프룬으로 녹여야지!', halmeoni: '떡은 꼭꼭 씹어야 하는 법이여~', halabeoji: '쌀알 탄은 방패로 막아 주마!', samchon: '소화 효소… 아니, 유산균 투입!' }),
  ],
  bossP2: [{ who: 'boss', text: '쫀득쫀득! 아직이다!' }],
  bossP3: [{ who: 'boss', text: '딱딱하게 굳어 주마아!' }],
  bossDown: [
    { who: 'boss', text: '떡… 떡이 풀린다아…' },
    { who: 'train', text: '뿌우우~! (응가 열차가 한 칸 전진했다!)' },
    { who: 'gona', text: '다음 길로 가자고나!' },
  ],
};

const S2: StageStory = {
  start: [
    { who: 'gona', text: '콜록! 가스 냄새가 가득하고나!' },
    P({ mom: '숨 참아! 엄마가 깨끗이 씻겨 줄게!', dad: '여긴 환기가 필요하겠는걸!', imo: '향긋한 프룬 향으로 덮어 주지!', halmeoni: '할미가 배를 살살 문질러 주마~', halabeoji: '가스 따위 방패로 막는다!', samchon: '유산균이 가스를 줄여 줄 거야!' }),
  ],
  prank: [
    { who: 'kku', face: 1, text: '뿡뿡 가스 풍선 선물이다~!' },
    P({ mom: '으으, 고나야 숨 꾹 참아!', dad: '이 녀석들, 또 너희냐!', imo: '(코 막고) …진짜 최악이야.', halmeoni: '에구머니, 냄새야!', halabeoji: '저 녀석들이 가스를 퍼뜨린 거였군!', samchon: '가스 농도가 위험 수준이야!' }),
  ],
  callMid: [{ who: 'kku', face: 1, text: '방귀 풍선 비행정, 출격~!' }],
  midIn: [{ who: 'mid', text: '빵빵하게 부풀어 주마!' }],
  midDown: [{ who: 'mid', text: '피융~ 바람 빠진다~' }],
  midFlee: [{ who: 'mid', text: '풍선이 터지기 전에 후퇴다!' }],
  callBoss: [
    { who: 'bbo', face: 2, text: '버섯대왕님! 저 꼬마가 너무 세요!' },
    { who: 'kku', face: 1, text: '대왕님 방귀 한 방이면 끝이에요~!' },
  ],
  bossIn: [{ who: 'boss', text: '뿡! 이 숲은 내 가스로 가득하다!' }],
  bossP2: [{ who: 'boss', text: '갓이 갈라진다! 뿌우웅!' }],
  bossP3: [{ who: 'boss', text: '더, 더 부풀어 주마아아!' }],
  bossDown: [
    { who: 'boss', text: '피시시시… 바람 빠졌다…' },
    { who: 'train', text: '뿌우우~! (가스 구름 터널이 열렸다!)' },
  ],
};

const S3: StageStory = {
  start: [
    { who: 'gona', text: '톱니가 마구 돌아가고나!' },
    P({ mom: '공장이 아파서 이러는 걸 거야.', dad: '기계는 아빠가 좀 알지! 가자!', imo: '시끄러워라… 빨리 끝내자!', halmeoni: '쉬엄쉬엄 돌아야지, 원.', halabeoji: '파편 조심! 방패 뒤로!', samchon: '이 공장, 원래는 소화를 돕는 곳인데…' }),
  ],
  prank: [
    { who: 'kku', face: 1, text: '공장장은 내가 조종하고 있지롱!' },
    P({ mom: '공장장님이 조종당하고 있었다니!', dad: '이 녀석들 짓이었구나!', imo: '꾸덕이, 너 딱 걸렸어.', halmeoni: '남의 공장에서 무슨 짓이여!', halabeoji: '공장장을 풀어 줘야겠다!', samchon: '내 발명품으로 고쳐 주마!' }),
  ],
  callMid: [{ who: 'kku', face: 1, text: '감자 로봇 비행정, 가동!' }],
  midIn: [{ who: 'mid', text: '감자 감자! 침입자 발견!' }],
  midDown: [{ who: 'mid', text: '감자… 으깨졌다…' }],
  midFlee: [{ who: 'mid', text: '배터리 부족! 충전하러 간다!' }],
  callBoss: [
    { who: 'bbo', face: 2, text: '믹서님! 다 갈아 버려요!' },
    { who: 'kku', face: 2, text: '우, 우린 먼저 갈게요~!' },
  ],
  bossIn: [{ who: 'boss', text: '갈아 버린다! 3000 RPM!' }],
  bossP2: [{ who: 'boss', text: '뚜껑 오픈! 레이저 가동!' }],
  bossP3: [{ who: 'boss', text: '과열 모드! 멈출 수 없다!' }],
  bossDown: [
    { who: 'boss', text: '과열… 과열… 퓨즈 나감…' },
    { who: 'train', text: '뿌우우~! (컨베이어 대교가 다시 움직인다!)' },
  ],
};

const S4: StageStory = {
  start: [
    { who: 'gona', text: '바다가 말라 가고나… 물이 필요해!' },
    P({ mom: '물이라면 엄마한테 맡겨!', dad: '수분 충전 완료! 가자!', imo: '프룬주스도 수분이라고!', halmeoni: '물 한 모금씩 꼭꼭 마시자~', halabeoji: '바닷길은 할아비가 지킨다!', samchon: '물이 돌아와야 다음 땅이 안 굳어!' }),
  ],
  prank: [
    { who: 'bbo', face: 1, text: '물방울은 우리가 다 훔쳤지롱~' },
    P({ mom: '남의 물을 훔치면 못써!', dad: '물대포 맛 좀 볼래?', imo: '어휴, 진짜 얄미워!', halmeoni: '물 도둑은 혼나야지!', halabeoji: '저 녀석들부터 붙잡아라!', samchon: '물방울 회수 작전 개시!' }),
  ],
  callMid: [{ who: 'kku', face: 1, text: '도둑 대장님, 물방울 지켜 주세요!' }],
  midIn: [{ who: 'mid', text: '물방울은 한 방울도 못 줘!' }],
  midDown: [{ who: 'mid', text: '내 보물 물방울이~!' }],
  midFlee: [{ who: 'mid', text: '물방울 챙겨서 도망이다!' }],
  callBoss: [
    { who: 'bbo', face: 2, text: '크라켄님! 꼬마가 와요!' },
    { who: 'kku', face: 2, text: '말랑말랑하게 혼내 주세요~!' },
  ],
  bossIn: [{ who: 'boss', text: '말랑말랑, 물은 다 내 거야!' }],
  bossP2: [{ who: 'boss', text: '흐물… 몸이 투명해진다!' }],
  bossP3: [{ who: 'boss', text: '거대 물결로 쓸어 주마!' }],
  bossDown: [
    { who: 'boss', text: '흐물흐물… 물 돌려줄게…' },
    { who: 'train', text: '뿌우우~! (물길이 돌아왔다!)' },
  ],
};

const S5: StageStory = {
  start: [
    { who: 'gona', text: '땅이 딱딱하게 굳어 버렸고나…' },
    P({ mom: '괜찮아, 다 같이 있잖아.', dad: '함께라면 뚫을 수 있어!', imo: '이 정도 성벽쯤이야!', halmeoni: '굳은 건 살살 풀어 주면 된단다~', halabeoji: '할아비가 앞장서마!', samchon: '유산균 총동원이다!' }),
  ],
  prank: [
    { who: 'kku', face: 1, text: '이 성은 꾸덕꾸덕 굳어서 절대 못 뚫지!' },
    P({ mom: '흥, 고나는 절대 포기 안 해!', dad: '두고 봐라, 다 뚫어 줄 테니!', imo: '그 말 꼭 기억해 둬.', halmeoni: '할미 손이 약손인 걸 모르는구나!', halabeoji: '이 방패보다 단단할까?', samchon: '굳은 건 녹이면 되지!' }),
  ],
  callMid: [{ who: 'bbo', face: 1, text: '유령 대장님~ 무서운 거 보여 줘요!' }],
  midIn: [{ who: 'mid', text: '으스스스… 막힘의 저주를 받아라!' }],
  midDown: [{ who: 'mid', text: '으으… 시원해진다아…' }],
  midFlee: [{ who: 'mid', text: '으스스… 다음에 보자!' }],
  callBoss: [
    { who: 'kku', face: 2, text: '철벽 기사님! 저희 좀 지켜 주세요!' },
    { who: 'bbo', face: 2, text: '성문만큼은 꼭 막아요~!' },
  ],
  bossIn: [{ who: 'boss', text: '이 성문은 아무도 못 지나간다, 딱!' }],
  bossP2: [{ who: 'boss', text: '가, 갑옷에 금이…?!' }],
  bossP3: [{ who: 'boss', text: '갑옷을 벗고 폭주한다!' }],
  bossDown: [
    { who: 'boss', text: '부… 부서졌다…!' },
    { who: 'train', text: '뿌우우~! (굳은 성문이 열렸다! 마지막 성이 보인다!)' },
  ],
};

const S6: StageStory = {
  start: [
    { who: 'gona', text: '마지막 성이고나… 다 같이 힘을 모아 줘!' },
    P({ mom: '엄마가 끝까지 함께할게!', dad: '마지막이다, 전력으로 간다!', imo: '이모의 퍼플 파워, 전부 쏟아 줄게!', halmeoni: '할미 손은 약손! 끝까지 지켜 주마!', halabeoji: '이 방패, 마지막까지 든든할 거다!', samchon: '유산균 특공대, 최종 작전!' }),
  ],
  prank: [
    { who: 'bbo', face: 1, text: '마왕님 성에 온 걸 환영… 아니, 돌아가!' },
    P({ mom: '이번엔 안 봐줄 거야!', dad: '끝까지 귀찮게 하는구나!', imo: '마지막 경고야, 비켜.', halmeoni: '아직도 정신을 못 차렸구먼!', halabeoji: '고나야, 할아비 옆에 꼭 붙어라!', samchon: '이번엔 놓치지 않는다!' }),
  ],
  callMid: [{ who: 'kku', face: 1, text: '호위 기사님, 마지막 방어선이에요!' }],
  midIn: [{ who: 'mid', text: '마왕님께는 한 발짝도 못 간다!' }],
  midDown: [{ who: 'mid', text: '마왕님… 죄송합니다…' }],
  midFlee: [{ who: 'mid', text: '마왕님께 보고하러 간다!' }],
  callBoss: [
    { who: 'bbo', face: 2, text: '마, 마왕님! 저 꼬마 너무 세요!' },
    { who: 'kku', face: 2, text: '저희는 이만 퇴근할게요~!' },
    { who: 'bbo', face: 2, text: '야, 같이 가! 나 두고 가지 마!' },
  ],
  bossIn: [
    { who: 'boss', text: '흥, 누구도 이 길은 못 지나간다! 꽉!' },
    P({ mom: '우리 고나 길은 엄마가 열어!', dad: '막힌 건 뚫으라고 있는 거다!', imo: '꽉막혀? 이름부터 답답하네.', halmeoni: '할미 약손 맛 좀 보거라!', halabeoji: '마지막 봉인, 방패로 버텨 주마!', samchon: '유산균 전원 출격!' }),
  ],
  bossP2: [{ who: 'boss', text: '으아아, 막히고 막혔다!' }],
  bossP3: [
    { who: 'boss', text: '응가 운석으로 전부 막아 주마!' },
    { who: 'gona', text: '가족들아, 마지막 봉인을 깨자!' },
    P({ mom: '쏴아아아, 마지막 목욕 폭포!', dad: '수분 충전 최대치!', imo: '퍼플 버스트, 풀파워!', halmeoni: '할미 손은 약손이다!', halabeoji: '나쁜 세균은 못 지나간다!', samchon: '유산균 특공대, 전원 돌격!' }),
  ],
  bossDown: [
    { who: 'boss', text: '뻥… 뚫…렸다…' },
  ],
};

const STORY: StageStory[] = [S1, S2, S3, S4, S5, S6];

/**
 * 대화 방식 (실제 플레이 템포 기준으로 압축)
 *  - 'talk' : 전투를 멈추고 대화창 — 보스 등장 · 보스 격파 · FINAL 3페이즈(가족 협력) 만
 *  - 'bark' : 전투를 멈추지 않는 짧은 무전창 (화면 위쪽, 자동으로 사라짐) — 나머지 전부
 */
export function talkMode(stage: number, key: TalkKey): 'talk' | 'bark' {
  if (key === 'bossIn' || key === 'bossDown') return 'talk';
  if (stage === 6 && key === 'bossP3') return 'talk';
  return 'bark';
}
/** 무전창 한 줄 표시 시간(초) — 빌런이 그동안 제자리에서 떠들다가 움직임 */
export function barkSeconds(text: string): number {
  return 1.5 + [...text].length * 0.055;
}

/** 이 스테이지·순간에 대사가 있는지 (케이크 테마는 항상 없음) */
export function talkLines(stage: number, key: TalkKey): Line[] | null {
  if (THEME_ID !== 'poop') return null;
  const l = STORY[stage - 1]?.[key];
  return l && l.length ? l : null;
}

/** 대본에 스토리 단계를 끼워 넣음 (응가 테마만): 시작 대화 · 빌런 장난 · 빌런의 중간보스/보스 호출 */
export function applyStory(scripts: { id: number; script: Step[] }[]): void {
  if (THEME_ID !== 'poop') return;
  for (const st of scripts) {
    const s = st.script;
    if (s.some((q) => 'talk' in q || 'villain' in q)) continue;
    const b = s.findIndex((q) => 'banner' in q);
    s.splice(b + 1, 0, { talk: 'start' });
    const mid = s.findIndex((q) => 'midboss' in q);
    // 중간보스 전 편대의 절반쯤 (대기 단계 뒤)에 장난
    let pr = Math.max(b + 3, Math.round(mid * 0.5));
    while (pr < mid && !('wait' in s[pr - 1])) pr++;
    s.splice(pr, 0, { villain: 'prank' });
    s.splice(s.findIndex((q) => 'midboss' in q), 0, { villain: 'callMid' });
    s.splice(s.findIndex((q) => 'warning' in q), 0, { villain: 'callBoss' });
  }
}
