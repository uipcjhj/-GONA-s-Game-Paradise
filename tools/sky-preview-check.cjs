/* 개발자 컷신 미리보기(?preview) 검수: 메뉴 → 오프닝 · 엔딩 · 에필로그 · 크레딧 · 엔딩→크레딧 연속
 *  기존 저장(기록·사진·프로필) 변화 0 · 온라인 요청 0 · 콘솔 오류 0 · 일반 접속은 저장 정상
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-preview-check.cjs <url(끝 /)> <outdir> [w] [h]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out, w = '393', h = '636'] = process.argv.slice(2);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
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
  const errs = [], ext = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  p.on('request', (r) => { if (!r.url().startsWith(url)) ext.push(r.url()); });
  const res = [];
  const ok = (n, c, x = '') => res.push(`${c ? 'PASS' : 'FAIL'} · ${n}${x ? ' — ' + x : ''}`);
  const snap = () => p.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().filter((k) => k !== 'qa.seeded').map((k) => [k, localStorage.getItem(k)])));
  await p.goto(url + '?preview');
  await p.waitForSelector('.pv-box', { timeout: 60000 });
  const before = await snap();
  await p.screenshot({ path: `${out}/0-menu-${w}x${h}.png` });
  const scenesOf = async (until, limit) => {
    const seen = []; const t0 = Date.now();
    while (Date.now() - t0 < limit && !(await until())) {
      const cls = await p.$eval('.pe', (e) => e.className).catch(() => '');
      const sc = (cls.match(/pes-(\w+)/) || [])[1];
      if (sc && seen[seen.length - 1] !== sc) seen.push(sc);
      await p.waitForTimeout(300);
    }
    return { seen, secs: Math.round((Date.now() - t0) / 1000) };
  };
  // 오프닝
  await p.tap('.pv-opening');
  const oc = await p.waitForSelector('.oc-skip', { timeout: 20000 }).then(() => true).catch(() => false);
  await p.waitForTimeout(5000);
  await p.screenshot({ path: `${out}/1-opening.png` });
  await p.tap('.oc-skip');
  ok('오프닝 처음부터 → SKIP → 메뉴로 복귀', oc && !!(await p.waitForSelector('.pv-box', { timeout: 10000 }).catch(() => null)));
  // 엔딩 (포옹까지 → 메뉴)
  await p.tap('.pv-ending');
  const e = await scenesOf(async () => !!(await p.$('.pv-box')), 200000);
  ok('엔딩 처음부터 → 포옹까지 → 메뉴', e.seen[0] === 'train' && e.seen.includes('hug') && !e.seen.includes('epi') && !!(await p.$('.pv-box')), `${e.seen.join('→')} (${e.secs}초)`);
  // 에필로그
  await p.tap('.pv-epilogue');
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/2-epilogue.png` });
  const ep = await scenesOf(async () => !!(await p.$('.pv-box')), 90000);
  ok('에필로그만 → 메뉴', ep.seen[0] === 'epi' && ep.seen.length === 1, `${ep.seen.join('→')} (${ep.secs}초)`);
  // 크레딧
  await p.tap('.pv-credits');
  await p.waitForSelector('.cred-fin', { timeout: 10000 });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/3-credits.png` });
  await p.tap('.pv-back');
  ok('크레딧만 → 미리보기 메뉴', !!(await p.waitForSelector('.pv-box', { timeout: 5000 }).catch(() => null)));
  // 연속
  await p.tap('.pv-full');
  const f = await scenesOf(async () => !!(await p.$('.cred-fin')), 260000);
  ok('엔딩 → 에필로그 → 크레딧 연속', f.seen[0] === 'train' && f.seen.includes('epi') && !!(await p.$('.cred-fin')), `${f.seen.join('→')} → 크레딧 (${f.secs}초)`);
  await p.tap('.cred-btns .sky-btn-go');
  await p.waitForTimeout(1200);
  ok('크레딧 "처음부터 다시" → 엔딩 처음 장면', /pes-train/.test(await p.$eval('.pe', (x) => x.className).catch(() => '')));
  const after = await snap();
  ok('기존 저장(점수·사진·배지·미션·업적·클리어·프로필) 변화 없음', before === after);
  const blocked = await p.evaluate(() => window.__skyPreviewBlocked || null);
  ok('미리보기 탭 저장 차단 장치 동작', Array.isArray(blocked), blocked ? `차단된 쓰기 ${blocked.length}건 ${[...new Set(blocked)].slice(0, 4).join(', ')}` : '');
  ok('외부(온라인 랭킹 등) 요청 없음', ext.length === 0, ext.slice(0, 2).join(' '));
  ok('콘솔 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | '));
  // 일반 접속: 차단 장치 없음 · 저장 정상
  await p.goto(url + '?skytest');
  await p.waitForSelector('.ttl-start', { timeout: 60000 });
  const normal = await p.evaluate(() => { localStorage.setItem('gona.skyadv.qa-write', '1'); const v = localStorage.getItem('gona.skyadv.qa-write'); localStorage.removeItem('gona.skyadv.qa-write'); return { v, guard: !!window.__skyPreviewBlocked }; });
  ok('일반 접속은 저장 정상 (미리보기와 분리)', normal.v === '1' && !normal.guard);
  ok('일반 타이틀에 미리보기 메뉴 노출 없음', !(await p.$('.pv-box')) && !(await p.$('text=컷신 미리보기')));
  console.log(res.join('\n'));
  await b.close();
})();
