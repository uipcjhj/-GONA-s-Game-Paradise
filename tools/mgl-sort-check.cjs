#!/usr/bin/env node
/**
 * 편가르기 대소동 모바일 점검 — 실제 터치(분류함 탭)와 실제 스와이프(CDP 터치 이벤트)로 플레이합니다.
 * 정답 판정은 이 스크립트가 따로 구현(게임 로직을 그대로 믿지 않음): 화면의 카드 속성 + 규칙(data-rule)만 읽습니다.
 *
 *   npm run build && npx vite preview --port 4175 --host 127.0.0.1 &
 *   NODE_PATH=$(npm root -g) node tools/mgl-sort-check.cjs http://127.0.0.1:4175/mini-game-land/ shots/mgl-sort
 */
const fs = require('fs');
const { chromium } = require('playwright');

const [url, outDir = 'shots/mgl-sort'] = process.argv.slice(2);
if (!url) { console.error('usage: mgl-sort-check.cjs <url> [out-dir]'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });
const SIZES = [[393, 636], [390, 844]];
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 독립 구현 판정 (기준 분류함: 0=왼쪽 · 1=오른쪽/가운데 · 2=오른쪽)
const has = (card, c) => card[c.axis] === c.value;
function correctBin(card, rule) {
  const [a, b] = rule.conds;
  let base;
  switch (rule.kind) {
    case 'single': base = has(card, a) ? 0 : 1; break;
    case 'and': base = has(card, a) && has(card, b) ? 0 : 1; break;
    case 'or': base = has(card, a) || has(card, b) ? 0 : 1; break;
    case 'exclude': base = has(card, a) && !has(card, b) ? 0 : 1; break;
    case 'three': base = has(card, a) ? 0 : has(card, b) ? 2 : 1; break;
  }
  const bins = rule.kind === 'three' ? 3 : 2;
  return rule.reversed ? bins - 1 - base : base;
}

async function layout(page, tag) {
  const r = await page.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight, de = document.documentElement, bad = [];
    for (const el of document.querySelectorAll('button, a')) {
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      if (b.left < -0.5 || b.top < -0.5 || b.right > vw + 0.5 || b.bottom > vh + 0.5) bad.push(`밖: ${el.textContent.trim().slice(0, 12)}`);
      if (b.width < 44 || b.height < 44) bad.push(`작음: ${el.textContent.trim().slice(0, 12)} ${Math.round(b.width)}x${Math.round(b.height)}`);
    }
    // 핵심 요소가 보이는 영역 안에 있는지(카드·규칙·분류함·HUD)
    for (const sel of ['.sc-rule', '.sc-stage', '.sc-bins', '.mgl-hud', '[data-testid=card]']) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const b = el.getBoundingClientRect();
      if (b.left < -0.5 || b.top < -0.5 || b.right > vw + 0.5 || b.bottom > vh + 0.5) bad.push(`영역 밖: ${sel}`);
    }
    for (const el of document.querySelectorAll('h1,h2,h3,p,span,b,dt,dd,li,.sc-bin-label,.sc-rule-hint')) {
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow === 'visible' && el.clientWidth > 0 && getComputedStyle(el).display !== 'inline') bad.push(`글자 넘침: ${el.textContent.trim().slice(0, 14)}`);
    }
    // 카드와 규칙 배너·분류함이 서로 겹치지 않는지
    const rect = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
    const card = rect('[data-testid=card]'), rule = rect('.sc-rule'), bins = rect('.sc-bins');
    if (card && rule && card.top < rule.bottom) bad.push('카드가 규칙 배너와 겹침');
    if (card && bins && card.bottom > bins.top) bad.push('카드가 분류함과 겹침');
    return { sx: de.scrollWidth > vw, sy: de.scrollHeight > vh, bad };
  });
  check(`${tag}: 스크롤 없음`, !r.sx && !r.sy);
  check(`${tag}: UI 잘림·겹침 없음, 터치 44px↑`, r.bad.length === 0, r.bad.join(' | '));
}

async function tapSel(page, sel) {
  const loc = page.locator(sel).first();
  await loc.waitFor({ state: 'visible', timeout: 8000 });
  const b = await loc.boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
}
const snap = (page, w, h, name) => page.screenshot({ path: `${outDir}/${w}x${h}-${name}.png` });

let cdp;
async function swipe(page, dx, dy) {
  const b = await page.locator('[data-testid=card]').boundingBox();
  const x0 = b.x + b.width / 2, y0 = b.y + b.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (dx * i) / 6, y: y0 + (dy * i) / 6 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function readStage(page) {
  return page.evaluate(() => {
    const st = document.querySelector('[data-testid=stage]');
    const card = document.querySelector('[data-testid=card]');
    if (!st) return null;
    return { rule: JSON.parse(st.dataset.rule), locked: st.dataset.locked === '1', index: Number(st.dataset.index), card: card ? { color: card.dataset.color, face: card.dataset.face, feature: card.dataset.feature } : null };
  });
}
/** 분류함으로 보내기: 'tap' = 분류함 탭 / 'swipe' = 카드 스와이프 */
async function send(page, bin, bins, how) {
  if (how === 'swipe') {
    if (bin === 1 && bins === 3) return swipe(page, 0, -90);
    return swipe(page, bin === 0 ? -90 : 90, 6);
  }
  return tapSel(page, `[data-testid=bin-${bin}]`);
}
async function waitUnlocked(page) {
  for (let i = 0; i < 80; i++) {
    if (await page.locator('[data-testid=round-end], [data-testid=result], [data-testid=summary]').count()) return null; // 라운드 종료
    const s = await readStage(page); if (s && !s.locked && s.card) return s; await sleep(40);
  }
  return null;
}

/** 카드 1장 처리. wrong=true 면 일부러 틀림. 다음 카드 번호로 바뀔 때까지 대기 */
async function playCard(page, how, wrong = false) {
  const s = await waitUnlocked(page);
  if (!s) return null;
  const bins = s.rule.kind === 'three' ? 3 : 2;
  let bin = correctBin(s.card, s.rule);
  if (wrong) bin = bin === 0 ? bins - 1 : 0;
  await send(page, bin, bins, how);
  for (let i = 0; i < 60; i++) {
    const n = await readStage(page);
    if (!n || n.index !== s.index || (await page.locator('[data-testid=result]').count())) break;
    await sleep(30);
  }
  return s;
}
async function playAll(page, { hows = ['tap', 'swipe'], maxCards = 30 } = {}) {
  let n = 0;
  while (n < maxCards && !(await page.locator('[data-testid=result], [data-testid=summary]').count())) {
    const s = await playCard(page, hows[n % hows.length]);
    if (!s) break;
    n++;
  }
  return n;
}
const waitPlaying = async (page) => { await page.locator('[data-testid=ready]').waitFor({ timeout: 8000 }).catch(() => {}); await page.locator('[data-testid=ready]').waitFor({ state: 'detached', timeout: 4000 }); await page.locator('[data-testid=card]').waitFor({ timeout: 8000 }); };
const score = async (page) => Number((await page.locator('[data-testid=score]').innerText()).replace(/,/g, ''));

async function startFree(page, level = 1) {
  await tapSel(page, '[data-testid=go-free]');
  await tapSel(page, '[data-testid=pick-sort]');
  for (let i = 1; i < level; i++) await tapSel(page, '[aria-label="레벨 올리기"]');
  await tapSel(page, '[data-testid=start]');
  await waitPlaying(page);
}
async function backToMenu(page) {
  await tapSel(page, '[data-testid=pause]');
  await tapSel(page, '[data-testid=quit]');
  await tapSel(page, '[data-testid=quit]');
  await page.locator('[data-testid=free-select]').waitFor();
  await page.getByText('돌아가기').first().tap();
  await page.locator('[data-testid=home]').waitFor();
}

(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of SIZES) {
    const tag = `${w}×${h}`;
    console.log(`\n── ${tag}`);
    const mk = async (seedLevel) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
      if (seedLevel) await ctx.addInitScript((lv) => { if (!localStorage.getItem('gmgl.v1')) localStorage.setItem('gmgl.v1', JSON.stringify({ v: 1, games: { sort: { bestScore: 1, bestLevel: lv, plays: 1 } }, challenge: { bestScore: 0, bestRound: 0, plays: 0 }, settings: { muted: false } })); }, seedLevel);
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      page.on('pageerror', (e) => errors.push(String(e)));
      cdp = await ctx.newCDPSession(page);
      await page.goto(url, { waitUntil: 'networkidle' });
      return { ctx, page, errors };
    };

    // ── A. L1 자유 플레이: 탭·스와이프 번갈아 정답만 → 클리어
    {
      const { ctx, page, errors } = await mk();
      await page.locator('[data-testid=home]').waitFor();
      await tapSel(page, '[data-testid=go-free]');
      await page.locator('[data-testid=free-select]').waitFor();
      check(`${tag} 자유 플레이 목록에 편가르기 표시·임시 게임 숨김`, (await page.locator('[data-testid=pick-sort]').count()) === 1 && (await page.locator('[data-testid=pick-tap-test]').count()) === 0);
      await snap(page, w, h, '01-free-select');
      await tapSel(page, '[data-testid=pick-sort]');
      await snap(page, w, h, '02-howto');
      await layout(page, `${tag} 방법 안내`);
      await tapSel(page, '[data-testid=start]');
      await page.locator('[data-testid=ready]').waitFor();
      await page.locator('[data-testid=card]').waitFor();
      await waitPlaying(page);
      await snap(page, w, h, '03-L1-play');
      await layout(page, `${tag} L1 플레이`);
      const info = await page.evaluate(() => ({ hint: document.querySelector('[data-testid=rule-hint]').textContent, bins: [...document.querySelectorAll('.sc-bin')].length, progress: document.querySelector('[data-testid=progress]').textContent }));
      check(`${tag} L1: 단일 조건·분류함 2개·목표 10장`, info.bins === 2 && info.progress.includes('/10'), JSON.stringify(info));
      let n = 0;
      const t0 = await score(page);
      for (; n < 4; n++) await playCard(page, n % 2 ? 'swipe' : 'tap');
      check(`${tag} 분류함 탭·스와이프 모두 정답 처리 → 점수 증가`, (await score(page)) >= t0 + 400, `${t0} → ${await score(page)}`);
      check(`${tag} 카드 요소는 항상 1개(중복 렌더링·누수 없음)`, (await page.locator('[data-testid=card]').count()) === 1 && (await page.locator('.sc-card-wrap').count()) === 1);
      check(`${tag} 연속 정답 → 콤보 표시`, (await page.locator('[data-testid=combo]').count()) === 1, await page.locator('[data-testid=combo]').first().innerText().catch(() => ''));
      await snap(page, w, h, '04-L1-combo');
      await playAll(page);
      await page.locator('[data-testid=result]').waitFor({ timeout: 8000 });
      check(`${tag} L1 정답만 → 클리어 결과`, (await page.locator('[data-testid=result]').getAttribute('data-tone')) === 'clear');
      await snap(page, w, h, '05-L1-result');
      await layout(page, `${tag} 결과(클리어)`);
      const resText = await page.locator('[data-testid=result]').innerText();
      check(`${tag} 결과: 목표 완료 보너스 포함 점수 표시`, /누적 점수/.test(resText) && (await page.locator('[data-testid=badge]').count()) >= 1);
      check(`${tag} 콘솔 오류 없음 (A)`, errors.length === 0, errors.join('|'));
      await ctx.close();
    }

    // ── B. 오답 피드백 · 입력 잠금 · 실수 3번 실패
    {
      const { ctx, page, errors } = await mk();
      await startFree(page, 1);
      await playCard(page, 'tap'); await playCard(page, 'tap'); // 콤보 2
      const s = await waitUnlocked(page);
      const bins = 2;
      let bin = correctBin(s.card, s.rule); bin = bin === 0 ? bins - 1 : 0;
      await tapSel(page, `[data-testid=bin-${bin}]`); // 오답
      await page.locator('[data-testid=feedback][data-kind=wrong]').waitFor({ timeout: 2000 });
      const fb = await page.locator('[data-testid=feedback]').innerText();
      check(`${tag} 오답 피드백: 설명(○/×)과 정답 방향 표시`, /정답은/.test(fb) && /[○×]/.test(fb), fb.replace(/\n/g, ' / '));
      check(`${tag} 오답 후 콤보 초기화·실수 1`, (await page.locator('[data-testid=combo]').count()) === 0 && (await page.locator('[data-testid=mistakes]').getAttribute('data-mistakes')) === '1');
      check(`${tag} 오답 후에도 카드 요소 1개`, (await page.locator('[data-testid=card]').count()) === 1);
      await snap(page, w, h, '06-wrong-feedback');
      await layout(page, `${tag} 오답 피드백`);
      const idx0 = (await readStage(page)).index;
      const s2 = await readStage(page);
      await tapSel(page, `[data-testid=bin-${correctBin(s2.card, s2.rule)}]`); // 잠금 중 연타
      await sleep(80);
      check(`${tag} 오답 직후 연타 입력은 잠금(실수 연쇄 방지)`, (await readStage(page)).index === idx0);
      await waitUnlocked(page);
      await playCard(page, 'swipe', true);
      await waitUnlocked(page);
      await playCard(page, 'tap', true); // 실수 3
      await page.locator('[data-testid=result]').waitFor({ timeout: 6000 });
      check(`${tag} 실수 3번 → 실패 결과`, (await page.locator('[data-testid=result]').getAttribute('data-tone')) === 'fail' && (await page.locator('[data-testid=retry]').count()) === 1);
      await snap(page, w, h, '07-fail-result');
      await layout(page, `${tag} 결과(실패)`);
      check(`${tag} 콘솔 오류 없음 (B)`, errors.length === 0, errors.join('|'));
      await ctx.close();
    }

    // ── C. 난이도별: 복합(L4) · 제외(L6) · 3분류+위로 밀기(L7) · 반전(L10)
    {
      const { ctx, page, errors } = await mk(9);
      for (const lv of [4, 6, 7, 10]) {
        await page.goto(url, { waitUntil: 'networkidle' });
        await startFree(page, lv);
        let st = await readStage(page);
        // L7 은 '3분류(위로 밀기)'를 반드시 검증: 제외 규칙이 뽑히면 3분류가 나올 때까지 다시 시작
        for (let tries = 0; lv === 7 && st.rule.kind !== 'three' && tries < 12; tries++) {
          await page.goto(url, { waitUntil: 'networkidle' });
          await startFree(page, lv);
          st = await readStage(page);
        }
        const kindOk = { 4: ['and'], 6: ['and', 'or', 'exclude'], 7: ['exclude', 'three'], 10: ['and', 'or', 'exclude', 'three'] }[lv].includes(st.rule.kind);
        check(`${tag} L${lv}: 허용된 규칙 종류(${st.rule.kind})`, kindOk);
        await snap(page, w, h, `10-L${lv}-play`);
        await layout(page, `${tag} L${lv} 플레이(${st.rule.kind})`);
        const goal = Number((await page.locator('[data-testid=progress]').innerText()).split('/')[1]);
        check(`${tag} L${lv}: 목표 카드 수 ${goal}`, goal === 10 + Math.round(((lv - 1) * 6) / 9));
        let sawAnnounce = false, sawReversed = false, sawMiddle = false, n = 0;
        while (n < 40 && !(await page.locator('[data-testid=result]').count())) {
          if (await page.locator('[data-testid=announce]').count()) { sawAnnounce = true; await snap(page, w, h, `11-L${lv}-announce`).catch(() => {}); }
          const s = await waitUnlocked(page);
          if (!s) break;
          if (s.rule.reversed) sawReversed = true;
          const bin = correctBin(s.card, s.rule);
          if (s.rule.kind === 'three' && bin === 1) sawMiddle = true;
          await playCard(page, s.rule.kind === 'three' ? (n % 2 ? 'swipe' : 'tap') : 'swipe');
          n++;
        }
        await page.locator('[data-testid=result]').waitFor({ timeout: 8000 });
        const tone = await page.locator('[data-testid=result]').getAttribute('data-tone');
        check(`${tag} L${lv}: 스와이프/탭으로 끝까지 정답 → 클리어`, tone === 'clear');
        if (lv === 10) check(`${tag} L10: 규칙 반전 예고·반전 상태 확인`, sawAnnounce && sawReversed);
        if (lv === 7) check(`${tag} L7: 3분류 가운데(위로 밀기) 카드를 만나 정답 처리`, sawMiddle && tone === 'clear');
      }
      check(`${tag} 콘솔 오류 없음 (C)`, errors.length === 0, errors.join('|'));
      await ctx.close();
    }

    // ── D. 랜덤 챌린지에서 같은 모듈: 클리어 → 요약 → 다음 라운드, 실패 → 목숨 −1
    {
      const { ctx, page, errors } = await mk();
      await tapSel(page, '[data-testid=go-challenge]');
      await tapSel(page, '[data-testid=start]');
      await page.locator('[data-testid=intro]').waitFor();
      check(`${tag} 챌린지 인트로에 편가르기 표시`, (await page.locator('[data-testid=intro]').innerText()).includes('편가르기'));
      await tapSel(page, '[data-testid=intro]');
      await waitPlaying(page);
      await layout(page, `${tag} 챌린지 플레이`);
      await snap(page, w, h, '20-challenge-play');
      check(`${tag} 챌린지 HUD: 목숨 3·모듈 동일(분류함 존재)`, (await page.locator('[data-testid=lives]').getAttribute('data-lives')) === '3' && (await page.locator('.sc-bin').count()) === 2);
      await playAll(page);
      await page.locator('[data-testid=summary]').waitFor({ timeout: 8000 });
      check(`${tag} 챌린지 클리어 요약`, (await page.locator('[data-testid=summary]').innerText()).includes('CLEAR'));
      await page.locator('[data-testid=ready]').waitFor({ timeout: 6000 });
      await waitPlaying(page);
      for (let i = 0; i < 3; i++) { if (!(await playCard(page, 'tap', true))) break; }
      await page.locator('[data-testid=summary]').waitFor({ timeout: 8000 });
      check(`${tag} 챌린지 실수 3번 → MISS(목숨 −1)`, (await page.locator('[data-testid=summary]').innerText()).includes('MISS'));
      await page.locator('[data-testid=ready]').waitFor({ timeout: 6000 });
      check(`${tag} 챌린지 목숨 2개`, (await page.locator('[data-testid=lives]').getAttribute('data-lives')) === '2');
      await page.locator('[data-testid=ready]').waitFor({ state: 'detached', timeout: 4000 });
      await tapSel(page, '[data-testid=pause]');
      await tapSel(page, '[data-testid=quit]');
      await tapSel(page, '[data-testid=quit]');
      await page.locator('[data-testid=result]').waitFor();
      await snap(page, w, h, '21-challenge-over');
      const rec = await page.evaluate(() => JSON.parse(localStorage.getItem('gmgl.v1')));
      check(`${tag} 챌린지 종료 → 종합 기록 저장(점수>0)`, rec.challenge.plays === 1 && rec.challenge.bestScore > 0, JSON.stringify(rec.challenge));
      check(`${tag} 콘솔 오류 없음 (D)`, errors.length === 0, errors.join('|'));
      await ctx.close();
    }
  }
  await browser.close();
  const fail = results.filter((r) => !r.ok);
  console.log(`\n${results.length - fail.length}/${results.length} 통과`);
  fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(results, null, 2));
  process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
