#!/usr/bin/env node
/**
 * 아슬아슬 탑 모바일 점검 — 실제 터치(CDP 터치 이벤트)로 드래그해서 옮기고 손을 떼 낙하시킵니다.
 * 기반이 제공하는 data-* 속성(stage: phase/aimX/supportX/height/falls/left/swaps/scale/rot)만 읽어 스킨과 무관하게 동작.
 *   npm run build && npx vite preview --port 4175 --host 127.0.0.1 &
 *   NODE_PATH=$(npm root -g) node tools/mgl-tower-check.cjs "http://127.0.0.1:4175/mini-game-land/?games=tower" shots/mgl-tower
 */
const fs = require('fs');
const { chromium } = require('playwright');
const [url, outDir = 'shots/mgl-tower'] = process.argv.slice(2);
if (!url) { console.error('usage: mgl-tower-check.cjs <url> [out-dir]'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });
const SIZES = [[393, 636], [390, 844]];
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let cdp;

async function layout(page, tag) {
  const r = await page.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight, de = document.documentElement, bad = [];
    for (const el of document.querySelectorAll('button, a')) {
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      if (b.left < -0.5 || b.top < -0.5 || b.right > vw + 0.5 || b.bottom > vh + 0.5) bad.push(`밖: ${el.textContent.trim().slice(0, 12)}`);
      if (b.width < 44 || b.height < 44) bad.push(`작음: ${el.textContent.trim().slice(0, 12)} ${Math.round(b.width)}x${Math.round(b.height)}`);
    }
    const rect = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
    for (const sel of ['.mgl-slot-scoreboard', '.tw-metabox', '.tw-stage', '.tw-controls']) { const b = rect(sel); if (b && (b.left < -0.5 || b.top < -0.5 || b.right > vw + 0.5 || b.bottom > vh + 0.5)) bad.push(`영역 밖: ${sel}`); }
    const stage = rect('.tw-stage'), aim = rect('[data-testid=aim-piece]'), ctl = rect('.tw-controls'), meta = rect('.tw-metabox');
    if (stage && stage.height < 220) bad.push(`게임 영역이 너무 작음 ${Math.round(stage.height)}px`);
    if (stage && aim && (aim.left < stage.left - 1 || aim.right > stage.right + 1 || aim.top < stage.top - 1)) bad.push('조각이 게임 영역 밖');
    if (stage && ctl && stage.bottom > ctl.top + 1) bad.push('게임 영역이 조작 영역과 겹침');
    if (stage && meta && meta.bottom > stage.top + 1) bad.push('정보 줄이 게임 영역과 겹침');
    for (const el of document.querySelectorAll('span,b,p,h2,h3,.mgl-btn')) if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow === 'visible' && el.clientWidth > 0 && getComputedStyle(el).display !== 'inline') bad.push(`글자 넘침: ${el.textContent.trim().slice(0, 14)}`);
    return { sx: de.scrollWidth > vw, sy: de.scrollHeight > vh, bad, stageH: stage && Math.round(stage.height) };
  });
  check(`${tag}: 스크롤 없음`, !r.sx && !r.sy);
  check(`${tag}: UI 잘림·겹침 없음, 터치 44px↑ (게임 영역 ${r.stageH}px)`, r.bad.length === 0, r.bad.join(' | '));
}
async function tapSel(page, sel) {
  const loc = page.locator(sel).first();
  await loc.waitFor({ state: 'visible', timeout: 8000 });
  const b = await loc.boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
}
const snap = (page, w, h, name) => page.screenshot({ path: `${outDir}/${w}x${h}-${name}.png` });
const stage = (page) => page.evaluate(() => { const s = document.querySelector('[data-testid=stage]'); if (!s) return null; const d = s.dataset; return { phase: d.phase, aimX: +d.aimX, supportX: +d.supportX, height: +d.height, goal: +d.goal, falls: +d.falls, left: +d.left, swaps: +d.swaps, k: +d.scale, rot: +d.rot, kind: d.kind }; });
const roundAttr = (page, n) => page.locator('[data-testid=round]').getAttribute(`data-${n}`);

/** 스테이지를 손가락으로 dxCss 만큼 밀었다가 놓기(= 이동 + 낙하) */
async function dragRelease(page, dxCss, { release = true } = {}) {
  const b = await page.locator('[data-testid=stage]').boundingBox();
  const x0 = b.x + b.width / 2, y0 = b.y + b.height * 0.75;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  const steps = Math.max(2, Math.ceil(Math.abs(dxCss) / 10));
  for (let i = 1; i <= steps; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (dxCss * i) / steps, y: y0 }] });
  if (release) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function waitFor(page, pred, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const s = await stage(page); if (s && pred(s)) return s; if (await page.locator('[data-testid=result], [data-testid=summary]').count()) return s; await sleep(50); }
  return stage(page);
}
const done = (page) => page.locator('[data-testid=result], [data-testid=summary]').count();

/** 접시/가장 높은 조각 위로 가운데 맞춰 놓기를 반복 */
async function botPlay(page, { max = 40, jitter = 0 } = {}) {
  let n = 0, maxCombo = 0;
  while (n < max && !(await done(page))) {
    const s = await waitFor(page, (x) => x.phase === 'aim' || x.phase === 'won' || x.phase === 'lost');
    if (!s || s.phase !== 'aim') { if (await done(page)) break; await sleep(100); continue; }
    const dx = (s.supportX + (Math.random() - 0.5) * 2 * jitter - s.aimX) * s.k;
    await dragRelease(page, dx);
    n++;
    const c = Number(await roundAttr(page, 'combo').catch(() => 0)) || 0; maxCombo = Math.max(maxCombo, c);
    await waitFor(page, (x) => x.phase !== 'drop' && x.phase !== 'settle');
    const c2 = Number(await roundAttr(page, 'combo').catch(() => 0)) || 0; maxCombo = Math.max(maxCombo, c2);
  }
  return { n, maxCombo };
}
async function startFree(page, level = 1) {
  await tapSel(page, '[data-testid=go-free]');
  await tapSel(page, '[data-testid=pick-tower]');
  for (let i = 0; i < 30 && !(await page.locator('[data-testid=start-level]').innerText()).includes(`LV ${level}`); i++) { await tapSel(page, '[aria-label="레벨 올리기"]'); await sleep(60); }
  await tapSel(page, '[data-testid=start]');
  await page.locator('[data-testid=ready]').waitFor({ timeout: 8000 }).catch(() => {});
  await page.locator('[data-testid=ready]').waitFor({ state: 'detached', timeout: 6000 });
  await page.locator('[data-testid=aim-piece]').waitFor({ state: 'attached', timeout: 8000 });
}

(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of SIZES) {
    const tag = `${w}×${h}`;
    console.log(`\n── ${tag}`);
    const mk = async (seedLevel) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
      if (seedLevel) await ctx.addInitScript((lv) => { if (!localStorage.getItem('gmgl.v1')) localStorage.setItem('gmgl.v1', JSON.stringify({ v: 1, games: { tower: { bestScore: 1, bestLevel: lv, plays: 1 } }, challenge: { bestScore: 0, bestRound: 0, plays: 0 }, settings: { muted: false } })); }, seedLevel);
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      page.on('pageerror', (e) => errors.push(String(e)));
      cdp = await ctx.newCDPSession(page);
      await page.goto(url, { waitUntil: 'networkidle' });
      return { ctx, page, errors };
    };

    // ── A. L1 기본 조작: 드래그 이동 · 놓기 · 회전 · 교환 · 컨트롤 터치가 낙하를 일으키지 않음
    {
      const { ctx, page, errors } = await mk();
      await tapSel(page, '[data-testid=go-free]');
      check(`${tag} 자유 플레이 목록에 아슬아슬 탑`, (await page.locator('[data-testid=pick-tower]').count()) === 1);
      await tapSel(page, '[data-testid=pick-tower]');
      await snap(page, w, h, '01-howto');
      await layout(page, `${tag} 방법 안내`);
      await tapSel(page, '[data-testid=start]');
      await page.locator('[data-testid=ready]').waitFor({ timeout: 8000 }).catch(() => {});
      await page.locator('[data-testid=ready]').waitFor({ state: 'detached', timeout: 6000 });
      await page.locator('[data-testid=aim-piece]').waitFor({ state: 'attached', timeout: 8000 });
      let s = await stage(page);
      await snap(page, w, h, '02-aim');
      await layout(page, `${tag} L1 플레이`);
      check(`${tag} 도트 배율 정수(스테이지폭÷180)`, Number.isInteger(s.k) && s.k >= 2, `k=${s.k}`);
      check(`${tag} L1: 조준 단계 · 목표 70 · 조각 10`, s.phase === 'aim' && s.goal === 70 && s.left === 10, JSON.stringify(s));

      // 회전 버튼
      await tapSel(page, '[data-testid=rotate]');
      await sleep(120);
      let s2 = await stage(page);
      check(`${tag} 회전 버튼 탭 → 방향 +1, 낙하는 일어나지 않음`, s2.rot === (s.rot + 1) % 4 && s2.phase === 'aim' && s2.left === s.left, `rot ${s.rot}→${s2.rot}`);
      for (let i = 0; i < 3; i++) { await tapSel(page, '[data-testid=rotate]'); await sleep(80); }
      await sleep(120);
      check(`${tag} 회전 4번 → 원위치`, (await stage(page)).rot === s.rot);
      // 두 손가락: 한 손가락으로 잡은 채 다른 손가락으로 탭 → 회전, 손을 떼도 낙하하지 않음
      {
        const b = await page.locator('[data-testid=stage]').boundingBox();
        const p1 = { x: b.x + b.width / 2, y: b.y + b.height * 0.7, id: 1 }, p2 = { x: b.x + b.width * 0.8, y: b.y + b.height * 0.5, id: 2 };
        const r0 = await stage(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p1] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p1, p2] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [p1] });   // 두 번째 손가락만 뗌
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });     // 첫 손가락도 뗌
        await sleep(150);
        const r1 = await stage(page);
        check(`${tag} 두 번째 손가락 탭 → 회전, 손을 떼도 낙하 없음`, r1.rot === (r0.rot + 1) % 4 && r1.left === r0.left && r1.phase === 'aim', `rot ${r0.rot}→${r1.rot} left ${r0.left}→${r1.left} ${r1.phase}`);
        for (let i = 0; i < 3; i++) { await tapSel(page, '[data-testid=rotate]'); await sleep(80); }
        await sleep(120);
      }
      // 교환 버튼
      const before = await stage(page);
      await tapSel(page, '[data-testid=swap]');
      await sleep(120);
      const after = await stage(page);
      check(`${tag} 교환 버튼 → 횟수 −1, 낙하 없음`, after.swaps === before.swaps - 1 && after.left === before.left && after.phase === 'aim', `swaps ${before.swaps}→${after.swaps}`);
      // 드래그 이동(상대) — 손을 떼기 전 위치 확인
      const a0 = (await stage(page)).aimX;
      await dragRelease(page, 40, { release: false });
      await sleep(60);
      const a1 = (await stage(page)).aimX;
      check(`${tag} 손가락 40px 이동 → 조각 ${(40 / s.k).toFixed(0)} 단위 이동(1:1)`, Math.abs(a1 - a0 - 40 / s.k) < 2, `${a0.toFixed(1)}→${a1.toFixed(1)}`);
      const f0 = await stage(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const dropped = await waitFor(page, (x) => x.phase === 'drop' || x.phase === 'settle' || x.left < f0.left, 2000);
      check(`${tag} 손을 떼면 낙하(조각 −1)`, dropped.left === f0.left - 1, `left ${f0.left}→${dropped.left}`);
      const settled = await waitFor(page, (x) => x.phase === 'aim');
      check(`${tag} 가라앉으면 다음 조각 조준 단계로`, settled.phase === 'aim' && settled.height > 5, `height ${settled.height}`);
      await snap(page, w, h, '03-first-piece');

      // 정렬해서 끝까지 → 클리어
      const r = await botPlay(page);
      await page.locator('[data-testid=result]').waitFor({ timeout: 15000 }).catch(() => {});
      const tone = await page.locator('[data-testid=result]').getAttribute('data-tone').catch(() => null);
      check(`${tag} 터치로 정렬해 쌓아 L1 클리어 → 결과(${r.n}조각, 최고 콤보 ${r.maxCombo})`, tone === 'clear');
      check(`${tag} 쌓는 동안 콤보 2 이상 달성`, r.maxCombo >= 2, `maxCombo=${r.maxCombo}`);
      await snap(page, w, h, '06-result-clear');
      await layout(page, `${tag} 결과(클리어)`);
      const sc = await page.locator('[data-testid=result]').innerText();
      check(`${tag} 결과: 점수·기록 표시`, /누적 점수/.test(sc) && (await page.locator('[data-testid=badge]').count()) >= 1);
      check(`${tag} 콘솔 오류 없음 (A)`, errors.length === 0, errors.join('|'));
      await ctx.close();
    }

    // ── B. 일시정지 중 물리 정지 · 앱 전환 자동 정지 · 재개
    {
      const { ctx, page, errors } = await mk();
      await startFree(page, 1);
      const s = await stage(page);
      await dragRelease(page, 0);                                  // 가운데에 놓기
      await tapSel(page, '[data-testid=pause]');                   // 낙하 중 일시정지
      await page.locator('[data-testid=paused]').waitFor();
      const p0 = await stage(page); await sleep(1400); const p1 = await stage(page);
      check(`${tag} 일시정지 중 낙하·물리 정지(단계/높이 그대로)`, p0.phase === p1.phase && p0.height === p1.height, `${p0.phase}/${p0.height} → ${p1.phase}/${p1.height}`);
      await snap(page, w, h, '07-paused');
      await layout(page, `${tag} 일시정지`);
      await tapSel(page, '[data-testid=resume]');
      await page.locator('[data-testid=resuming]').waitFor({ state: 'detached', timeout: 6000 });
      const back = await waitFor(page, (x) => x.phase === 'aim', 6000);
      check(`${tag} 재개 후 물리 진행 → 다음 조준 단계`, back.phase === 'aim' && back.height > 5, JSON.stringify(back));
      await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      check(`${tag} 앱 전환(pagehide) 시 자동 일시정지`, (await page.locator('[data-testid=paused]').count()) === 1);
      check(`${tag} 콘솔 오류 없음 (B)`, errors.length === 0, errors.join('|'));
      await ctx.close();
    }

    // ── C. 실패: 접시 밖에 계속 놓아 떨어뜨림 → 실패 결과
    {
      const { ctx, page, errors } = await mk(9);
      await startFree(page, 10);          // 접시가 가장 좁은 L10
      const s = await stage(page);
      check(`${tag} L10: 목표 170 · 바람 알림 표시`, s.goal === 170 && (await page.locator('[data-testid=wind]').count()) === 1, `goal ${s.goal}`);
      await snap(page, w, h, '10-L10-aim');
      await layout(page, `${tag} L10 플레이`);
      let sawFeedback = false;
      for (let i = 0; i < 6 && !(await done(page)); i++) {
        const cur = await waitFor(page, (x) => x.phase === 'aim');
        if (!cur || cur.phase !== 'aim') break;
        await dragRelease(page, -400);    // 맨 왼쪽(접시 밖)
        for (let t = 0; t < 40; t++) { if (await page.locator('[data-testid=feedback][data-kind=fell]').count()) { sawFeedback = true; break; } await sleep(100); }
        await waitFor(page, (x) => x.phase === 'aim' || x.phase === 'lost');
      }
      await page.locator('[data-testid=result]').waitFor({ timeout: 15000 }).catch(() => {});
      check(`${tag} 접시 밖 낙하 → '떨어졌어요' 알림`, sawFeedback);
      check(`${tag} 기회 소진 → 실패 결과`, (await page.locator('[data-testid=result]').getAttribute('data-tone').catch(() => null)) === 'fail');
      await snap(page, w, h, '11-result-fail');
      await layout(page, `${tag} 결과(실패)`);
      check(`${tag} 콘솔 오류 없음 (C)`, errors.length === 0, errors.join('|'));
      await ctx.close();
    }

    // ── D. 레벨별 화면: L4(방향 무작위·안내선) · L8 · L9(바람) 의 조작과 표시
    {
      const { ctx, page, errors } = await mk(9);
      await startFree(page, 4);
      const s4 = await stage(page);
      await snap(page, w, h, '12-L4-aim');
      await layout(page, `${tag} L4 플레이`);
      check(`${tag} L4: 목표 106 · 낙하 안내선 표시`, s4.goal === 106 && (await page.locator('.tw-guide').evaluate((e) => e.style.display !== 'none')));
      await page.goto(url, { waitUntil: 'networkidle' });
      await startFree(page, 8);
      const s8 = await stage(page);
      check(`${tag} L8: 목표 142 · 안내선 없음 · 바람은 아직 없음`, s8.goal === 142 && (await page.locator('.tw-guide').evaluate((e) => e.style.display === 'none')) && (await page.locator('[data-testid=wind]').count()) === 0);
      await page.goto(url, { waitUntil: 'networkidle' });
      await startFree(page, 9);
      const s9 = await stage(page);
      await snap(page, w, h, '13-L9-aim');
      check(`${tag} L9: 목표 156 · 바람 알림 표시(도전 구간)`, s9.goal === 156 && (await page.locator('[data-testid=wind]').count()) === 1);
      const r = await botPlay(page, { max: 4, jitter: 2 });
      check(`${tag} L9: 4조각 놓는 동안 오류 없이 진행(${r.n}조각)`, r.n >= 2);
      await snap(page, w, h, '14-L9-tower');
      check(`${tag} 콘솔 오류 없음 (D)`, errors.length === 0, errors.join('|'));
      await ctx.close();
    }

    // ── E. 랜덤 챌린지에서 같은 모듈 (?games=tower)
    {
      const { ctx, page, errors } = await mk();
      await tapSel(page, '[data-testid=go-challenge]');
      await tapSel(page, '[data-testid=start]');
      await page.locator('[data-testid=intro]').waitFor();
      check(`${tag} 챌린지 인트로에 아슬아슬 탑`, (await page.locator('[data-testid=intro]').innerText()).includes('아슬아슬'));
      await tapSel(page, '[data-testid=intro]');
      await page.locator('[data-testid=ready]').waitFor({ timeout: 8000 }).catch(() => {});
      await page.locator('[data-testid=ready]').waitFor({ state: 'detached', timeout: 6000 });
      await page.locator('[data-testid=aim-piece]').waitFor({ state: 'attached', timeout: 8000 });
      check(`${tag} 챌린지 HUD: 목숨 3 · 같은 게임 모듈(탑 스테이지)`, (await roundAttr(page, 'lives')) === '3' && (await page.locator('[data-testid=stage]').count()) === 1);
      await layout(page, `${tag} 챌린지 플레이`);
      await snap(page, w, h, '20-challenge');
      await botPlay(page);
      await page.locator('[data-testid=summary]').waitFor({ timeout: 15000 }).catch(() => {});
      check(`${tag} 챌린지: 클리어 → 요약`, (await page.locator('[data-testid=summary]').count()) === 1 && (await page.locator('[data-testid=summary]').innerText()).includes('CLEAR'));
      check(`${tag} 콘솔 오류 없음 (E)`, errors.length === 0, errors.join('|'));
      await ctx.close();
    }
  }
  await browser.close();
  const fail = results.filter((r) => !r.ok);
  console.log(`\n${results.length - fail.length}/${results.length} 통과`);
  fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(results, null, 2));
  process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
