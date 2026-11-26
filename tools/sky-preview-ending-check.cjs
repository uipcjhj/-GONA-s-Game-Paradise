/* 엔딩 미리보기(?preview=ending) 검수: 터치 → 엔딩 처음부터 → 에필로그 → 크레딧(자연 진행) · 저장 데이터 변화 0 · 다시 보기
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-preview-ending-check.cjs <url(끝 /)> <outdir> [w] [h]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out, w = '393', h = '636'] = process.argv.slice(2);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  // 이미 플레이하던 사용자의 기록 (그대로 남아야 함)
  await ctx.addInitScript(() => {
    if (localStorage.getItem('qa.seeded')) return;
    localStorage.setItem('qa.seeded', '1');
    localStorage.setItem('gona.skyadv.opened', '1');
    localStorage.setItem('gona.skyadv.schema', '3');
    localStorage.setItem('gona.skyadv.profiles', JSON.stringify({ v: 1, active: 'p1', list: [{ id: 'p1', nick: '기존유저', created: '2026-11-20' }] }));
    localStorage.setItem('gona.skyadv.records', JSON.stringify({ easy: { score: 1000, reach: 2, clear: false }, normal: { score: 0, reach: 1, clear: false }, hard: { score: 0, reach: 1, clear: false } }));
    localStorage.setItem('gona.skyadv.rec2', JSON.stringify({ v: 2, boards: { 'stage:1:easy': [{ score: 1000, fam: 'mom', stage: 1, at: '2026-11-20' }] }, daily: {}, col: { clears: {}, flags: {}, seen: {}, stages: { 'mom:easy:1': { hits: 1, bombs: 0, allParts: false } } } }));
  });
  const p = await ctx.newPage();
  const errs = [];
  const bad = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  p.on('response', (r) => r.status() >= 400 && bad.push(r.url()));
  const snap = () => p.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().filter((k) => k !== 'qa.seeded').map((k) => [k, localStorage.getItem(k)])));
  await p.goto(url + '?preview=ending');
  await p.waitForSelector('.gate', { timeout: 60000 });
  const before = await snap();
  await p.screenshot({ path: `${out}/0-gate.png` });
  await p.tap('.gate');
  const t0 = Date.now();
  let i = 0;
  const seen = new Set();
  while (Date.now() - t0 < 240000 && !(await p.$('.cred-fin'))) {
    const cls = await p.$eval('.pe', (e) => e.className).catch(() => '');
    const sc = (cls.match(/pes-(\w+)/) || [])[1];
    if (sc && !seen.has(sc)) { seen.add(sc); await p.screenshot({ path: `${out}/${String(++i).padStart(2, '0')}-${sc}.png` }); }
    await p.waitForTimeout(400);
  }
  const secs = Math.round((Date.now() - t0) / 1000);
  await p.waitForTimeout(3000);
  await p.screenshot({ path: `${out}/99-credits.png` });
  const credits = !!(await p.$('.cred-fin'));
  const after = await snap();
  await p.tap('text=엔딩 처음부터 다시');
  await p.waitForTimeout(1500);
  const replay = await p.$eval('.pe', (e) => e.className).catch(() => '');
  console.log(`장면 순서: ${[...seen].join(' → ')}\n크레딧 도착 ${credits} (${secs}초) · 다시 보기 → ${replay}\n저장 데이터 변화: ${before === after ? '없음' : '있음 ⚠'}\n오류 ${errs.length} ${errs.slice(0, 2).join(' | ')} · 실패 요청 ${bad.length}`);
  await b.close();
})();
