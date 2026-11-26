/* MEMORY HUNT 검수: 해금(기존 기록에서 자동) · 스테이지 카드 · 동료/난이도 선택 · 단독 전투 · 보스 격파 사진 · 완주 엽서 없음 ·
 * 점수판 분리(hunt:) · 다시 도전/스테이지 선택 · 시작 장비 표준
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-hunt-check.cjs <url(끝 /)> <outdir> [w] [h]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out, w = '393', h = '636'] = process.argv.slice(2);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  // 기존 유저: 스토리로 STAGE 3 까지 도달한 기록 (NORMAL reach 3) — 해금이 자동으로 따라오는지
  await ctx.addInitScript(() => {
    localStorage.setItem('gona.skyadv.opened', '1');
    if (!localStorage.getItem('gona.skyadv.records')) localStorage.setItem('gona.skyadv.records', JSON.stringify({ easy: { score: 0, reach: 1, clear: false }, normal: { score: 123000, reach: 3, clear: false }, hard: { score: 0, reach: 1, clear: false } }));
  });
  const p = await ctx.newPage();
  const errs = [];
  const bad = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  p.on('response', (r) => r.status() >= 400 && bad.push(r.url()));
  const res = [];
  const ok = (n, c, x = '') => res.push(`${c ? 'PASS' : 'FAIL'} · ${n}${x ? ' — ' + x : ''}`);
  const shot = (n) => p.screenshot({ path: `${out}/${n}.png` });
  const tapTalk = async () => { if (await p.$('.sky-talk')) await p.tap('.sky-talk', { position: { x: 20, y: 20 } }).catch(() => {}); };
  await p.goto(url + '?skytest');
  await p.waitForSelector('.ttl-start', { timeout: 60000 });
  await p.waitForTimeout(800);
  await shot('1-title');
  const scrollY = await p.evaluate(() => document.scrollingElement.scrollHeight - innerHeight);
  ok('타이틀에 MEMORY HUNT 버튼 · 세로 스크롤 없음', !!(await p.$('.ttl2-hunt')) && scrollY <= 0, `스크롤 ${scrollY}px`);
  await p.tap('.ttl2-hunt');
  await p.waitForSelector('.hunt-grid');
  await p.waitForTimeout(700);
  await shot('2-hunt');
  const cards = await p.$$eval('.hunt-card', (e) => e.map((x) => (x.classList.contains('locked') ? 'L' : 'O')).join(''));
  ok('해금: 기존 기록(STAGE 3 도달) → 1~3 열림 · 4~6 잠김', cards === 'OOOLLL', cards);
  await p.tap('.hunt-card:nth-child(4)');
  await p.waitForTimeout(300);
  ok('잠긴 카드는 눌러도 이동 안 함', !!(await p.$('.hunt-grid')));
  await p.tap('.hunt-card:nth-child(3)');
  await p.waitForSelector('.sel-main');
  await p.waitForTimeout(500);
  await shot('3-select');
  ok('동료 선택 화면 머리글 MEMORY HUNT · STAGE 3', (await p.$eval('.sel-stage', (e) => e.innerText)).includes('MEMORY HUNT · STAGE 3'));
  await p.tap('.sel-opts button:has-text("HARD")');
  await p.tap('text=출격!');
  await p.waitForFunction(() => window.__sky && document.querySelector('.sky-canvas'), null, { timeout: 30000 });
  const d0 = await p.evaluate(() => window.__sky.debug());
  ok('STAGE 3 단독 시작 · 시작 무기 Lv3 · HARD 폭탄 2', d0.stage === 3 && d0.power === 3 && d0.bombs === 2, `stage ${d0.stage} power ${d0.power} bombs ${d0.bombs}`);
  await p.evaluate(() => { const s = window.__sky; s.cheat('god'); s.cheat('boss'); });
  for (let i = 0; i < 80; i++) { await tapTalk(); if (await p.evaluate(() => window.__sky.bs && window.__sky.bs.mode !== 'enter' && !window.__sky.talking)) break; await p.waitForTimeout(150); }
  await p.evaluate(() => { const s = window.__sky; for (const e of s.en.filter((e) => e.kind === 'part')) s.damage(e, 1e6, 'shot', e.x, e.y); s.boss.hp = 1; s.damage(s.boss, 99, 'shot', s.boss.x, s.boss.y); });
  for (let i = 0; i < 80 && !(await p.$('.snap')); i++) { await tapTalk(); await p.waitForTimeout(150); }
  ok('보스 격파 → 찰칵 사진', !!(await p.$('.snap')));
  await p.waitForSelector('.res', { timeout: 10000 });
  await p.waitForTimeout(2600);
  await shot('4-result');
  const tx = await p.$eval('.res', (e) => e.innerText);
  ok('결과: 다시 도전 · 스테이지 선택 (다음 스테이지 없음)', tx.includes('다시 도전') && tx.includes('스테이지 선택') && !tx.includes('다음 스테이지'));
  const st = await p.evaluate(() => {
    const ps = JSON.parse(localStorage.getItem('gona.skyadv.profiles') || 'null');
    const key = !ps || ps.list[0].id === ps.active ? 'gona.skyadv.rec2' : `gona.skyadv.rec2.${ps.active}`;
    const s = JSON.parse(localStorage.getItem(key));
    return { boards: Object.keys(s.boards), photo: Object.keys(s.col.stages), clears: Object.keys(s.col.clears || {}).length, reach: JSON.parse(localStorage.getItem('gona.skyadv.records') || '{}').hard?.reach };
  });
  ok('점수판 분리 (hunt:3:hard 에만 기록)', st.boards.includes('hunt:3:hard') && !st.boards.includes('stage:3:hard'), st.boards.join(','));
  ok('추억사진 지급 (동료:hard:3)', st.photo.some((k) => k.endsWith(':hard:3')), st.photo.join(','));
  ok('스토리 도달 기록은 건드리지 않음', (st.reach ?? 1) === 1, `hard reach ${st.reach}`);
  await p.tap('text=다시 도전');
  await p.waitForFunction(() => window.__sky && window.__sky.debug().stage === 3 && window.__sky.debug().t < 3, null, { timeout: 30000 });
  ok('다시 도전 → 같은 스테이지 재시작', true);
  await p.evaluate(() => { const s = window.__sky; s.hp = 1; s.cheat && s.cheat('die'); });
  await p.goto(url + '?skytest');
  await p.waitForSelector('.ttl-start');
  await p.tap('.ttl2-hunt');
  await p.waitForSelector('.hunt-grid');
  await p.waitForTimeout(600);
  await shot('5-hunt-after');
  const c3 = await p.$eval('.hunt-card:nth-child(3)', (e) => e.innerText.replace(/\s+/g, ' '));
  ok('카드에 사진 수집률 · 최고 점수·랭크 표시', /📷 1\/18/.test(c3) && /BEST \d+/.test(c3), c3);
  console.log(res.join('\n') + `\n오류 ${errs.length} ${errs.slice(0, 2).join(' | ')} · 실패 요청 ${bad.length}`);
  await b.close();
})();
