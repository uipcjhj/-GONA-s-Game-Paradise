/**
 * Food Adventure 를 **실제 터치 입력(CDP)** 으로 플레이하는 봇 모듈 (Food 저장소의 tools/fullrun-bot.cjs 의 판단 로직을 재사용).
 * 게임 상태 읽기에는 개발 빌드의 window.__gona(주소에 ?test)를 쓰지만, 입력은 모두 실제 터치 이벤트다. 게임 규칙·점수는 건드리지 않는다.
 */
async function makeInput(ctx, page) {
  const cdp = await ctx.newCDPSession(page);
  let tid = 1;
  const tapXY = async (x, y) => {
    const id = tid++;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const center = async (sel) => {
    const r = await page.locator(sel).first().boundingBox().catch(() => null);
    return r ? [r.x + r.width / 2, r.y + r.height / 2] : null;
  };
  const tap = async (sel) => {
    const c = await center(sel);
    if (c) await tapXY(...c);
    return !!c;
  };
  return { tapXY, center, tap };
}

/** 프롤로그 건너뛰기 → 타이틀 '게임 시작' (처음부터 새 게임) */
async function startNewGame(page, input, { skipCheckpoint = true } = {}) {
  if (skipCheckpoint) await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.endsWith('gona.checkpoint')) localStorage.removeItem(k); });
  await page.waitForSelector('.op-skip', { state: 'visible', timeout: 15000 });
  await input.tap('.op-skip');
  await page.waitForSelector('.cover.revealed', { timeout: 15000 });
  await page.waitForTimeout(2700);
  await input.tap('.cover-btn');
  await page.waitForFunction(() => window.__gona.scene.getScene('Game').state === 'playing', null, { timeout: 10000 });
}

const readState = (page) =>
  page.evaluate(() => {
    const g = window.__gona.scene.getScene('Game');
    const bt = g.battle;
    const ov = document.querySelector('.over-screen');
    const threats = [];
    for (const e of g.entities) {
      if (e.done || e.type === 'snack' || e.hit) continue;
      threats.push({ x0: e.x - e.w / 2, x1: e.x + e.w / 2, yb: g.groundY - e.alt, yt: g.groundY - e.alt - e.h, vx: -(g.speed + (e.vx ?? 0)), k: e.type });
    }
    if (bt)
      for (const h of bt.hostiles) {
        if (h.dead || h.hitPlayer) continue;
        const hw = h.shape === 'circle' ? h.r : h.w / 2;
        const hh = h.shape === 'circle' ? h.r : h.h / 2;
        threats.push({ x0: h.x - hw, x1: h.x + hw, yb: h.y + hh, yt: h.y - hh, vx: h.vx - (h.onGround ? g.speed : 0), vy: h.wave ? 0 : h.vy, ay: h.ay, k: 'boss' });
      }
    const snacks = g.entities.filter((e) => !e.done && e.type === 'snack').map((e) => ({ x: e.x, alt: e.alt }));
    const monsters = g.entities.filter((e) => !e.done && e.type === 'monster').map((e) => e.x);
    return {
      state: g.state, grounded: g.grounded, alt: g.alt, px: g.playerX, gy: g.groundY, speed: g.speed, hearts: g.hearts, hp: g.hp, canThrow: g.canThrow, out: g.boomerang.isOut, pull: g.pull,
      stage: g.growth.stageIndex, score: g.score, snacks: g.snacksEaten, kills: g.kills, shieldReady: g.time.now >= g.shieldReadyAt,
      over: !!ov && !ov.classList.contains('hidden'), cleared: !!ov?.classList.contains('cleared') || g.state === 'ending' || g.state === 'cleared',
      threats, snackList: snacks, monsters,
      b: bt && { id: bt.id, mode: bt.mode, hp: bt.hp, frozen: bt.frozen, special: bt.special, bx: bt.bx, r: bt.bossRect() },
    };
  });

/**
 * opts.stop: 'death' (게임 오버가 뜰 때까지) | 'ending' (엔딩이 시작될 때까지, 게임 오버 시 이어하기/다시하기로 계속)
 * opts.dieAfterSec: 이 시간 이후부터는 점프/방어/공격을 멈춰 일부러 게임 오버가 나게 함 (그 전에는 생존 플레이 → 15초 이상 판 확보)
 * opts.maxMin: 제한 시간
 */
async function playBot(page, input, opts = {}) {
  const REACT = opts.react || 120;
  const vp = page.viewportSize();
  const jumpXY = [vp.width * 0.5, vp.height * 0.32];
  const t0 = Date.now();
  const log = { result: 'timeout', deaths: 0, continues: 0, retries: [], lastScore: 0, maxScore: 0, snacks: 0, seconds: 0, stages: [] };
  let lastJump = 0;
  let prevBx = null;
  let btn = {};
  let lastStage = -1;
  while (Date.now() - t0 < (opts.maxMin || 20) * 60000) {
    const idle = opts.dieAfterSec !== undefined && Date.now() - t0 > opts.dieAfterSec * 1000;
    const s = await readState(page);
    log.lastScore = s.score; log.snacks = s.snacks; log.maxScore = Math.max(log.maxScore, s.score);
    if (s.stage !== lastStage) { lastStage = s.stage; log.stages.push({ stage: s.stage + 1, score: s.score, t: Math.round((Date.now() - t0) / 1000) }); }
    if (s.cleared && opts.stop === 'ending') { log.result = 'ENDING'; break; }
    if (s.over || s.state === 'dead') {
      if (s.state === 'dead' && !s.over) { await page.waitForTimeout(300); continue; }
      if (opts.stop === 'death') { log.result = 'DEATH'; break; }
      log.deaths += 1;
      await page.waitForTimeout(700);
      const cp = await page.locator('.cp-retry').isVisible();
      if (cp) { log.continues += 1; log.retries.push({ kind: 'checkpoint', scoreAtDeath: s.score }); await input.tap('.cp-retry'); }
      else { log.retries.push({ kind: 'restart', scoreAtDeath: s.score }); await input.tap('.over-screen .retry-btn'); }
      btn = {};
      await page.waitForTimeout(800);
      continue;
    }
    if (s.state !== 'playing' || (s.b && (s.b.frozen || s.b.mode !== 'fight'))) { prevBx = s.b ? s.b.bx : null; await page.waitForTimeout(REACT); continue; }
    if (idle) { await page.waitForTimeout(REACT); continue; }
    const x1 = s.px + 5.5;
    const head = s.gy - 21;
    let threat = null;
    for (const h of s.threats) {
      if (h.vx >= -1) continue;
      const t = (h.x0 - x1) / -h.vx;
      if (t < -0.15 || t > 0.42) continue;
      const tt = Math.max(0, t);
      const dy = (h.vy || 0) * tt + 0.5 * (h.ay || 0) * tt * tt;
      const low = h.yb + dy > head && h.yt + dy < s.gy;
      if (low && (!threat || t < threat.t)) threat = { t };
    }
    if (s.b) {
      const bvx = prevBx === null ? 0 : (s.b.bx - prevBx) / (REACT / 1000);
      prevBx = s.b.bx;
      if (bvx < -90) { const t = (s.b.r.x0 - x1) / -bvx; if (t > -0.1 && t < 0.42 && (!threat || t < threat.t)) threat = { t }; }
    }
    let acted = false;
    if (threat) {
      if (s.grounded && threat.t < 0.3 && Date.now() - lastJump > 150) { await input.tapXY(...jumpXY); lastJump = Date.now(); acted = true; }
      else if (s.b && s.shieldReady && threat.t < 0.14 && (s.grounded || s.alt < 22)) { btn.shield = btn.shield || (await input.center('.bt-shield')); if (btn.shield) await input.tapXY(...btn.shield); acted = true; }
    }
    if (!acted && s.pull > 4 && s.grounded && Date.now() - lastJump > 200) { await input.tapXY(...jumpXY); lastJump = Date.now(); acted = true; }
    if (!acted && !threat && s.grounded && Date.now() - lastJump > 300) {
      const want = s.snackList.find((n) => n.alt >= 14 && n.alt <= 60 && (n.x - x1) / s.speed > 0.15 && (n.x - x1) / s.speed < 0.3);
      if (want) { await input.tapXY(...jumpXY); lastJump = Date.now(); }
    }
    if (s.b && s.b.special >= 1) { btn.special = btn.special || (await input.center('.bt-special')); if (btn.special) await input.tapXY(...btn.special); }
    else if (s.canThrow && !s.out && (s.b || s.monsters.some((mx) => mx > s.px + 15 && mx < s.px + 170))) { btn.attack = btn.attack || (await input.center('.bt-attack')); if (btn.attack) await input.tapXY(...btn.attack); }
    await page.waitForTimeout(REACT);
  }
  log.seconds = Math.round((Date.now() - t0) / 1000);
  return log;
}

module.exports = { makeInput, startNewGame, readState, playBot };
