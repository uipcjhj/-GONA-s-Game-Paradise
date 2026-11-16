// 동료 비행 스프라이트 실제 프레임 전환 검사: 게임 캔버스에서 동료 주변을 짧은 간격으로 잘라 저장 + 엔진이 고른 프레임 기록
// 사용: NODE_PATH=$(npm root -g) node tools/sky-fly-anim-check.cjs <url> <outdir> [fams=mom,dad,...] [w] [h]
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out, famArg = 'mom,dad,imo,halmeoni,halabeoji,samchon', W = '393', H = '636'] = process.argv.slice(2);
const ORDER = ['mom', 'dad', 'imo', 'halmeoni', 'halabeoji', 'samchon'];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: +W, height: +H }, isMobile: true, hasTouch: true })).newPage();
  const errs = [], bad = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  page.on('response', (r) => r.status() >= 400 && bad.push(r.status() + ' ' + r.url()));
  await page.goto(url);
  await page.waitForSelector('.ttl-start'); await page.tap('.ttl-start');
  await page.waitForSelector('.sel-art, .opening-skip'); if (await page.$('.opening-skip')) await page.tap('.opening-skip');
  await page.waitForSelector('.sel-art');
  for (const f of famArg.split(',')) {
    await page.tap(`.sel-roster li:nth-child(${ORDER.indexOf(f) + 1}) button`); await page.waitForTimeout(150);
    await page.tap('.sky-btn-go'); await page.waitForSelector('.sky-canvas'); await page.waitForTimeout(2500);
    await page.evaluate(() => window.__sky.cheat('god'));
    const samples = [];
    for (let i = 0; i < 60; i++) {
      samples.push(await page.evaluate(() => {
        const s = window.__sky; const c = document.querySelector('.sky-canvas');
        const attacking = s.cKick > 0.15 || (s.fam === 'halabeoji' && s.shield > 0) || (s.sp !== null && s.sp.id !== 'gona');
        const fr = (attacking ? 2 : 0) + (Math.floor(s.t * (attacking ? 10 : 6)) % 2);
        const x = Math.round((s.cx - 30) * 2), y = Math.round((s.cy - 48) * 2);
        const t = document.createElement('canvas'); t.width = 120; t.height = 140;
        t.getContext('2d').drawImage(c, x, y, 120, 140, 0, 0, 120, 140);
        return { fr, t: s.t, png: t.toDataURL() };
      }));
      await page.waitForTimeout(30);
    }
    samples.forEach((s, i) => fs.writeFileSync(`${out}/${f}-${String(i).padStart(2, '0')}-f${s.fr}.png`, Buffer.from(s.png.split(',')[1], 'base64')));
    const cnt = [0, 0, 0, 0]; samples.forEach((s) => cnt[s.fr]++);
    let sw = 0; for (let i = 1; i < samples.length; i++) if (samples[i].fr !== samples[i - 1].fr) sw++;
    console.log(f, '엔진 프레임 분포', cnt.join('/'), '· 전환', sw, '회 ·', (samples.at(-1).t - samples[0].t).toFixed(2), '초');
    await page.tap('.sky-pause'); await page.waitForSelector('.sky-overlay'); await page.tap('text=동료 바꾸기'); await page.waitForSelector('.sel-art');
  }
  console.log('실패 요청', bad.length ? bad : '없음', '· 콘솔 오류', errs.length ? errs : '없음');
  await b.close();
})();
