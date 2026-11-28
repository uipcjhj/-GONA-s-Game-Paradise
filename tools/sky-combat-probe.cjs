/* 전투 실측: 스테이지 N 을 봇으로 플레이하며 보스 이동 범위 · 공격 종류 · 탄 수 · 지형/체인 · FPS 기록
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-combat-probe.cjs <url(끝 /)> <out.json> [stage=5] [query=] [secs=45] [fam=mom]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out, stage = '5', q = '', secs = '45', fam = 'mom', roadS = '25'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 393, height: 636 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { localStorage.setItem('gona.skyadv.opened', '1'); localStorage.setItem('gona.skyadv.guide', '1'); localStorage.setItem('gona.skyadv.profiles', JSON.stringify({ v: 1, active: 'p1', list: [{ id: 'p1', nick: 'QA', created: '2026-11-20' }] })); });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`${url}?skytest${q}`);
  await p.waitForSelector('.ttl-start', { timeout: 60000 });
  await p.waitForFunction(() => window.__skyFlow, null, { timeout: 60000 });
  await p.evaluate(([s, f]) => window.__skyFlow.start(+s, 'normal', f), [stage, fam]);
  await p.waitForFunction(() => window.__sky && window.__sky.debug, null, { timeout: 30000 });
  await p.evaluate(() => { const s = window.__sky; s.cheat('god'); s.cheat('auto'); s.cheat('power'); });
  // 도중(지형 구간) 기록
  const road = [];
  const t0 = Date.now();
  while (Date.now() - t0 < +roadS * 1000) {
    if (await p.$('.sky-talk')) await p.tap('.sky-talk', { position: { x: 20, y: 20 } }).catch(() => {});
    road.push(await p.evaluate(() => { const s = window.__sky; const d = s.debug(); return { t: d.t, talk: d.talking, blk: d.block, paused: s.paused, ov: [...document.querySelectorAll('.sky > div')].map((e) => e.className).join('|').slice(0, 80), fps: d.fps, eb: d.ebullets, en: d.enemies, terr: s.terr ? s.terr.length : 0, chain: s.chainMax ?? 0, broke: s.terrBroken ?? 0 }; }));
    await p.waitForTimeout(500);
  }
  await p.evaluate(() => window.__sky.cheat('boss'));
  const boss = [];
  const atks = {};
  const t1 = Date.now();
  while (Date.now() - t1 < +secs * 1000) {
    if (await p.$('.sky-talk')) await p.tap('.sky-talk', { position: { x: 20, y: 20 } }).catch(() => {});
    const s = await p.evaluate(() => { const s = window.__sky; const d = s.debug(); const e = s.boss; const bs = s.bs; return { t: d.t, blk: d.block, talk: d.talking, step: d.step, vil: d.vil, fps: d.fps, ft: d.ftMax, eb: d.ebullets, x: e ? Math.round(e.x) : null, y: e ? Math.round(e.y) : null, atk: bs ? bs.atk : '', mode: bs ? bs.mode : '', phase: bs ? bs.phase : 0, hp: d.boss, max: d.bossMax, parts: s.en.filter((q) => q.kind === 'part' && !q.dead).length }; });
    if (s.atk && s.mode === 'atk') atks[s.atk] = (atks[s.atk] || 0) + 1;
    boss.push(s);
    if (s.hp === 0 && s.mode !== 'dying' && boss.length > 4) break;
    await p.waitForTimeout(250);
  }
  const xs = boss.filter((s) => s.x != null).map((s) => s.x), ys = boss.filter((s) => s.y != null).map((s) => s.y);
  const fpsAll = [...road, ...boss].map((s) => s.fps).filter((f) => f > 0);
  const res = { stage: +stage, q, fam, bossX: [Math.min(...xs), Math.max(...xs)], bossY: [Math.min(...ys), Math.max(...ys)], attacks: atks, phases: [...new Set(boss.map((s) => s.phase))], maxEb: Math.max(...boss.map((s) => s.eb)), fpsMin: Math.min(...fpsAll), fpsAvg: Math.round(fpsAll.reduce((a, b) => a + b, 0) / fpsAll.length), ftMax: Math.max(...boss.map((s) => s.ft || 0)), roadTerrain: Math.max(...road.map((r) => r.terr)), roadBroken: Math.max(...road.map((r) => r.broke)), chainMax: Math.max(...road.map((r) => r.chain)), bossHpEnd: boss[boss.length - 1]?.hp, errs };
  fs.writeFileSync(out, JSON.stringify({ res, road, boss }, null, 1));
  console.log(JSON.stringify(res));
  await b.close();
})();
