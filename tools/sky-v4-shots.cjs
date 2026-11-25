/* 아케이드 업그레이드 화면 캡처: 타이틀 · 선택 · 오늘의 도전 · (일일 도전 실제 진행 → 결과) · 기록 · 보스 부위 · 무기 Lv4
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-v4-shots.cjs <url?skytest> <outdir> [ns]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out, ns = 'gona.skyadv'] = process.argv.slice(2);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  for (const [w, h] of [[393, 636], [390, 844]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ctx.addInitScript((n) => localStorage.setItem(n + '.opened', '1'), ns);
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    const tag = `${w}x${h}`;
    const shot = (n) => p.screenshot({ path: `${out}/${tag}-${n}.png` });
    const scroll = async () => p.evaluate(() => { const el = document.scrollingElement; return el.scrollHeight > el.clientHeight + 1 ? el.scrollHeight - el.clientHeight : 0; });
    await p.goto(url); await p.waitForSelector('.ttl-start'); await p.waitForTimeout(2600);
    await shot('1title'); const sc1 = await scroll();
    await p.tap('.ttl2-daily'); await p.waitForSelector('.daily-card'); await p.waitForTimeout(700); await shot('2daily');
    // 일일 도전 실제 진행: 시작 → 보스까지 빠르게(sim) → 부위 전부 파괴 → 격파 → 결과
    await p.tap('.daily .sky-btn-go');
    await p.waitForFunction(() => window.__sky && document.querySelector('.sky-canvas'), null, { timeout: 30000 });
    await p.waitForTimeout(500);
    const rules = await p.evaluate(() => ({ bombs: window.__sky.bombs, hp: window.__sky.hp, power: window.__sky.power }));
    await p.evaluate(() => { const s = window.__sky; s.cheat('god'); s.cheat('power'); s.cheat('boss'); });
    for (let i = 0; i < 60; i++) {
      if (await p.$('.sky-talk')) await p.tap('.sky-talk', { position: { x: 20, y: 20 } }).catch(() => {});
      const ok = await p.evaluate(() => window.__sky.bs && window.__sky.bs.mode !== 'enter');
      if (ok && !(await p.$('.sky-talk'))) break;
      await p.evaluate(() => window.__sky.sim(0.3)); await p.waitForTimeout(60);
    }
    await p.evaluate(() => window.__sky.sim(1.2)); await p.waitForTimeout(200);
    await shot('3boss-parts');
    await p.evaluate(() => { const s = window.__sky; for (const e of s.en.filter((e) => e.kind === 'part').slice(0, 2)) s.damage(e, 1e6, 'shot', e.x, e.y); s.sim(0.25); });
    await shot('4part-break');
    await p.evaluate(() => { const s = window.__sky; for (const e of s.en.filter((e) => e.kind === 'part')) s.damage(e, 1e6, 'shot', e.x, e.y); s.boss.hp = 1; s.damage(s.boss, 99, 'shot', s.boss.x, s.boss.y); });
    for (let i = 0; i < 60 && !(await p.$('.res')); i++) { if (await p.$('.sky-talk')) await p.tap('.sky-talk', { position: { x: 20, y: 20 } }).catch(() => {}); await p.evaluate(() => window.__sky.sim(0.5)); await p.waitForTimeout(120); }
    await p.waitForTimeout(2200); await shot('5result');
    const resTxt = await p.$eval('.res', (e) => e.innerText.replace(/\s+/g, ' ').slice(0, 160)).catch(() => '(결과 없음)');
    await p.tap('.res .sky-btn:not(.sky-btn-go)'); await p.waitForSelector('.recs'); await p.waitForTimeout(400); await shot('6records-daily');
    await p.tap('.recs-tabs button:first-child'); await p.waitForTimeout(300); await shot('7records-stage');
    await p.tap('.recs .sky-btn:not(.sky-btn-go)'); await p.waitForSelector('.ttl-start');
    await p.tap('.ttl-start'); await p.waitForSelector('.sel-art'); await p.waitForTimeout(900); await shot('8select'); const sc8 = await scroll();
    console.log(tag, '규칙 적용', JSON.stringify(rules), '| 결과', resTxt, '| 스크롤', sc1, sc8, '| 오류', errs.length, errs.slice(0, 2));
    await ctx.close();
  }
  await b.close();
})();
