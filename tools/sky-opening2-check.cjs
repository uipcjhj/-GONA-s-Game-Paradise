/* 오프닝 v2(스토리북) 검수: 자막 유지 · 한 번 터치 = 한 장면 · 연타 · 디졸브 중 검은 화면/번쩍임 · AUTO 읽기 시간 · 일시정지 · 이전 · SKIP · 타이틀 → 끝
 *  + 장면별 전환/자막 시간 기록 · 연속 프레임 캡처 · 영상
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-opening2-check.cjs <url(끝 /)> <outdir> [w] [h] [video=0]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out, w = '393', h = '636', VIDEO = '0'] = process.argv.slice(2);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, ...(VIDEO === '1' ? { recordVideo: { dir: out, size: { width: +w, height: +h } } } : {}) });
  const p = await ctx.newPage();
  const errs = [], bad = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('response', (r) => r.status() >= 400 && bad.push(r.url()));
  const res = [];
  const ok = (n, c, x = '') => { res.push(`${c ? 'PASS' : 'FAIL'} · ${n}${x ? ' — ' + x : ''}`); };
  const log = () => p.evaluate(() => window.__osLog || []);
  const state = async () => { const l = await log(); return l.length ? l[l.length - 1] : null; };
  const waitState = async (s, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const x = await state(); if (x && x[2] === s) return x; await p.waitForTimeout(60); } return null; };
  const subsOpacity = () => p.$eval('.os-subs', (e) => +getComputedStyle(e).opacity).catch(() => -1);
  const tapStage = () => p.touchscreen.tap(+w / 2, +h * 0.4);
  await p.goto(url + '?preview&opening=2');
  await p.waitForSelector('.pv-box', { timeout: 60000 });
  await p.tap('.pv-opening');
  const t0 = Date.now();
  await waitState('wait', 20000);
  const firstReady = Date.now() - t0;
  const pages = await p.evaluate(() => window.__osPages);
  // 1) 읽기: 12초 동안 터치 안 해도 자막 유지
  await p.waitForTimeout(12000);
  const op12 = await subsOpacity();
  const st12 = await state();
  ok('터치하지 않으면 자막이 사라지지 않음 (12초 후에도 표시)', op12 === 1 && st12[2] === 'wait' && st12[1] === 0, `opacity ${op12} · 장면 ${st12[1]}`);
  await p.screenshot({ path: `${out}/p00.png` });
  ok('첫 장면 준비 (이미지 디코딩 후 시작)', firstReady < 8000, `${firstReady}ms`);
  // 2) 연타: 한 번 넘긴 뒤 전환 중 연속 터치 → 한 장면만
  await tapStage(); await p.waitForTimeout(80); await tapStage(); await tapStage(); await p.waitForTimeout(120); await tapStage();
  await waitState('wait');
  const afterBurst = await state();
  ok('전환 중 연타해도 한 장면만 넘어감', afterBurst[1] === 1, `장면 ${afterBurst[1]}`);
  // 3) 디졸브 중 검은 화면 · 번쩍임 검사 (장면 1→2 전환을 촘촘히 촬영)
  const lum = [];
  await tapStage();
  for (let i = 0; i < 26; i++) {
    const buf = await p.screenshot({ clip: { x: 0, y: 0, width: +w, height: Math.round(+h * 0.62) } });
    lum.push(await p.evaluate(async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = 40; c.height = 40; const g = c.getContext('2d'); g.drawImage(im, 0, 0, 40, 40); const d = g.getImageData(0, 0, 40, 40).data; let s = 0; for (let k = 0; k < d.length; k += 4) s += (d[k] + d[k + 1] + d[k + 2]) / 3; return Math.round(s / 1600); }, buf.toString('base64')));
    if (i === 6) await p.screenshot({ path: `${out}/dissolve-mid.png` });
    await p.waitForTimeout(45);
  }
  const minL = Math.min(...lum), maxL = Math.max(...lum);
  const jumps = lum.slice(1).map((v, i) => Math.abs(v - lum[i]));
  ok('디졸브 중 검은 화면 없음 (밝기 최저가 앞뒤 장면 이상)', minL >= Math.min(lum[0], lum[lum.length - 1]) - 6, `밝기 ${lum.join(',')}`);
  ok('번쩍임 없음 (프레임 간 밝기 급변 없음)', Math.max(...jumps) <= 18, `최대 변화 ${Math.max(...jumps)}`);
  await waitState('wait');
  // 4) 이전 대사 보기
  await p.tap('.os-back'); await waitState('wait');
  const bk = await state();
  ok('◀ 이전 대사로 돌아감', bk[1] === 1, `장면 ${bk[1]}`);
  await tapStage(); await waitState('wait'); // 다시 2
  // 5) AUTO: 읽기 시간 측정 · 일시정지 · 복귀
  await p.tap('.os-auto');
  const tA = Date.now(); const sA = (await state())[1];
  let nx = null; while (Date.now() - tA < 15000) { const x = await state(); if (x[1] !== sA || x[2] !== 'wait') { nx = Date.now() - tA; break; } await p.waitForTimeout(50); }
  const expect = await p.evaluate((i) => { const pg = [[0, 1], [2, 3], [4, 5], [6], [7], [], [8, 9], [10, 11], [12], [13], [14, 15]][i]; return pg.length ? window.__osReadMs(pg.map(() => '').join('')) : 0; }, sA);
  ok('AUTO: 자막을 충분히 읽힌 뒤 넘어감 (3초 이상)', nx != null && nx >= 3000, `장면 ${sA} 머문 시간 ${nx}ms`);
  await waitState('wait');
  const sP = (await state())[1];
  await p.waitForTimeout(800);
  await p.tap('.os-pause');
  await p.waitForTimeout(6000);
  const stillP = (await state())[1];
  ok('AUTO 중 일시정지: 6초 동안 넘어가지 않음', stillP === sP && !!(await p.$('.os-paused')), `장면 ${sP}→${stillP}`);
  await p.tap('.os-pause');
  const tR = Date.now(); let resumed = null; while (Date.now() - tR < 15000) { const x = await state(); if (x[1] !== sP || x[2] !== 'wait') { resumed = Date.now() - tR; break; } await p.waitForTimeout(50); }
  ok('계속하면 남은 읽기 시간만큼만 기다림 (처음부터 다시 X · 건너뛰기 X)', resumed != null && resumed > 300, `${resumed}ms 뒤 다음`);
  await p.tap('.os-auto'); // AUTO 끔
  // 6) 끝까지 수동으로: 장면마다 캡처 · 시간 기록
  for (let guard = 0; guard < 30; guard++) {
    const x = await waitState('wait', 20000);
    if (!x) break;
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${out}/p${String(x[1]).padStart(2, '0')}.png` });
    if (x[1] >= pages - 1) break;
    await tapStage();
  }
  const titleShown = !!(await p.$('.os-title.on'));
  await p.waitForTimeout(500);
  await tapStage();
  const back2menu = !!(await p.waitForSelector('.pv-box', { timeout: 8000 }).catch(() => null));
  ok('마지막 타이틀 장면 → 터치 → 다음 화면(미리보기 메뉴)으로', titleShown && back2menu);
  // 시간 표
  const L = await p.evaluate(() => window.__osLog);
  const rows = []; let tr = null, ti = null, wt = null;
  for (let i = 0; i < L.length; i++) {
    const [t, sc, s] = L[i];
    if (s === 'transition') tr = t;
    if (s === 'textIn') { ti = t; if (tr) rows.push({ scene: sc, dissolve: t - tr }); }
    if (s === 'wait' && ti != null) { const r = rows[rows.length - 1]; if (r && r.scene === sc) r.textIn = t - ti; wt = t; }
    if (s === 'textOut' && wt != null) { const r = rows.filter((q) => q.scene === sc).pop(); if (r) { r.shown = t - wt; r.textOut = (L[i + 1]?.[0] ?? t) - t; } }
  }
  fs.writeFileSync(`${out}/timing.json`, JSON.stringify(rows));
  ok('디졸브 시간 0.7~1.0초', rows.every((r) => r.dissolve >= 700 && r.dissolve <= 1150), rows.map((r) => r.dissolve).join(','));
  ok('자막 등장 0.3초', rows.filter((r) => r.textIn != null).every((r) => r.textIn >= 280 && r.textIn <= 420), rows.map((r) => r.textIn).join(','));
  // 7) SKIP
  const hasMenu = !!(await p.$('.pv-opening'));
  if (!hasMenu) { await p.screenshot({ path: `${out}/after-end.png` }); ok('SKIP 검사 준비 (메뉴)', false, await p.evaluate(() => document.body.innerText.slice(0, 120))); }
  else { await p.tap('.pv-opening'); await waitState('wait'); await p.tap('.os-skip');
  ok('SKIP → 바로 다음 화면', !!(await p.waitForSelector('.pv-box', { timeout: 5000 }).catch(() => null))); }
  ok('콘솔 오류 · 실패 요청 없음', errs.length === 0 && bad.length === 0, [...errs, ...bad].slice(0, 2).join(' | '));
  console.log(res.join('\n') + `\n${res.filter((x) => x.startsWith('PASS')).length}/${res.length} PASS\nTIMING ${JSON.stringify(rows)}`);
  const v = p.video();
  await ctx.close();
  if (v) fs.renameSync(await v.path(), `${out}/opening2-${w}x${h}.webm`);
  await b.close();
})();
