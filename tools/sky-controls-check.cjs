/* 모바일 조작 v2 검수 (실제 터치 이벤트 · CDP Input.dispatchTouchEvent → pointerType=touch)
 *  짧은 터치 · 이동하며 길게 누르기(차지 링 · 일반 공격 유지 · 뗄 때 차지) · 0.4초 누르기 · 근접 자동 + 쿨다운 ·
 *  차지 중 폭탄 버튼(오발사 방지) · 두 손가락 · 화면 밖으로 나간 손가락 · 일시정지/대사 중 터치 · 첫 플레이 안내 · 버튼 구성
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-controls-check.cjs <url(끝 /)> <outdir> [w] [h]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out, w = '393', h = '636'] = process.argv.slice(2);
const W = +w;
const H = +h;
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => localStorage.setItem('gona.skyadv.opened', '1'));
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  const errs = [];
  const bad = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  p.on('response', (r) => r.status() >= 400 && bad.push(r.url()));
  const res = [];
  const ok = (name, cond, extra = '') => res.push(`${cond ? 'PASS' : 'FAIL'} · ${name}${extra ? ' — ' + extra : ''}`);
  const shot = (n) => p.screenshot({ path: `${out}/${n}.png` });
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })) });
  const d = () => p.evaluate(() => window.__sky.debug());
  const wait = (ms) => p.waitForTimeout(ms);
  const clearTalk = async () => { for (let i = 0; i < 40 && (await p.$('.sky-talk')); i++) { await p.tap('.sky-talk', { position: { x: 20, y: 20 } }).catch(() => {}); await wait(60); } };
  // ── 첫 플레이 안내 (STAGE 1 · ?guide 로 강제)
  await p.goto(url + '?skytest&guide');
  await p.waitForSelector('.ttl-start', { timeout: 60000 });
  await p.evaluate(() => window.__skyFlow.start(1, 'normal'));
  await p.waitForFunction(() => window.__sky && document.querySelector('.sky-canvas'));
  await p.evaluate(() => window.__sky.cheat('god'));
  const seen = [];
  for (let i = 0; i < 70; i++) {
    await clearTalk();
    const t = await p.$eval('.ctrl-guide p', (e) => e.innerText).catch(() => '');
    if (t && !seen.includes(t)) { seen.push(t); if (seen.length === 3) await shot('a-guide'); }
    if (seen.length >= 5) break;
    await wait(250);
  }
  ok('첫 플레이 안내 5줄', seen.length === 5, seen.join(' / '));
  const btns = await p.$$eval('.sky-ctrl .sky-act', (e) => e.map((x) => x.className.replace('sky-act ', '')));
  ok('하단 버튼: 근접·차지 없음 · 필살 · 폭탄', !btns.some((c) => /charge|melee/.test(c)) && btns.some((c) => /sky-bomb/.test(c)), btns.join(', '));
  const bombBox = await p.$eval('.sky-bomb', (e) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
  ok('폭탄 버튼 크기 ≥ 54px · 화면 안', bombBox[2] >= 54 && bombBox[3] >= 44 && bombBox[1] + bombBox[3] <= H, bombBox.map(Math.round).join(','));
  const cv = await p.$eval('.sky-canvas', (e) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
  const cx = cv[0] + cv[2] / 2;
  const cy = cv[1] + cv[3] * 0.75;
  await wait(4000);
  await clearTalk();
  // ── 짧은 터치: 차지 없음
  let s0 = await d();
  await touch('touchStart', [[cx, cy, 0]]); await wait(120); await touch('touchEnd', []);
  await wait(200);
  let s1 = await d();
  ok('짧은 터치(0.12초) → 차지 안 나감', s1.chargeShots === s0.chargeShots);
  // ── 0.4초 터치: 차지 안 나감
  await touch('touchStart', [[cx, cy, 0]]); await wait(400); await touch('touchEnd', []);
  await wait(200);
  s1 = await d();
  ok('0.4초 터치 → 차지 안 나감', s1.chargeShots === s0.chargeShots);
  // ── 이동하며 길게 누르기 → 링 · 일반 공격 유지 · 뗄 때 차지
  await touch('touchStart', [[cx, cy, 0]]);
  let mid = null;
  let pbMax = 0;
  for (let i = 0; i < 30; i++) {
    const x = cx + Math.sin(i / 4) * 60;
    await touch('touchMove', [[x, cy - (i % 10) * 3, 0]]);
    await wait(55);
    const s = await d();
    pbMax = Math.max(pbMax, s.pbullets);
    if (i === 22) { mid = s; await shot('b-charging'); }
  }
  const full = await d();
  await touch('touchEnd', []);
  await wait(250);
  s1 = await d();
  ok('이동 중 충전 유지(손가락 움직여도 취소 안 됨)', mid && mid.charge > 0.5 && mid.drag === 1, `charge ${mid?.charge} · 누른 시간 ${mid?.hold}s`);
  ok('충전 중에도 일반 공격 계속', pbMax > 3, `화면 위 아군 탄 최대 ${pbMax}`);
  ok('손을 떼면 차지 발사', s1.chargeShots === s0.chargeShots + 1, `charge ${full.charge} → 발사`);
  await shot('c-released');
  // ── 근접 자동: 적을 고나 바로 앞에 놓음
  await wait(2500);
  s0 = await d();
  const placed = await p.evaluate(() => {
    const s = window.__sky;
    let e = s.en.find((x) => x.kind === 'small' && !x.dead);
    if (!e) return false;
    e.x = s.px; e.y = s.py - 24; e.vx = 0; e.vy = 0; e.hp = 999; e.max = 999;
    window.__mel = e;
    return true;
  });
  await wait(120);
  s1 = await d();
  await shot('d-melee');
  ok('근접 자동 발동(적이 바로 앞)', placed && s1.melees === s0.melees + 1, placed ? `melee ${s0.melees}→${s1.melees} · 쿨다운 ${s1.meleeCd}s` : '적 없음');
  const yBefore = s0.py;
  ok('자동 근접은 앞으로 돌진하지 않음(보스 쪽으로 끌려가지 않게)', Math.abs(s1.py - yBefore) <= 2, `py ${yBefore}→${s1.py}`);
  await p.evaluate(() => { const s = window.__sky; const e = window.__mel; e.x = s.px; e.y = s.py - 24; });
  await wait(500);
  const s2 = await d();
  ok('쿨다운 중 재발동 없음', s2.melees === s1.melees, `0.5초 뒤 melee ${s2.melees}`);
  await p.evaluate(() => { const e = window.__mel; e.hp = 1; e.y = -60; });
  // ── 차지 중 폭탄 버튼 → 폭탄만 · 차지 오발사 없음
  await wait(2200);
  s0 = await d();
  await touch('touchStart', [[cx, cy, 0]]);
  for (let i = 0; i < 20; i++) { await touch('touchMove', [[cx + i, cy, 0]]); await wait(50); }
  const bx = bombBox[0] + bombBox[2] / 2;
  const by = bombBox[1] + bombBox[3] / 2;
  await touch('touchStart', [[cx + 20, cy, 0], [bx, by, 1]]);
  await wait(80);
  await touch('touchEnd', [[cx + 20, cy, 0]]);
  await wait(300);
  await touch('touchEnd', []);
  await wait(300);
  s1 = await d();
  ok('차지 중 폭탄 → 폭탄 1개 사용 · 손 떼도 차지 오발사 없음', s1.bombs === s0.bombs - 1 && s1.chargeShots === s0.chargeShots, `폭탄 ${s0.bombs}→${s1.bombs} · 차지 ${s0.chargeShots}→${s1.chargeShots}`);
  await wait(2600);
  // ── 두 손가락: 두 번째 손가락은 무시
  s0 = await d();
  await touch('touchStart', [[cx, cy, 0]]);
  await touch('touchMove', [[cx + 10, cy, 0]]);
  await wait(100);
  const pA = (await d()).px;
  await touch('touchStart', [[cx + 10, cy, 0], [cx - 150, cy - 200, 1]]);
  for (let i = 0; i < 6; i++) { await touch('touchMove', [[cx + 10, cy, 0], [cx - 150 + i * 20, cy - 200 - i * 10, 1]]); await wait(40); }
  const pB = (await d()).px;
  await touch('touchEnd', [[cx + 10, cy, 0]]);
  await touch('touchEnd', []);
  await wait(200);
  ok('두 손가락: 두 번째 손가락으로 캐릭터가 튀지 않음', Math.abs(pB - pA) <= 3, `px ${pA}→${pB}`);
  // ── 화면 밖으로 나간 손가락
  await touch('touchStart', [[cx, cy, 0]]);
  for (let i = 0; i < 10; i++) { await touch('touchMove', [[cx + i * 40, cy + i * 40, 0]]); await wait(40); }
  await touch('touchMove', [[W + 80, H + 120, 0]]);
  const sOut = await d();
  await touch('touchEnd', []);
  await wait(200);
  const sAfter = await d();
  ok('화면 밖으로 나가도 화면 안에 머묾 · 뗀 뒤 정상', sOut.px >= 14 && sOut.px <= 166 && sAfter.drag === 0, `px ${sOut.px} py ${sOut.py}`);
  // ── 일시정지: 누르고 있다가 일시정지 → 재개 후 떼도 차지 없음
  s0 = await d();
  await touch('touchStart', [[cx, cy, 0]]);
  await wait(900);
  await p.evaluate(() => document.querySelector('.sky-pause').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await wait(300);
  const sp = await d();
  await p.tap('text=계속하기');
  await wait(200);
  await touch('touchEnd', []);
  await wait(200);
  s1 = await d();
  ok('일시정지하면 충전 취소 · 재개 후 떼도 차지 없음', sp.charge === 0 && s1.chargeShots === s0.chargeShots, `일시정지 중 charge ${sp.charge}`);
  // ── 대사(보스 등장) 중 터치: 충전 취소 · 대사 끝나면 정상
  await touch('touchStart', [[cx, cy, 0]]);
  await wait(800);
  await p.evaluate(() => window.__sky.cheat('boss'));
  let talkSeen = false;
  let st = null;
  for (let i = 0; i < 60; i++) { st = await d(); if (st.talking) { talkSeen = true; break; } await wait(100); }
  await touch('touchEnd', []);
  ok('대사 시작 → 터치·충전 해제', talkSeen && st.drag === 0 && st.charge === 0, `talking ${st?.talking} drag ${st?.drag} charge ${st?.charge}`);
  await clearTalk();
  await wait(1500);
  await clearTalk();
  s0 = await d();
  await touch('touchStart', [[cx, cy, 0]]);
  for (let i = 0; i < 26; i++) { await touch('touchMove', [[cx + Math.sin(i / 3) * 40, cy, 0]]); await wait(55); }
  await touch('touchEnd', []);
  await wait(250);
  s1 = await d();
  ok('보스전에서도 길게 눌렀다 떼면 차지', s1.chargeShots === s0.chargeShots + 1);
  await shot('e-boss');
  console.log(res.join('\n') + `\n콘솔 오류 ${errs.length} ${errs.slice(0, 3).join(' | ')} · 실패 요청 ${bad.length}`);
  await b.close();
})();
