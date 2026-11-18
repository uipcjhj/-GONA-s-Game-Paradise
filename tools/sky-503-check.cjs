// GitHub Pages 의 잠깐 503 흉내: 그림 요청을 처음 한 번씩 503 으로 실패시켜도 게임이 정상으로 열리는지,
// 계속 실패하면 '다시 시도' 화면이 나오는지 확인
// 사용: NODE_PATH=$(npm root -g) node tools/sky-503-check.cjs <url> <outdir>
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out] = process.argv.slice(2);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  for (const mode of ['once', 'always']) {
    const ctx = await b.newContext({ viewport: { width: 393, height: 636 }, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    const seen = new Set(); let failed = 0;
    await p.route('**/*', (r) => {
      const u = r.request().url();
      const isImg = /\.(png|jpe?g)(\?|$)/.test(u) || u.includes('manifest.json');
      const target = mode === 'once' ? isImg && !seen.has(u.split('?')[0]) : /fx\/heart-p\.png/.test(u);
      if (isImg) seen.add(u.split('?')[0]);
      if (target) { failed++; return r.fulfill({ status: 503, body: 'busy' }); }
      return r.continue();
    });
    const t0 = Date.now();
    await p.goto(url);
    await p.waitForSelector('.ttl-start, .sky-panel', { timeout: 30000 });
    const ok = !!(await p.$('.ttl-start'));
    await p.screenshot({ path: `${out}/503-${mode}.png` });
    let extra = '';
    if (ok) {
      await p.tap('.ttl-start');
      await p.waitForSelector('.sel-art, .oc-skip');
      if (await p.$('.oc-skip')) { await p.waitForTimeout(3000); await p.screenshot({ path: `${out}/503-${mode}-opening.png` }); await p.tap('.oc-skip'); }
      await p.waitForSelector('.sel-art'); await p.tap('.sky-btn-go');
      await p.waitForSelector('.sky-canvas, .sky-panel', { timeout: 30000 });
      extra = (await p.$('.sky-canvas')) ? ' → STAGE 1 OK' : ' → STAGE 1 실패';
    } else {
      extra = ` · 다시 시도 버튼 ${(await p.$('text=다시 시도')) ? '있음' : '없음'}`;
    }
    console.log(`${mode === 'once' ? '모든 그림 첫 요청 503' : 'heart-p.png 계속 503'}: 503 ${failed}번 → ${ok ? '타이틀 정상' : '오류 화면'}${extra} (${((Date.now() - t0) / 1000).toFixed(1)}초)`);
    await ctx.close();
  }
  await b.close();
})();
