/**
 * 응가 대탈출 보스 부위 파괴 (parts.png 가 있는 스테이지만)
 *  A = 양옆 부위 2개 (공격 담당 · 부수면 그 공격이 사라짐)
 *  B = 가운데 부위 1개 (약점 덮개 · 방패 · 봉인 — 부수면 약점 노출 / 보스가 약해지거나 오히려 날뛰기 시작)
 *  위치(dx, dy)는 보스 그림(논리 약 110×120) 기준 — 두 팔 아래 · 가슴/머리
 */
import type { PartDef } from './stages';

type Spec = { a: Omit<PartDef, 'dx' | 'art'> & { dx: number }; b: Omit<PartDef, 'art'> };
const S: Record<number, Spec> = {
  // 1 거대 쌀떡 골렘: 떡주먹 포(조준탄) · 숟가락 흉갑(약점 덮개)
  1: {
    a: { name: '떡주먹 포', cell: 0, dx: 44, dy: 18, hp: 70, hr: 13, k: 0.4, fire: 'aim', cd: 2.2, bonus: 3000, fx: { cut: ['aimBurst'] } },
    b: { name: '숟가락 흉갑', cell: 2, dx: 0, dy: 20, hp: 120, hr: 13, k: 0.42, fire: 'none', cd: 9, bonus: 6000, fx: { cover: true, weak: 2.2 } },
  },
  // 2 뿡뿡 버섯대왕: 포자 포드(원형탄) · 가스탱크 왕관(부수면 가스가 새어 약해지지만 포자 소나기가 빨라짐)
  2: {
    a: { name: '포자 포드', cell: 0, dx: 44, dy: 12, hp: 84, hr: 13, k: 0.4, fire: 'ring', cd: 3.0, bonus: 3000, fx: { cut: ['sporeRain'] } },
    b: { name: '가스탱크 왕관', cell: 2, dx: 0, dy: -40, hp: 150, hr: 14, k: 0.42, fire: 'none', cd: 9, bonus: 7000, fx: { armor: 0.75, rage: ['flowerFast'], weak: 1.8 } },
  },
  // 3 철벽 믹서 3000: 칼날 팔 포탑(바늘탄 · 개틀링) · 유리 뚜껑(부수면 톱니 노출 · 십자 레이저 정지)
  3: {
    a: { name: '칼날 팔 포탑', cell: 0, dx: 46, dy: 10, hp: 84, hr: 13, k: 0.4, fire: 'needle', cd: 1.7, bonus: 3500, fx: { cut: ['gatling'] } },
    b: { name: '유리 뚜껑', cell: 2, dx: 0, dy: -38, hp: 170, hr: 14, k: 0.42, fire: 'none', cd: 9, bonus: 7000, fx: { cover: true, weak: 2.0, cut: ['laserCross'] } },
  },
  // 4 젤리 크라켄: 젤리 촉수 포(유도탄) · 산호 왕관(부수면 느려지고 약점 노출)
  4: {
    a: { name: '젤리 촉수 포', cell: 0, dx: 46, dy: 22, hp: 110, hr: 14, k: 0.4, fire: 'homing', cd: 3.8, bonus: 4000, fx: { cut: ['homing'] } },
    b: { name: '산호 왕관', cell: 2, dx: 0, dy: -40, hp: 180, hr: 14, k: 0.42, fire: 'none', cd: 9, bonus: 8000, fx: { cover: true, weak: 1.9, slow: 1.25 } },
  },
  // 5 철벽 똥기사: 탑 방패(본체 방어 · 조준탄) · 투구 바이저(부수면 약점 노출 · 분노 돌진)
  5: {
    a: { name: '탑 방패', cell: 0, dx: 44, dy: 14, hp: 130, hr: 15, k: 0.4, fire: 'aim', cd: 1.9, bonus: 4500, fx: { armor: 0.65 } },
    b: { name: '투구 바이저', cell: 2, dx: 0, dy: -40, hp: 190, hr: 13, k: 0.42, fire: 'none', cd: 9, bonus: 9000, fx: { cover: true, weak: 2.0, rage: ['dash'] } },
  },
  // 6 변비마왕 꽉막혀: 코르크 대포(바늘탄) · 봉인 사슬(부수면 봉인 해제 → 본체가 크게 약해지지만 십자 레이저 발악)
  6: {
    a: { name: '코르크 대포', cell: 0, dx: 48, dy: 16, hp: 140, hr: 15, k: 0.4, fire: 'needle', cd: 1.7, bonus: 5000, fx: { cut: ['snipeRain'] } },
    b: { name: '봉인 사슬', cell: 2, dx: 0, dy: 8, hp: 230, hr: 15, k: 0.42, fire: 'none', cd: 9, bonus: 12000, fx: { armor: 0.5, rage: ['laserCross'], weak: 1.8 } },
  },
};

/** 스테이지 보스의 부위 목록 (A 왼쪽 · A 오른쪽 · B) — 없으면 null */
export function poopParts(stage: number): PartDef[] | null {
  const sp = S[stage];
  if (!sp) return null;
  const a = (sd: number): PartDef => ({ ...sp.a, art: 'parts', dx: sp.a.dx * sd, fx: { ...sp.a.fx } });
  return [a(-1), a(1), { ...sp.b, art: 'parts', fx: { ...sp.b.fx } }];
}
