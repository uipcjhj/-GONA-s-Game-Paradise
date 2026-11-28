/* STAGE 5 파괴 지형 — 정식 게임 흐름(?combat=2)에서 검사: 등장 · 명중 · HP 감소 · 균열 단계 · 파괴(조각) · 점수 · 기존 기록 보존 · FPS
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-stage5-terrain-check.cjs <url(끝 /)> <outdir> [w] [h] [video=0]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out, w = '393', h = '636', VIDEO = '0'] = process.argv.slice(2);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, ...(VIDEO === '1' ? { recordVideo: { dir: out, size: { width: +w, height: +h } } } : {}) });
  const SEED = { 'gona.skyadv.opened': '1', 'gona.skyadv.guide': '1', 'gona.skyadv.profiles': JSON.stringify({ v: 1, active: 'p1', list: [{ id: 'p1', nick: 'QA', created: '2026-11-20' }] }), 'gona.skyadv.rec2': JSON.stringify({ v: 2, boards: { 'arcade:normal': [{ score: 1650000, fam: 'samchon', stage: 6, at: '2026-11-26' }] }, daily: {}, col: { clears: {}, flags: {}, seen: {}, stages: {} } }) };
  await ctx.addInitScript((seed) => { if (!sessionStorage.getItem('s')) { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); sessionStorage.setItem('s', '1'); } }, SEED);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const res = []; const ok = (n, c, x = '') => res.push(`${c ? 'PASS' : 'FAIL'} · ${n}${x ? ' — ' + x : ''}`);
  await p.goto(url + '?combat=2&skytest');
  await p.waitForSelector('.ttl-start', { timeout: 60000 });
  await p.evaluate(() => window.__skyFlow.start(5, 'normal', 'mom'));
  await p.waitForFunction(() => window.__sky && window.__sky.debug, null, { timeout: 30000 });
  await p.evaluate(() => { const s = window.__sky; s.cheat('god'); s.cheat('auto'); });
  const samples = [];
  for (let i = 0; i < 70; i++) {
    if (await p.$('.sky-talk')) await p.tap('.sky-talk', { position: { x: 20, y: 20 } }).catch(() => {});
    await p.waitForTimeout(500);
    samples.push(await p.evaluate(() => { const s = window.__sky; const d = s.debug(); return { t: d.t, fps: d.fps, terr: d.terr, broken: d.terrBroken, chain: d.chainMax, score: d.score, st: s.terr.map((r) => r.st) }; }));
    if (i === 30) await p.screenshot({ path: `${out}/play-${w}x${h}.png` });
  }
  const log = await p.evaluate(() => window.__sky.terrLog);
  const last = samples[samples.length - 1];
  ok('정식 STORY 흐름 STAGE 5 에 굳은 응가 바위 등장', Math.max(...samples.map((s) => s.terr)) > 0, `최대 동시 ${Math.max(...samples.map((s) => s.terr))}개`);
  ok('공격 명중 → HP 감소 기록', log.length > 10 && log.some((r) => r[3] < 14), `피격 ${log.length}회`);
  ok('균열 단계(1·2) 표시', samples.some((s) => s.st.includes(1)) && samples.some((s) => s.st.includes(2)));
  ok('파괴(잔해 · 조각)', last.broken > 3, `${last.broken}개 파괴`);
  ok('파괴 점수 · CHAIN', last.score > 0 && last.chain >= 2, `점수 ${last.score} · 최대 CHAIN ${last.chain}`);
  const f = samples.map((s) => s.fps).filter((x) => x > 0);
  ok('FPS (에뮬레이터)', Math.min(...f) >= 50, `최저 ${Math.min(...f)} · 평균 ${Math.round(f.reduce((a, c) => a + c, 0) / f.length)}`);
  const kept = await p.evaluate((keys) => Object.fromEntries(keys.map((k) => [k, localStorage.getItem(k)])), ['gona.skyadv.rec2']);
  const rec = JSON.parse(kept['gona.skyadv.rec2']);
  ok('기존 ARCADE 기록 그대로 (시범판은 공식 보드에 안 올라감)', rec.boards['arcade:normal']?.[0]?.score === 1650000 && rec.boards['arcade:normal'].length === 1);
  ok('콘솔 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log(res.join('\n') + `\n${res.filter((x) => x.startsWith('PASS')).length}/${res.length} PASS`);
  const v = p.video(); await ctx.close(); if (v) fs.renameSync(await v.path(), `${out}/stage5-combat2-${w}x${h}.webm`);
  await b.close();
})();
