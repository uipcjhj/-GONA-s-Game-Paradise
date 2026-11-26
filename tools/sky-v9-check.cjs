/* v9 통합 검수: 첫 진입(관문→오프닝→SKIP 연타→닉네임→타이틀) · 재방문(관문→타이틀) · 보스 격파 '찰칵' 사진 해금 ·
 * 108장 앨범(동료별 · 난이도별 완성률 · 확대) · 엔딩 크레딧(마지막 그림) · 콘솔 오류 · 실패 요청 · 가로 넘침
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-v9-check.cjs <url(끝 /)> <outdir> [w] [h]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out, w = '393', h = '636'] = process.argv.slice(2);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [];
  const bad = [];
  const log = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  p.on('response', (r) => r.status() >= 400 && bad.push(r.url()));
  const shot = (n) => p.screenshot({ path: `${out}/${n}.png` });
  const overflow = () => p.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
  // 1) 첫 진입: 관문 → 터치 → 오프닝 → SKIP 연타 → 닉네임 → 타이틀
  await p.goto(url + '?skytest&firstrun');
  await p.waitForSelector('.gate', { timeout: 60000 });
  log.push('1) 관문: ' + (await p.$eval('.gate-tap', (e) => e.innerText)));
  await shot('01-gate');
  await p.tap('.gate');
  await p.tap('.gate').catch(() => {}); // 관문 연타
  await p.waitForSelector('.oc-skip', { timeout: 30000 });
  await p.waitForTimeout(3500);
  await shot('02-opening');
  for (let i = 0; i < 6; i++) await p.tap('.oc-skip', { timeout: 500 }).catch(() => {}); // SKIP 연타
  await p.waitForSelector('.nick-box', { timeout: 15000 });
  log.push('2) 오프닝 → SKIP 연타 → 닉네임 창: OK');
  await p.fill('.nick-box input', '검수모험가');
  await shot('03-nickname');
  await p.tap('.nick-box .sky-btn-go');
  await p.waitForTimeout(1600);
  await shot('04-title');
  log.push('3) 타이틀: 로고 ' + !!(await p.$('.ttl2-logo img')) + ' · 닉네임 ' + (await p.$eval('.ttl2-foot', (e) => e.innerText).catch(() => '없음')) + ' · 가로 넘침 ' + (await overflow()));
  // 2) 재방문: 관문(TOUCH TO START) → 타이틀 (오프닝 없음)
  await p.goto(url + '?skytest&firstrun');
  await p.waitForSelector('.gate');
  const tap2 = await p.$eval('.gate-tap', (e) => e.innerText);
  await p.tap('.gate');
  await p.waitForSelector('.ttl-start', { timeout: 15000 });
  log.push('4) 재방문 관문 "' + tap2 + '" → 타이틀 (오프닝 ' + ((await p.$('.oc-skip')) ? '뜸' : '안 뜸') + ')');
  // 3) STAGE 2 보스 격파 → 찰칵 → 결과 사진
  await p.goto(url + '?skytest');
  await p.waitForSelector('.ttl-start');
  await p.evaluate(() => window.__skyFlow.start(2, 'normal'));
  await p.waitForFunction(() => window.__sky && document.querySelector('.sky-canvas'));
  await p.evaluate(() => { const s = window.__sky; s.cheat('god'); s.cheat('boss'); });
  for (let i = 0; i < 80; i++) { if (await p.$('.sky-talk')) await p.tap('.sky-talk', { position: { x: 20, y: 20 } }).catch(() => {}); if (await p.evaluate(() => window.__sky.bs && window.__sky.bs.mode !== 'enter' && !window.__sky.talking)) break; await p.waitForTimeout(150); }
  await p.waitForTimeout(800);
  await shot('05-boss');
  await p.evaluate(() => { const s = window.__sky; for (const e of s.en.filter((e) => e.kind === 'part')) s.damage(e, 1e6, 'shot', e.x, e.y); s.boss.hp = 1; s.damage(s.boss, 99, 'shot', s.boss.x, s.boss.y); });
  for (let i = 0; i < 80 && !(await p.$('.snap')); i++) { if (await p.$('.sky-talk')) await p.tap('.sky-talk', { position: { x: 20, y: 20 } }).catch(() => {}); await p.waitForTimeout(150); }
  await p.waitForTimeout(900);
  await shot('06-snap');
  log.push('5) 보스 격파 찰칵: ' + (await p.$eval('.snap p', (e) => e.innerText).catch(() => '없음')));
  await p.waitForSelector('.res', { timeout: 10000 });
  await p.waitForTimeout(2800);
  await shot('07-result');
  log.push('6) 결과 알림: ' + (await p.$$eval('.res-unlocks li', (e) => e.map((x) => x.innerText).slice(0, 3).join(' | ')).catch(() => '(없음)')) + ' · 사진 카드: ' + (await p.$eval('.res-photo span', (e) => e.innerText).catch(() => '없음')));
  // 4) 앨범: 사진 여러 장 심어 두고 동료별 보기 · 확대
  await p.evaluate(() => {
    const ps = JSON.parse(localStorage.getItem('gona.skyadv.profiles'));
    const key = ps.list[0].id === ps.active ? 'gona.skyadv.rec2' : `gona.skyadv.rec2.${ps.active}`;
    const st = JSON.parse(localStorage.getItem(key) || '{"v":2,"boards":{},"daily":{}}');
    st.col = st.col || { clears: {}, flags: {}, seen: {} };
    st.col.stages = st.col.stages || {};
    const F = ['mom', 'dad', 'imo', 'samchon', 'halmeoni', 'halabeoji'];
    const D = ['easy', 'normal', 'hard'];
    let n = 0;
    for (const f of F) for (const d of D) for (let s = 1; s <= 6; s++) if ((n++ * 7) % 3 !== 0) st.col.stages[`${f}:${d}:${s}`] = { rank: ['S', 'A', 'B'][n % 3], hits: n % 4, bombs: n % 2, allParts: n % 5 === 0, at: '2026-11-25', score: 40000 + n * 1000 };
    localStorage.setItem(key, JSON.stringify(st));
  });
  await p.goto(url + '?skytest');
  await p.waitForSelector('.ttl-start');
  await p.waitForTimeout(800);
  await p.tap('.ttl-start'); await p.waitForSelector('.lob-story', { timeout: 15000 }); await p.tap('.lob-nav button:nth-child(2)');
  await p.waitForSelector('.hall');
  await p.waitForTimeout(600);
  await shot('08-hall');
  await p.tap('.recs-tabs button:nth-child(2)');
  await p.waitForTimeout(800);
  await shot('09-photos-mom');
  await p.tap('.alb-fams button:nth-child(6)');
  await p.waitForTimeout(800);
  await shot('10-photos-halabeoji');
  log.push('7) 앨범: ' + (await p.$eval('.alb-rate span', (e) => e.innerText)) + ' · 난이도 ' + (await p.$$eval('.alb-diffrate em', (e) => e.map((x) => x.innerText).join(' / '))) + ' · 가로 넘침 ' + (await overflow()));
  const open = await p.$('.alb-prow .alb-card:not(.locked)');
  await open.tap();
  await p.waitForSelector('.polaroid');
  await p.waitForTimeout(900);
  await shot('11-photo-view');
  log.push('8) 확대: ' + (await p.$eval('.polaroid', (e) => e.innerText.replace(/\s+/g, ' ').slice(0, 140))));
  const imgOk = await p.$eval('.polaroid img', (e) => e.naturalWidth);
  log.push('   사진 원본 폭 ' + imgOk + 'px · PNG 버튼 ' + !!(await p.$('.alb-save .sky-btn')));
  await p.tap('.alb-view p');
  await p.tap('.recs-tabs button:nth-child(5)');
  await p.waitForTimeout(500);
  log.push('9) 업적: ' + (await p.$$eval('.alb-ach li', (e) => e.length)) + '개 (보스 격파 배지 포함)');
  // 5) 엔딩 → 건너뛰기 → 크레딧
  await p.goto(url + '?skytest');
  await p.waitForSelector('.ttl-start');
  await p.evaluate(() => window.__skyFlow.ending());
  await p.waitForTimeout(2500);
  for (let i = 0; i < 30 && !(await p.$('.cred-fin')); i++) { await p.tap('text=엔딩 건너뛰기').catch(() => {}); await p.waitForTimeout(400); }
  await p.waitForTimeout(2600);
  await shot('12-credits');
  log.push('10) 크레딧: 배경 그림 ' + (await p.$eval('.cred-bg', (e) => e.naturalWidth).catch(() => 0)) + 'px');
  console.log(log.join('\n') + `\n오류 ${errs.length} ${errs.slice(0, 3).join(' | ')} · 실패 요청 ${bad.length} ${bad.slice(0, 3).join(' | ')}`);
  await b.close();
})();
