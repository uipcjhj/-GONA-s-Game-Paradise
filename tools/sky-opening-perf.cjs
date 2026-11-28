/* 오프닝 프레임 측정 (데스크톱 Chromium · CPU 4배 느리게 = 휴대폰 근사)
 *  rAF 간격 기록 → 평균 FPS · 33ms 이상(=30fps 미만) 프레임 수 · 50ms 이상 끊김 수 · 최장 프레임 · 롱태스크
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-opening-perf.cjs <url(끝 /)> <old|new> [초=46] [w] [h]
 *   old = 현재 오프닝(?preview → 오프닝) · new = 스토리북 오프닝(?preview&opening=2 → 오프닝, AUTO 로 끝까지)
 */
const { chromium } = require('playwright');
const [url, which = 'old', secs = '46', w = '393', h = '636'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await p.goto(url + '?preview' + (which === 'new' ? '&opening=2' : ''));
  await p.waitForSelector('.pv-box', { timeout: 60000 });
  await p.evaluate(() => {
    window.__ft = []; window.__lt = [];
    let last = performance.now();
    const loop = (t) => { window.__ft.push(t - last); last = t; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(e.duration); }).observe({ type: 'longtask', buffered: true }); } catch { /* 미지원 */ }
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await p.tap('.pv-opening');
  if (which === 'new') { await p.waitForSelector('.os-auto', { timeout: 30000 }); await p.tap('.os-auto'); }
  await p.evaluate(() => { window.__ft.length = 0; window.__lt.length = 0; });
  const t0 = Date.now();
  await p.waitForTimeout(+secs * 1000);
  const r = await p.evaluate(() => {
    const f = window.__ft.filter((x) => x > 0 && x < 2000);
    const sum = f.reduce((a, x) => a + x, 0);
    return { frames: f.length, fps: +(f.length / (sum / 1000)).toFixed(1), over33: f.filter((x) => x > 33.4).length, over50: f.filter((x) => x > 50).length, worst: Math.round(Math.max(...f)), longTasks: window.__lt.length, longTaskMs: Math.round(window.__lt.reduce((a, x) => a + x, 0)), heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null };
  });
  console.log(JSON.stringify({ which, size: `${w}x${h}`, secs: Math.round((Date.now() - t0) / 1000), ...r }));
  await b.close();
})();
