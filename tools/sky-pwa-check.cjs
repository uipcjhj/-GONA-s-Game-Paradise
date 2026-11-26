/* PWA 검수: manifest · 아이콘 · Service Worker 등록 · 오프라인 재실행 · 새 버전 감지 · 타이틀 배치
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-pwa-check.cjs <url(끝 /)> <outdir> [distDir(새 버전 감지 시험용 · 로컬만)]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out, dist] = process.argv.slice(2);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const res = [];
  const ok = (n, c, x = '') => res.push(`${c ? 'PASS' : 'FAIL'} · ${n}${x ? ' — ' + x : ''}`);
  for (const [w, h] of [[393, 636], [390, 844]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'allow' });
    await ctx.addInitScript(() => localStorage.setItem('gona.skyadv.opened', '1'));
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(url);
    await p.waitForSelector('.gate', { timeout: 60000 });
    await p.tap('.gate');
    await p.waitForSelector('.ttl-start');
    if (await p.waitForSelector('.nick-box', { timeout: 3000 }).catch(() => null)) { await p.fill('.nick-box input', 'PWA검수'); await p.tap('.nick-box .sky-btn-go'); }
    await p.waitForTimeout(1500);
    const scroll = await p.evaluate(() => document.scrollingElement.scrollHeight - innerHeight);
    await p.screenshot({ path: `${out}/title-${w}x${h}.png` });
    ok(`${w}×${h} 타이틀: 설치 버튼 · 세로 스크롤 없음`, !!(await p.$('.pwa-install')) && scroll <= 0, `스크롤 ${scroll}px`);
    if (w !== 393) { await ctx.close(); continue; }
    const man = await p.evaluate(async () => { const l = document.querySelector('link[rel=manifest]'); const r = await fetch(l.href); return r.ok ? r.json() : null; });
    ok('manifest: standalone · 세로 · 시작/범위 = 이 폴더', man && man.display === 'standalone' && man.orientation === 'portrait' && man.scope === './' && man.start_url.startsWith('./'), man ? `${man.short_name} · icons ${man.icons.length}` : '없음');
    const icons = await p.evaluate(async () => Promise.all(['pwa/icon-192.png', 'pwa/icon-512.png', 'pwa/apple-touch-icon.png'].map((u) => fetch(u).then((r) => r.status))));
    ok('아이콘 192 · 512 · apple-touch 180', icons.every((s) => s === 200), icons.join(','));
    const meta = await p.evaluate(() => ({ apple: !!document.querySelector('meta[name=apple-mobile-web-app-capable]'), touch: document.querySelector('link[rel=apple-touch-icon]')?.getAttribute('href') }));
    ok('iPhone 홈 화면 meta · 아이콘', meta.apple && meta.touch === './pwa/apple-touch-icon.png');
    await p.waitForFunction(() => navigator.serviceWorker.ready.then(() => true), null, { timeout: 20000 });
    await p.reload();
    await p.waitForSelector('.gate');
    const ctl = await p.evaluate(() => !!navigator.serviceWorker.controller);
    const scope = await p.evaluate(async () => (await navigator.serviceWorker.getRegistration()).scope);
    ok('Service Worker 등록 · 이 폴더 범위', ctl && scope.startsWith(url), scope);
    // 오프라인 전체 받기 → 비행기 모드 → 다시 열기 → 스테이지 1 시작
    await p.tap('.gate');
    await p.waitForSelector('.ttl-start');
    await p.tap('.pwa-install');
    await p.tap('text=오프라인용 전체 받기');
    await p.waitForFunction(() => /완료/.test(document.body.innerText), null, { timeout: 180000 });
    ok('오프라인용 전체 받기 완료', true, await p.$eval('.prof-box button.sky-btn:not(.sky-btn-go)', (e) => e.innerText).catch(() => ''));
    await p.tap('text=닫기');
    await ctx.setOffline(true);
    await p.reload();
    await p.waitForSelector('.gate', { timeout: 30000 });
    await p.tap('.gate');
    await p.waitForSelector('.ttl-start', { timeout: 30000 });
    await p.tap('.ttl-start');
    await p.waitForSelector('.sel-main', { timeout: 15000 });
    await p.tap('text=출격!');
    const started = await p.waitForSelector('.sky-canvas', { timeout: 30000 }).then(() => true).catch(() => false);
    await p.waitForTimeout(2500);
    await p.screenshot({ path: `${out}/offline-play.png` });
    ok('오프라인(비행기 모드)에서 다시 열고 STAGE 1 출격', started);
    await ctx.setOffline(false);
    // 새 버전 감지: sw.js 내용이 바뀌면 타이틀에 업데이트 버튼 (로컬 dist 를 직접 바꿔 시험)
    if (dist) {
      const swp = `${dist}/sw.js`;
      const orig = fs.readFileSync(swp, 'utf8');
      fs.writeFileSync(swp, orig.replace(/const VER = '[^']+'/, "const VER = 'test-next'"));
      await p.goto(url);
      await p.waitForSelector('.gate');
      await p.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
      await p.tap('.gate');
      const up = await p.waitForSelector('.pwa-update', { timeout: 20000 }).then(() => true).catch(() => false);
      await p.screenshot({ path: `${out}/update.png` });
      ok('새 버전 감지 → 업데이트 버튼', up);
      if (up) {
        await p.tap('.pwa-update');
        await p.waitForTimeout(2500);
        const ver = await p.evaluate(async () => (await caches.keys()).join(','));
        ok('업데이트 → 새 캐시로 교체 · 다시 불러옴', ver.includes('test-next') && !/gona-sky-(?!test-next)/.test(ver), ver);
      }
      fs.writeFileSync(swp, orig);
    }
    ok('콘솔 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | '));
    await ctx.close();
  }
  console.log(res.join('\n'));
  await b.close();
})();
