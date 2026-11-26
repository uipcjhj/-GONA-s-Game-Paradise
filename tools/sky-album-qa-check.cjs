/* 추억앨범 교체 컷 실제 화면 확인: 할아버지 HARD FINAL 격파 → 찰칵·결과 사진 / 앨범 할아버지 탭 썸네일 / 교체 컷 확대
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-album-qa-check.cjs <url(끝 /)> <outdir> [w] [h]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out, w = '393', h = '636'] = process.argv.slice(2);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { localStorage.setItem('gona.skyadv.opened', '1'); localStorage.setItem('gona.skyadv.fam', 'halabeoji'); });
  const p = await ctx.newPage();
  const errs = [];
  const bad = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  p.on('response', (r) => r.status() >= 400 && bad.push(r.url()));
  const shot = (n) => p.screenshot({ path: `${out}/${n}.png` });
  const log = [];
  const tapTalk = async () => { if (await p.$('.sky-talk')) await p.tap('.sky-talk', { position: { x: 20, y: 20 } }).catch(() => {}); };
  await p.goto(url + '?skytest');
  await p.waitForSelector('.ttl-start', { timeout: 60000 });
  await p.evaluate(() => window.__skyFlow.start(3, 'hard'));
  await p.waitForFunction(() => window.__sky && document.querySelector('.sky-canvas'));
  await p.evaluate(() => { const s = window.__sky; s.cheat('god'); s.cheat('boss'); });
  for (let i = 0; i < 80; i++) { await tapTalk(); if (await p.evaluate(() => window.__sky.bs && window.__sky.bs.mode !== 'enter' && !window.__sky.talking)) break; await p.waitForTimeout(150); }
  await p.evaluate(() => { const s = window.__sky; for (const e of s.en.filter((e) => e.kind === 'part')) s.damage(e, 1e6, 'shot', e.x, e.y); s.boss.hp = 1; s.damage(s.boss, 99, 'shot', s.boss.x, s.boss.y); });
  for (let i = 0; i < 80 && !(await p.$('.snap')); i++) { await tapTalk(); await p.waitForTimeout(150); }
  await p.waitForTimeout(900);
  await shot('1-snap');
  log.push('찰칵: ' + (await p.$eval('.snap p', (e) => e.innerText).catch(() => '없음')) + ' · 사진 ' + (await p.$eval('.snap-card img', (e) => e.getAttribute('src').split('/').pop()).catch(() => '')));
  await p.waitForSelector('.res', { timeout: 10000 });
  await p.waitForTimeout(2800);
  await shot('2-result');
  log.push('결과 사진 카드: ' + (await p.$eval('.res-photo span', (e) => e.innerText).catch(() => '없음')));
  await p.goto(url + '?skytest');
  await p.waitForSelector('.ttl-start');
  await p.waitForTimeout(600);
  await p.tap('.ttl-start'); await p.waitForSelector('.lob-story', { timeout: 15000 }); await p.tap('.lob-nav button:nth-child(2)');
  await p.waitForSelector('.hall');
  await p.tap('.recs-tabs button:nth-child(2)');
  await p.waitForTimeout(400);
  await p.tap('.alb-fams button:has-text("할아버지")');
  await p.waitForTimeout(900);
  await shot('3-album-halabeoji');
  const thumbs = await p.$$eval('.alb-prow .alb-card img', (e) => e.map((x) => `${x.getAttribute('src').split('/').pop()}:${x.naturalWidth}`));
  log.push('할아버지 썸네일 ' + thumbs.length + '장 · 불러오기 실패 ' + thumbs.filter((t) => t.endsWith(':0')).length);
  const open = await p.$('.alb-prow .alb-card:not(.locked)');
  await open.tap();
  await p.waitForSelector('.polaroid');
  await p.waitForTimeout(900);
  await shot('4-view');
  log.push('확대: ' + (await p.$eval('.polaroid img', (e) => `${e.getAttribute('src').split('/').pop()} ${e.naturalWidth}px`)));
  console.log(log.join('\n') + `\n오류 ${errs.length} ${errs.slice(0, 2).join(' | ')} · 실패 요청 ${bad.length}`);
  await b.close();
})();
