/* 3차 업그레이드 캡처: 부위 파괴 전/후(실제 플레이 화면) · 웨이브 전투 · 닉네임 · 앨범(사진·배지/도장·미션) · 난이도별 기념사진(폴라로이드)
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-v7-shots.cjs <url(끝에 /)> <outdir>
 */
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out] = process.argv.slice(2);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 393, height: 636 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => localStorage.setItem('gona.skyadv.opened', '1'));
  const p = await ctx.newPage();
  const errs = [];
  const bad = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  p.on('response', (r) => r.status() >= 400 && bad.push(r.url()));
  const shot = (n) => p.screenshot({ path: `${out}/${n}.png` });
  const clearTalk = async () => { for (let i = 0; i < 40 && (await p.$('.sky-talk')); i++) { await p.tap('.sky-talk', { position: { x: 20, y: 20 } }).catch(() => {}); await p.waitForTimeout(60); } };
  // 1) 닉네임 입력 (프로필 없음 + firstrun)
  await p.goto(url + '?skytest&firstrun'); await p.waitForSelector('.nick-box', { timeout: 60000 });
  await p.fill('.nick-box input', '고나아빠'); await p.waitForTimeout(300); await shot('01-nickname');
  await p.tap('.nick-box .sky-btn-go'); await p.waitForTimeout(800);
  // 2) 보스 부위 파괴 전/후 (STAGE 3 · 실제 루프)
  await p.goto(url + '?skytest'); await p.waitForSelector('.ttl-start');
  await p.evaluate(() => window.__skyFlow.start(3, 'normal'));
  await p.waitForFunction(() => window.__sky && document.querySelector('.sky-canvas'));
  await p.evaluate(() => { const s = window.__sky; s.cheat('god'); s.cheat('power'); s.cheat('boss'); });
  for (let i = 0; i < 80; i++) { await clearTalk(); const ok = await p.evaluate(() => window.__sky.bs && window.__sky.bs.mode !== 'enter'); if (ok) break; await p.waitForTimeout(200); }
  await clearTalk(); await p.waitForTimeout(1500); await clearTalk();
  await shot('02-boss-before');
  await p.evaluate(() => { const s = window.__sky; for (const e of s.en.filter((e) => e.kind === 'part')) e.hp = e.max * 0.35; });
  await p.waitForTimeout(700); await clearTalk(); await shot('03-boss-cracked');
  await p.evaluate(() => { const s = window.__sky; for (const e of s.en.filter((e) => e.kind === 'part')) s.damage(e, 1e6, 'shot', e.x, e.y); });
  await p.waitForTimeout(250); await shot('04-boss-break');
  await p.waitForTimeout(2200); await clearTalk(); await shot('05-boss-after');
  // 3) 웨이브 전투 (STAGE 6 · HARD)
  await p.evaluate(() => window.__skyFlow.start(6, 'hard'));
  await p.waitForFunction(() => window.__sky && document.querySelector('.sky-canvas'));
  await p.evaluate(() => { const s = window.__sky; s.cheat('god'); s.cheat('power'); s.cheat('auto'); });
  let best = 0;
  for (let i = 0; i < 80; i++) {
    await clearTalk();
    const n = await p.evaluate(() => window.__sky.en.filter((e) => e.kind === 'small').length);
    if (n > best && n >= 6) { best = n; await shot('06-wave'); }
    if (best >= 14) break;
    await p.waitForTimeout(400);
  }
  // 4) 수집 데이터 심기 (사진 3장 · 도장 · 미션 일부)
  await p.evaluate(() => {
    const ps = JSON.parse(localStorage.getItem('gona.skyadv.profiles'));
    const key = ps.list[0].id === ps.active ? 'gona.skyadv.rec2' : `gona.skyadv.rec2.${ps.active}`;
    const st = JSON.parse(localStorage.getItem(key) || '{"v":2,"boards":{},"daily":{}}');
    st.col = st.col || { clears: {}, flags: {}, seen: {} };
    Object.assign(st.col.clears, { 'mom:easy': { at: '2026-11-25', score: 512340, rank: 'A' }, 'dad:normal': { at: '2026-11-25', score: 801200, rank: 'B' }, 'halabeoji:hard': { at: '2026-11-25', score: 1203400, rank: 'S' } });
    st.col.stages = { 'mom:easy:1': { rank: 'A', hits: 0, bombs: 0, allParts: true }, 'mom:easy:2': { rank: 'B', hits: 1, bombs: 1, allParts: false }, 'dad:normal:3': { rank: 'S', hits: 0, bombs: 0, allParts: true }, 'halabeoji:hard:3': { rank: 'A', hits: 2, bombs: 1, allParts: true }, 'halabeoji:hard:6': { rank: 'B', hits: 3, bombs: 2, allParts: false } };
    st.col.counts = { allParts: 3 };
    localStorage.setItem(key, JSON.stringify(st));
  });
  await p.goto(url + '?skytest'); await p.waitForSelector('.ttl-start'); await p.waitForTimeout(1200); await shot('07-title');
  await p.tap('text=앨범 · 업적'); await p.waitForSelector('.album'); await p.waitForTimeout(900); await shot('08-album');
  for (const [i, k] of [[0, 'easy'], [4, 'normal'], [14, 'hard']]) {
    const cards = await p.$$('.alb-card');
    await cards[i].tap(); await p.waitForSelector('.polaroid'); await p.waitForTimeout(600); await shot(`09-photo-${k}`);
    await p.tap('.alb-view'); await p.waitForTimeout(200);
  }
  await p.tap('.recs-tabs button:nth-child(2)'); await p.waitForTimeout(500); await shot('10-badges');
  await p.tap('.recs-tabs button:nth-child(3)'); await p.waitForTimeout(400); await shot('11-missions');
  const mis = await p.$$eval('.alb-ach li.done span', (e) => e.map((x) => x.innerText));
  console.log('웨이브 동시 적 최대', best, '| 달성 미션', mis.length, mis.join(' / '), '| 오류', errs.length, errs.slice(0, 2), '| 실패 요청', bad.length, bad.slice(0, 2));
  await b.close();
})();
