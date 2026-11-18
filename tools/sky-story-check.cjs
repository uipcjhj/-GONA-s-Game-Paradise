// 응가 테마 스토리 흐름 자동 검수: 타이틀 → (오프닝 스킵) → 선택 → 스테이지 진행 (엔진 sim 으로 빠르게) →
// 대화창이 뜨면 대사 기록·캡처·터치로 진행 → 클리어 → 다음 스테이지 … → 엔딩 → 크레딧
// 사용: NODE_PATH=$(npm root -g) node tools/sky-story-check.cjs <url> <outdir> [w] [h] [fam] [stages=1-6] [shots=1]
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out, W = '393', H = '636', FAM = 'mom', RANGE = '1-6', SHOTS = '1'] = process.argv.slice(2);
const ORDER = ['mom', 'dad', 'imo', 'halmeoni', 'halabeoji', 'samchon'];
const [s0, s1] = RANGE.split('-').map(Number);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: +W, height: +H }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [], bad = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  page.on('response', (r) => r.status() >= 400 && bad.push(r.status() + ' ' + r.url()));
  const tag = `${W}x${H}`;
  let n = 0;
  const shot = async (name) => { if (SHOTS === '1') await page.screenshot({ path: `${out}/${tag}-${String(++n).padStart(3, '0')}-${name}.png` }); };
  await page.goto(url);
  await page.waitForSelector('.ttl-start');
  await page.tap('.ttl-start');
  await page.waitForSelector('.sel-art, .opening-skip');
  if (await page.$('.opening-skip')) await page.tap('.opening-skip');
  await page.waitForSelector('.sel-art');
  await page.tap(`.sel-roster li:nth-child(${ORDER.indexOf(FAM) + 1}) button`);
  await page.waitForTimeout(150);
  if (s0 > 1) await page.evaluate((st) => window.__skyFlow.start(st), s0);
  else await page.tap('.sky-btn-go');
  const log = [];
  for (let st = s0; st <= s1; st++) {
    await page.waitForSelector('.sky-canvas');
    await page.waitForFunction(() => window.__sky && window.__sky.debug().stage > 0);
    await page.waitForTimeout(400);
    await page.evaluate(() => { window.__sky.cheat('god'); window.__sky.cheat('power'); window.__sky.cheat('auto'); });
    const seen = new Set();
    let lastKeyShot = '';
    const t0 = Date.now();
    for (;;) {
      if (Date.now() - t0 > 240000) { log.push(`S${st} 시간 초과`); break; }
      const phase = await page.evaluate(() => (document.querySelector('.tally') ? 'tally' : document.querySelector('.sky.end') ? 'ending' : document.querySelector('.sky-overlay .sky-btn-go') && !document.querySelector('.tally') ? 'other' : 'play'));
      if (phase === 'tally' || phase === 'ending') break;
      const talk = await page.evaluate(() => window.__skyTalk ? { i: window.__skyTalk.i, n: window.__skyTalk.n, name: window.__skyTalk.name, text: window.__skyTalk.text } : null);
      const d = await page.evaluate(() => window.__sky ? window.__sky.debug() : null);
      if (talk) {
        const k = `${talk.name}|${talk.text}`;
        if (!seen.has(k)) {
          seen.add(k);
          log.push(`S${st} [${d ? d.vil || d.block : ''} ph${d ? d.phase : ''}] ${talk.name}: ${talk.text}`);
          if (talk.i === 0 && lastKeyShot !== k) { lastKeyShot = k; await page.waitForTimeout(talk.text.length * 34 + 120); await shot(`s${st}-talk`); }
        }
        // 실제 터치로 진행 (찍는 중이면 한 번 더)
        await page.tap('.sky-talk', { position: { x: 30, y: 30 } });
        await page.waitForTimeout(30);
        await page.tap('.sky-talk', { position: { x: 30, y: 30 } }).catch(() => {});
        await page.waitForTimeout(60);
        continue;
      }
      if (d && d.over) { await page.waitForTimeout(300); continue; }
      // 빌런 등장 장면 캡처 (대화 직전)
      if (d && d.vil && d.vil.endsWith(':in') && !seen.has('vil' + d.vil + d.step)) { seen.add('vil' + d.vil + d.step); await shot(`s${st}-villain`); }
      await page.evaluate(() => window.__sky.sim(1.5));
      await page.waitForTimeout(20);
    }
    await shot(`s${st}-clear`);
    if (st < s1) {
      await page.waitForSelector('.tally .sky-btn-go', { timeout: 15000 });
      await page.tap('.tally .sky-btn-go');
      await page.waitForTimeout(300);
    }
  }
  fs.writeFileSync(`${out}/${tag}-log.txt`, log.join('\n'));
  console.log(log.join('\n'));
  console.log('실패 요청', bad.length ? bad : '없음', '· 콘솔 오류', errs.length ? errs : '없음');
  await b.close();
})();
