/**
 * 캐릭터 데이터 (이름·직업·필살기·대사·대표색) — 실제 가족 성격을 반영해 추후 수정할 수 있도록 로직과 분리.
 * 대사·필살기 이름은 여기만 고치면 선택 화면 등에 반영됨. (임시 설정)
 */
export type CharId = 'gona' | 'mom' | 'dad' | 'imo' | 'halmeoni' | 'halabeoji' | 'samchon';

export interface CharData {
  id: CharId;
  name: string;
  job: string;
  /** 일반 공격 / 차지 / 필살기 이름 */
  attack: string;
  charge: string;
  special: string;
  /** 출격 대사 · 필살기 대사 */
  sortieLine: string;
  specialLine: string;
  /** 능력 한 줄 설명 */
  skill: string;
  desc: string;
  color: string;
  /** 현재 게임 로직에 구현된 동료인지 (삼촌은 로직 미구현 — 에셋·데이터만 선등록) */
  implemented: boolean;
}

export const CHARACTERS: Record<CharId, CharData> = {
  gona: { id: 'gona', name: '고나', job: '아기 익룡 전사', attack: '별사탕탄', charge: '초강력 응애파', special: '황금 익룡의 포효', sortieLine: '아부부!', specialLine: '아부부부!!', skill: '주인공', desc: '겁은 없지만 간식 앞에서는 이성을 잃는 아기', color: '#78d246', implemented: true },
  mom: { id: 'mom', name: '엄마', job: '하트 마녀', attack: '하트 탄막', charge: '대형 하트 폭발', special: '하트 스톰', sortieLine: '우리 고나 건드리지 마!', specialLine: '우리 고나 건드리지 마!', skill: '하트 광역 공격', desc: '사방으로 퍼지는 하트 폭죽!', color: '#d24696', implemented: true },
  dad: { id: 'dad', name: '아빠', job: '증기 전사', attack: '직선 에너지탄', charge: '로켓 펀치', special: '스팀 브레이커', sortieLine: '고나야, 아빠만 믿어!', specialLine: '아빠의 슈퍼 펀치!', skill: '강력한 직선 공격', desc: '적 탄을 지우는 굵은 광선', color: '#4682e6', implemented: true },
  imo: { id: 'imo', name: '이모', job: '별빛 마법 포수', attack: '별빛 유도탄', charge: '다중 마법 포격', special: '스타 캐논 버스트', sortieLine: '조카 사랑의 힘을 보여주겠어!', specialLine: '우리 고나한테는 이모가 최고지!', skill: '유도 마법탄', desc: '적을 쫓아가는 마법 구슬', color: '#32c8be', implemented: true },
  halmeoni: { id: 'halmeoni', name: '할머니', job: '연금술 치유사', attack: '폭발 물약 투척', charge: '대형 물약 폭발', special: '골든 힐링', sortieLine: '고나 밥 먹어야 되는데!', specialLine: '고나 밥 먹어야 되니까 비켜라!', skill: '폭발 물약 + 회복', desc: '터지는 물약을 던지고 가끔 하트 1칸 회복', color: '#46d278', implemented: true },
  halabeoji: { id: 'halabeoji', name: '할아버지', job: '수호 기사', attack: '은빛 창 투척', charge: '방패 돌격', special: '가디언 실드', sortieLine: '걱정 마라. 할아버지가 있다.', specialLine: '걱정 마라. 할아버지가 있다.', skill: '보호막 + 관통 창', desc: '탄 1발을 막는 방패, 관통하는 은빛 창', color: '#4664c8', implemented: true },
  samchon: { id: 'samchon', name: '안경쟁이 삼촌', job: '천재 괴짜 발명가', attack: '전기 에너지탄', charge: '자동 추적 드론', special: '메가 인벤션', sortieLine: '이번 발명품은 진짜 완벽해!', specialLine: '이론상 완벽한데… 왜 터지지?', skill: '자동 추적 드론', desc: '지그재그로 적을 쫓는 전기탄', color: '#f0c332', implemented: true },
};

export const CHAR_ORDER: CharId[] = ['gona', 'mom', 'dad', 'imo', 'halmeoni', 'halabeoji', 'samchon'];
