/* 배지 32종 그래픽 교체 검수: 업적 탭 격자 · 잠김/획득 · 확대 · 명예의 전당 · 배지 탭 · 보스 격파 → NEW BADGE 수여 · 로비 알림 · 기록 보존
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-badges-check.cjs <url(끝 /)> <outdir> [w] [h]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out, w = '393', h = '636'] = process.argv.slice(2);
const seed = () => {
  localStorage.setItem('gona.skyadv.opened', '1');
  if (localStorage.getItem('qa.seeded')) return;
  localStorage.setItem('qa.seeded', '1');
  localStorage.setItem('gona.skyadv.profiles', JSON.stringify({ v: 1, active: 'p1', list: [{ id: 'p1', nick: '배지검수', created: '2026-11-20' }] }));
  localStorage.setItem('gona.skyadv.records', JSON.stringify({ easy: { score: 900000, reach: 6, clear: true }, normal: { score: 0, reach: 1, clear: false }, hard: { score: 0, reach: 1, clear: false } }));
  localStorage.setItem('gona.skyadv.rec2', JSON.stringify({ v: 2, boards: {}, daily: { '2026-11-25': { cleared: true, tries: 1 } }, col: { clears: { 'mom:easy': { at: '2026-11-22', score: 900000, rank: 'A' } }, flags: { nomiss: true }, seen: {}, counts: { allParts: 1 },
    stages: { 'mom:easy:1': { rank: 'S', hits: 0, bombs: 0, allParts: true, at: '2026-11-20', score: 40000 }, 'mom:easy:2': { rank: 'A', hits: 1, bombs: 0, allParts: false, at: '2026-11-21', score: 50000 } } } }));
};
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(seed);
  const p = await ctx.newPage();
  const errs = [], bad = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('response', (r) => r.status() >= 400 && bad.push(`${r.status()} ${r.url()}`));
  const res = [];
  const ok = (n, c, x = '') => res.push(`${c ? 'PASS' : 'FAIL'} · ${n}${x ? ' — ' + x : ''}`);
  await p.goto(url + '?skytest');
  await p.waitForSelector('.ttl-start', { timeout: 60000 });
  const before = await p.evaluate(() => localStorage.getItem('gona.skyadv.rec2'));
  await p.tap('.ttl-start'); await p.waitForSelector('.lob-story, .lb2-story');
  await p.tap('.lob-nav button:nth-child(2)'); await p.waitForSelector('.hall');
  await p.waitForTimeout(600);
  const hall = await p.$eval('.hall-top img', (e) => ({ src: e.getAttribute('src'), w: e.naturalWidth }));
  ok('명예의 전당 MASTER = 새 배지(04)', /badge-04\.png/.test(hall.src) && hall.w > 0, hall.src);
  await p.screenshot({ path: `${out}/${w}x${h}-1-hall.png` });
  await p.tap('.recs-tabs button:nth-child(3)'); await p.waitForTimeout(700);
  const famImgs = await p.$$eval('.alb-badge .bd-img', (e) => e.map((x) => x.getAttribute('src')));
  ok('배지 탭: 동료 클리어 18칸 = 동료 문장 배지(17~22) · 얼굴 없음', famImgs.length === 18 && famImgs.every((s) => /badge-(1[7-9]|2[0-2])\.png/.test(s)) && !(await p.$('.alb-badge .bd-face')));
  await p.screenshot({ path: `${out}/${w}x${h}-2-badge-tab.png` });
  await p.tap('.recs-tabs button:nth-child(5)'); await p.waitForSelector('.bd-grid');
  await p.evaluate(async () => { await Promise.all([...document.querySelectorAll('.bd-cell img')].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })))); });
  const cells = await p.$$eval('.bd-cell', (e) => e.map((x) => ({ on: x.classList.contains('on'), name: x.querySelector('b').innerText, src: x.querySelector('img').getAttribute('src'), w: x.querySelector('img').naturalWidth, sub: x.querySelector('small').innerText })));
  const doneN = await p.evaluate(() => 0);
  ok('업적 탭: 배지 32칸 · 모든 그림 불러옴', cells.length === 32 && cells.every((c) => c.w > 0), `${cells.length}칸 · 실패 ${cells.filter((c) => !c.w).length}`);
  const on = cells.filter((c) => c.on);
  ok('획득 배지 표시 (기존 기록 그대로)', on.length >= 5, on.map((c) => `${c.name}(${c.sub})`).join(', '));
  ok('잠긴 배지: 진행도 표시', cells.filter((c) => !c.on).every((c) => /🔒/.test(c.sub)));
  await p.screenshot({ path: `${out}/${w}x${h}-3-ach-grid.png`, fullPage: false });
  const first = await p.$('.bd-cell.on'); await first.tap(); await p.waitForSelector('.bd-zoom');
  await p.waitForTimeout(700);
  const z = await p.$eval('.bd-zoom', (e) => e.innerText.replace(/\s+/g, ' '));
  ok('획득 배지 확대: 이름 · 조건 · 획득일', /획득 조건/.test(z) && /20\d\d-\d\d-\d\d/.test(z), z);
  await p.screenshot({ path: `${out}/${w}x${h}-4-zoom-on.png` });
  await p.tap('.bd-view'); await p.tap('.bd-cell:not(.on)'); await p.waitForSelector('.bd-zoom'); await p.waitForTimeout(400);
  ok('잠긴 배지 확대: 잠김 · 조건 안내', /잠겨/.test(await p.$eval('.bd-zoom', (e) => e.innerText)));
  await p.screenshot({ path: `${out}/${w}x${h}-5-zoom-locked.png` });
  await p.tap('.bd-view');
  const after = await p.evaluate(() => localStorage.getItem('gona.skyadv.rec2'));
  ok('배지 화면을 봐도 수집 기록 변화 없음', before === after);
  // 보스 격파 → NEW BADGE 수여 (엄마로 STAGE 3 보스 = 새 배지 '철벽 믹서 3000 격파')
  await p.goto(url + '?skytest'); await p.waitForSelector('.ttl-start');
  await p.evaluate(() => window.__skyFlow.start(3, 'easy'));
  await p.waitForFunction(() => window.__sky && document.querySelector('.sky-canvas'), null, { timeout: 30000 });
  await p.evaluate(() => { const s = window.__sky; s.cheat('god'); s.cheat('boss'); });
  for (let i = 0; i < 90; i++) { if (await p.$('.sky-talk')) await p.tap('.sky-talk', { position: { x: 20, y: 20 } }).catch(() => {}); if (await p.evaluate(() => window.__sky.bs && window.__sky.bs.mode !== 'enter' && !window.__sky.talking)) break; await p.waitForTimeout(150); }
  await p.evaluate(() => { const s = window.__sky; s.boss.hp = 1; s.damage(s.boss, 99, 'shot', s.boss.x, s.boss.y); });
  for (let i = 0; i < 140 && !(await p.$('.res')); i++) { if (await p.$('.sky-talk')) await p.tap('.sky-talk', { position: { x: 20, y: 20 } }).catch(() => {}); await p.waitForTimeout(150); }
  await p.waitForSelector('.res', { timeout: 10000 }); await p.waitForTimeout(3200);
  const ub = await p.$$eval('.res-unlocks li.u-badge', (e) => e.map((x) => ({ t: x.innerText.replace(/\s+/g, ' '), w: x.querySelector('img').naturalWidth })));
  ok('보스 격파 → 결과 화면 NEW BADGE 훈장 (그림 포함)', ub.length > 0 && ub.every((u) => u.w > 0), ub.map((u) => u.t).join(' | '));
  const resEl = await p.$('.res'); await resEl.screenshot({ path: `${out}/${w}x${h}-6-new-badge-result.png` }).catch(() => p.screenshot({ path: `${out}/${w}x${h}-6-new-badge-result.png` }));
  await p.screenshot({ path: `${out}/${w}x${h}-6b-result-full.png` });
  // 로비 알림
  const lob = await p.$('.res button:has-text("로비로")'); if (lob) await lob.tap();
  await p.waitForSelector('.lob-story, .lb2-story', { timeout: 10000 }); await p.waitForTimeout(500);
  const mini = await p.$('.lb2-new .bd-mini');
  ok('로비 획득 보상: NEW BADGE 배지 그림', !!mini);
  await p.screenshot({ path: `${out}/${w}x${h}-7-lobby-new-badge.png` });
  const keep = await p.evaluate(() => { const r = JSON.parse(localStorage.getItem('gona.skyadv.rec2')).col; return [Object.keys(r.stages).length, Object.keys(r.clears).length, !!r.flags.nomiss]; });
  ok('기존 수집 기록 보존 (사진 2 + 새 1 · 완주 1 · 노미스)', keep[0] === 3 && keep[1] === 1 && keep[2], JSON.stringify(keep));
  ok('콘솔 오류 · 실패 요청 없음', errs.length === 0 && bad.length === 0, [...errs, ...bad].slice(0, 2).join(' | '));
  console.log(res.join('\n'));
  await b.close();
})();
