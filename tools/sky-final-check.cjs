/* 최종 통합 검수: FINAL 클리어 → 승리 세리머니 → 찰칵 → 결과(NEW PHOTO/BADGE/MISSION 알림) → 명예의 전당 · 사진 확대(PNG 저장 버튼) · 프로필 창
 *  + 스테이지 인트로 카드 · 보스 등장 경고(실루엣/이름표) · 분노 컷인
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-final-check.cjs <url(끝 /)> <outdir> [fam] [diff]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out, fam = 'imo', diff = 'normal'] = process.argv.slice(2);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 393, height: 636 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((f) => { localStorage.setItem('gona.skyadv.opened', '1'); localStorage.setItem('gona.skyadv.fam', f); }, fam);
  const p = await ctx.newPage();
  const errs = [];
  const bad = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  p.on('response', (r) => r.status() >= 400 && bad.push(r.url()));
  const shot = (n) => p.screenshot({ path: `${out}/${n}.png` });
  const log = [];
  // 닉네임 만들기 (firstrun)
  await p.goto(url + '?skytest&firstrun'); await p.waitForSelector('.nick-box', { timeout: 60000 });
  await p.fill('.nick-box input', '최종검수'); await p.tap('.nick-box .sky-btn-go'); await p.waitForTimeout(600);
  // 스테이지 인트로 카드
  await p.goto(url + '?skytest'); await p.waitForSelector('.ttl-start');
  await p.evaluate((d) => window.__skyFlow.start(6, d), diff);
  await p.waitForSelector('.st-intro', { timeout: 30000 }); await p.waitForTimeout(700); await shot('a-stage-intro');
  log.push('스테이지 인트로: ' + (await p.$eval('.st-intro', (e) => e.innerText.replace(/\s+/g, ' '))));
  // 보스 경고(실루엣·이름표)
  await p.evaluate(() => { const s = window.__sky; s.cheat('god'); s.cheat('boss'); });
  for (let i = 0; i < 40; i++) { if (await p.$('.sky-talk')) await p.tap('.sky-talk', { position: { x: 20, y: 20 } }).catch(() => {}); const w = await p.evaluate(() => window.__sky.block === 'warning' && window.__sky.warnT < 2.6); if (w) break; await p.waitForTimeout(100); }
  await shot('b-boss-warning');
  // 분노 컷인: 보스 체력 2페이즈 직전까지
  for (let i = 0; i < 60; i++) { if (await p.$('.sky-talk')) await p.tap('.sky-talk', { position: { x: 20, y: 20 } }).catch(() => {}); if (await p.evaluate(() => window.__sky.bs && window.__sky.bs.mode !== 'enter' && !window.__sky.talking)) break; await p.waitForTimeout(150); }
  await p.waitForTimeout(500);
  await p.evaluate(() => { const s = window.__sky; s.boss.hp = s.boss.max * 0.6; s.damage(s.boss, 5, 'shot', s.boss.x, s.boss.y); });
  await p.waitForTimeout(450); await shot('c-rage');
  for (let i = 0; i < 20 && (await p.$('.sky-talk')); i++) { await p.tap('.sky-talk', { position: { x: 20, y: 20 } }).catch(() => {}); await p.waitForTimeout(80); }
  // 격파 → 세리머니 → 결과
  await p.evaluate(() => { const s = window.__sky; for (const e of s.en.filter((e) => e.kind === 'part')) s.damage(e, 1e6, 'shot', e.x, e.y); s.boss.hp = 1; s.damage(s.boss, 99, 'shot', s.boss.x, s.boss.y); });
  await p.waitForTimeout(500); await shot('d-boss-defeat-slowmo');
  for (let i = 0; i < 80 && !(await p.$('.cer')); i++) { if (await p.$('.sky-talk')) await p.tap('.sky-talk', { position: { x: 20, y: 20 } }).catch(() => {}); await p.waitForTimeout(150); }
  await p.waitForTimeout(1500); await shot('e-ceremony');
  await p.waitForTimeout(1600); await shot('f-ceremony-snap');
  await p.waitForSelector('.res', { timeout: 10000 }); await p.waitForTimeout(2600); await shot('g-result');
  log.push('결과 알림: ' + (await p.$$eval('.res-unlocks li', (e) => e.map((x) => x.innerText).join(' | ')).catch(() => '(없음)')));
  log.push('사진: ' + (await p.$eval('.res-photo', (e) => e.innerText.replace(/\s+/g, ' ')).catch(() => '(없음)')));
  // 앨범: 명예의 전당 · 사진 확대 · 프로필
  await p.goto(url + '?skytest'); await p.waitForSelector('.ttl-start'); await p.waitForTimeout(900); await shot('h-title');
  await p.tap('text=앨범 · 업적'); await p.waitForSelector('.hall'); await p.waitForTimeout(700); await shot('i-hall');
  await p.tap('.recs-tabs button:nth-child(2)'); await p.waitForTimeout(400);
  const open = await p.$('.alb-card:not(.locked)');
  if (open) { await open.tap(); await p.waitForSelector('.polaroid'); await p.waitForTimeout(600); await shot('j-photo-view'); log.push('사진 확대: PNG 버튼 ' + !!(await p.$('.alb-save .sky-btn'))); await p.tap('.alb-view p'); }
  await p.tap('.album .sel-btns .sky-btn'); await p.waitForSelector('.ttl-start');
  await p.tap('.ttl2-nick'); await p.waitForSelector('.prof-box'); await p.tap('text=내보내기'); await p.waitForTimeout(500); await shot('k-profile');
  log.push('백업 코드 길이 ' + (await p.$eval('.prof-box textarea', (e) => e.value.length)));
  console.log(log.join('\n') + `\n오류 ${errs.length} ${errs.slice(0, 2).join(' | ')} · 실패 요청 ${bad.length} ${bad.slice(0, 2).join(' | ')}`);
  await b.close();
})();
