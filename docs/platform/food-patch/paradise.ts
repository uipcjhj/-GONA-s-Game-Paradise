/**
 * 게임천국 연동 어댑터 (docs: 게임천국 저장소 docs/platform/GAME_RESULT_CONTRACT.md).
 *  - 주소에 ?gp=<세션> 이 있고 게임천국이 만든 세션이 실제로 있을 때만 켜진다. 그 밖(단독 실행)에서는 아무것도 구독하지 않는 no-op.
 *  - 읽기만: bus 이벤트를 듣기만 하며 GameScene·점수·난이도·저장 키는 건드리지 않는다. 쓰는 것은 게임천국의 `gp.v1.inbox.<resultId>` 새 키뿐.
 *  - 점수는 게임이 화면에 보여 준 값 그대로. 이어하기·보스전 재도전은 이전 점수를 이어서 시작하므로 시작 점수를 extra.carry 로 알린다.
 */
import { bus, EV } from '../events';
import type { CombatHud, GameOverInfo } from '../events';
import { createGP } from './gp-sdk';

export function initParadise(): void {
  const gp = createGP({ gameVersion: '1.0.0' });
  if (!gp.init('food-island')) return; // 단독 실행: 완전한 no-op

  let carry: number | null = null; // 판 시작 직후 HUD 점수 = 이어서 시작한 점수
  bus.on(EV.combatHud, (h: CombatHud) => {
    if (carry === null) carry = h.score;
  });
  bus.on(EV.start, () => {
    carry = null;
    hideBack();
    gp.runStart();
  });
  bus.on(EV.pause, () => gp.runPause());
  bus.on(EV.resume, () => gp.runResume());
  const end = (outcome: 'cleared' | 'failed', i: GameOverInfo | null) => {
    if (!i) return;
    const c = Math.min(carry ?? 0, i.score);
    gp.runEnd({ outcome, score: i.score, stage: i.growthLevel, stageLabel: i.growthName, extra: { snacks: i.snacks, ...(c > 0 ? { carry: c } : {}) } });
  };
  bus.on(EV.gameOver, (i: GameOverInfo) => {
    end('failed', i);
    showBack();
  });
  // 엔딩 다시보기는 같은 이벤트를 다시 내지만 SDK 가 판당 1번만 기록
  bus.on(EV.endingStart, (i: GameOverInfo | null) => end('cleared', i));
  bus.on(EV.endingTheEnd, showBack);
  bus.on(EV.ending, showBack);
  bus.on(EV.restart, hideBack);

  // 게임천국으로 돌아가기 버튼(게임천국에서 들어왔을 때만, 게임 오버/엔딩 끝에서만 보임)
  let btn: HTMLButtonElement | null = null;
  function showBack(): void {
    const url = gp.returnUrl();
    if (!url) return;
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '🏝 게임천국으로';
      btn.setAttribute('data-gp-back', '1');
      btn.style.cssText = 'position:fixed;left:8px;top:calc(env(safe-area-inset-top,0px) + 8px);z-index:1000;min-height:40px;padding:0 12px;font:700 12px Galmuri11,sans-serif;color:#3b1b5e;background:#fff4d6;border:3px solid #3b1b5e;';
      btn.addEventListener('click', () => {
        gp.retry();
        window.location.href = url;
      });
      document.body.appendChild(btn);
    }
    btn.style.display = '';
  }
  function hideBack(): void {
    if (btn) btn.style.display = 'none';
  }
}
