/* 보스 부위 파괴 검수: 스테이지마다 보스 바로 → 부위 그대로 캡처 → 부위 하나씩 파괴(효과 기록) → 잔해 캡처 → 보스 격파 → 결과 화면 캡처
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-parts-check.cjs <url?skytest> <outdir> [w] [h] [ns]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out, W = '393', H = '636', ns = 'gona.skyadv'] = process.argv.slice(2);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((n) => localStorage.setItem(n + '.opened', '1'), ns);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.goto(url); await page.waitForSelector('.ttl-start', { timeout: 60000 });
  for (let st = 1; st <= 6; st++) {
    await page.evaluate((st) => window.__skyFlow.start(st, 'normal'), st);
    await page.waitForFunction(() => window.__sky && document.querySelector('.sky-canvas'), null, { timeout: 30000 });
    await page.waitForTimeout(600);
    await page.evaluate(() => { const s = window.__sky; s.cheat('god'); s.cheat('boss'); });
    // 대화가 뜨면 넘기며 보스 등장 대기
    for (let i = 0; i < 80; i++) {
      const ok = await page.evaluate(() => { const s = window.__sky; return s.bs && s.bs.mode !== 'enter'; });
      if (ok && !(await page.$('.sky-talk'))) break;
      if (await page.$('.sky-talk')) await page.tap('.sky-talk', { position: { x: 20, y: 20 } }).catch(() => {});
      await page.evaluate(() => window.__sky.sim(0.3));
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/s${st}-1parts.png` });
    const info = await page.evaluate(() => {
      const s = window.__sky; const log = [];
      const parts = s.en.filter((e) => e.kind === 'part');
      for (const p of parts) {
        const before = { cut: [...s.bs.cut], rage: [...s.bs.rage], weak: s.bs.weakMul, rest: s.bs.restMul };
        s.damage(p, 1e6, 'shot', p.x, p.y);
        log.push(`${p.pdef ? p.pdef.name : p.art}: +${p.score} cut[${s.bs.cut}] rage[${s.bs.rage}] weak×${s.bs.weakMul} rest×${s.bs.restMul.toFixed(2)}`);
      }
      s.sim(0.4);
      return { log, broken: s.partsBroken, total: s.partsTotal, wrecks: s.bs.wrecks.length };
    });
    await page.screenshot({ path: `${out}/s${st}-2wrecks.png` });
    console.log(`S${st} 부위 ${info.broken}/${info.total} · 잔해 ${info.wrecks}\n  ` + info.log.join('\n  '));
    await page.evaluate(() => { const s = window.__sky; s.boss.hp = 1; s.damage(s.boss, 999, 'shot', s.boss.x, s.boss.y); });
    for (let i = 0; i < 60 && !(await page.$('.res')); i++) {
      if (await page.$('.sky-talk')) await page.tap('.sky-talk', { position: { x: 20, y: 20 } }).catch(() => {});
      await page.evaluate(() => window.__sky && window.__sky.sim(0.5));
      await page.waitForTimeout(150);
      if (st === 6 && await page.$('.pe')) break;
    }
    if (await page.$('.res')) {
      await page.waitForTimeout(1600);
      await page.screenshot({ path: `${out}/s${st}-3result.png` });
      const t = await page.$eval('.res', (e) => e.innerText.replace(/\s+/g, ' ').slice(0, 200));
      console.log('  결과:', t);
    } else console.log('  결과 화면 없음 (FINAL → 엔딩)', !!(await page.$('.pe')));
  }
  console.log('오류', errs.length, errs.slice(0, 3));
  await b.close();
})();
