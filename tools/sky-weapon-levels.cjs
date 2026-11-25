/* 무기 진화 Lv1~4 · 동료별 DPS 측정 (고정 표적 2개 · 고나 정지 · 20초 자동 사격) — 사람 플레이 대체 아님, 비교용
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-weapon-levels.cjs <url?skytest> [ns]
 */
const { chromium } = require('playwright');
const [url, ns = 'gona.skyadv'] = process.argv.slice(2);
const FAMS = ['mom', 'dad', 'imo', 'halmeoni', 'halabeoji', 'samchon'];
(async () => {
  const b = await chromium.launch();
  const rows = [];
  for (const fam of FAMS) {
    const ctx = await b.newContext({ viewport: { width: 393, height: 636 } });
    await ctx.addInitScript(([f, n]) => { localStorage.setItem(n + '.fam', f); localStorage.setItem(n + '.opened', '1'); }, [fam, ns]);
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(url); await page.waitForSelector('.ttl-start', { timeout: 60000 });
    await page.evaluate(() => window.__skyFlow.start(1, 'normal'));
    await page.waitForFunction(() => window.__sky && document.querySelector('.sky-canvas'), null, { timeout: 30000 });
    const r = await page.evaluate(() => {
      const s = window.__sky; cancelAnimationFrame(s.raf); s.cheat('god');
      s.en.length = 0; s.eb.length = 0; s.stepIdx = s.st.script.length; s.spawnQ.length = 0; s.block = 'none';
      s.px = 90; s.py = 260; s.cx = 122; s.cy = 250;
      let dealt = 0; const by = {}; const tg = [];
      const od = s.damage.bind(s);
      s.damage = (e, d, src, hx, hy) => { if (tg.includes(e)) { dealt += d; by[src] = (by[src] || 0) + d; } return od(e, d, src, hx, hy); };
      for (const x of [90, 122]) { s.spawnEnemy('gunship', x, 'hold', 1, tg.length, 60); const e = s.en[s.en.length - 1]; e.hp = 1e9; e.max = 1e9; e.score = 0; tg.push(e); }
      const keep = (secs) => { for (let i = 0; i < secs * 60; i++) { s.sim(1 / 60); s.gauge = 0; tg.forEach((e) => { if (!s.en.includes(e)) s.en.push(e); e.dead = false; e.y = 60; e.hp = 1e9; }); } };
      const out = [];
      for (let L = 1; L <= 4; L++) {
        s.power = L; dealt = 0; for (const k in by) delete by[k];
        keep(20);
        out.push({ L, dps: +(dealt / 20).toFixed(1), by: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, +(v / 20).toFixed(1)])) });
      }
      return out;
    });
    for (const x of r) rows.push({ fam, ...x });
    console.log(fam, r.map((x) => `Lv${x.L} ${x.dps} ${JSON.stringify(x.by)}`).join(' | '), errs.length ? 'ERR ' + errs[0] : '');
    await ctx.close();
  }
  await b.close();
})();
