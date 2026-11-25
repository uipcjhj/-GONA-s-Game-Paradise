/* 첫 실행 흐름 검수: 관문(터치) → 오프닝 자동 재생 → SKIP → 타이틀 → START → 선택 → STAGE 1 / 재방문 → 타이틀 바로 / 오프닝 다시보기 → 끝 → 타이틀
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-flow5-check.cjs <url> <outdir> [w] [h]   (url 에 ?skytest&firstrun 권장)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out, W = '393', H = '636'] = process.argv.slice(2);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [], bad = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  p.on('response', (r) => r.status() >= 400 && bad.push(r.status() + ' ' + r.url()));
  const tag = `${W}x${H}`; const log = [];
  const shot = (n) => p.screenshot({ path: `${out}/${tag}-${n}.png` });
  await p.goto(url); await p.waitForSelector('.gate', { timeout: 60000 }); log.push('1) 첫 실행 → 관문(TOUCH TO START)'); await p.waitForTimeout(800); await shot('0gate');
  await p.tap('.gate'); await p.waitForSelector('.oc'); log.push('2) 터치 → 오프닝 자동 재생');
  for (const [t, n] of [[3, 'op-03s-eat'], [15.5, 'op-15s-strain'], [19.4, 'op-19s-cry'], [22, 'op-22s-sleep'], [40.5, 'op-40s-hero']]) {
    await p.waitForFunction((t) => window.__skyOpening && window.__skyOpening.t() >= t, t, { timeout: 70000 }); await shot(n);
  }
  const dpr = await p.evaluate(() => window.__skyOpening.dpr && window.__skyOpening.dpr());
  await p.tap('.oc-skip'); await p.waitForSelector('.ttl-start', { timeout: 15000 }); log.push(`3) SKIP → 타이틀 (오프닝 해상도 배율 ${dpr})`);
  await p.waitForTimeout(1500);
  if (await p.$('.nick-box')) { await shot('1nick'); await p.fill('.nick-box input', '테스트아빠'); await p.tap('.nick-box .sky-btn-go'); log.push('3-1) 닉네임 입력 → ' + await p.$eval('.ttl2-foot', (e) => e.innerText)); }
  await p.waitForTimeout(1200); await shot('1title');
  const scroll = await p.evaluate(() => document.scrollingElement.scrollHeight - document.scrollingElement.clientHeight);
  await p.tap('.ttl-start'); await p.waitForSelector('.sel-art', { timeout: 15000 }); log.push('4) START → 캐릭터 선택'); await p.waitForTimeout(700); await shot('2select');
  await p.tap('.sky-btn-go'); await p.waitForSelector('.sky-canvas', { timeout: 30000 }); await p.waitForTimeout(2500); log.push('5) 출격 → STAGE 1'); await shot('3stage1');
  await p.goto(url); await p.waitForSelector('.ttl-start, .gate', { timeout: 60000 });
  log.push(`6) 재방문 → ${(await p.$('.gate')) ? '관문(틀림)' : '타이틀 바로'}`);
  await p.waitForTimeout(1200);
  log.push(`6-1) 재방문 닉네임 창: ${(await p.$('.nick-box')) ? '또 뜸(틀림)' : '안 뜸'}`);
  await p.tap('text=앨범 · 업적'); await p.waitForSelector('.album'); await p.waitForTimeout(800); await shot('4album');
  await p.tap('.recs-tabs button:nth-child(2)'); await p.waitForTimeout(400); await shot('5badges');
  await p.tap('.recs-tabs button:nth-child(3)'); await p.waitForTimeout(400); await shot('6ach');
  log.push(`6-2) 앨범: 잠긴 사진 ${await p.$$eval('.alb-card.locked', (e) => e.length)}장 · 업적 ${await p.$$eval('.alb-ach li', (e) => e.length)}개`);
  await p.tap('.album .sky-btn'); await p.waitForSelector('.ttl-start');
  await p.tap('text=오프닝 다시보기'); await p.waitForSelector('.oc'); await p.waitForTimeout(1500);
  await p.tap('.oc-skip'); await p.waitForSelector('.ttl-start', { timeout: 15000 }); log.push('7) 오프닝 다시보기 → SKIP → 타이틀');
  log.push(`타이틀 세로 스크롤 ${scroll}px · 콘솔 오류 ${errs.length} ${errs.slice(0, 2).join(' | ')} · 실패 요청 ${bad.length} ${bad.slice(0, 2).join(' | ')}`);
  console.log(tag + '\n' + log.join('\n'));
  await b.close();
})();
