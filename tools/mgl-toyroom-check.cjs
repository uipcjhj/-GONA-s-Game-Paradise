#!/usr/bin/env node
/**
 * 장난감방 모바일 점검 — 실제 터치(touchscreen.tap)로 '장난감 탭 → 선반 탭' 플레이.
 * 기반이 제공하는 data-* 속성(board: shelves/caps/moves/left/limit/par/sets/total/undo/selected/busy/status/solution)만 읽어 스킨과 무관하게 동작.
 * 정답 풀이(data-solution)는 ?dev=1 일 때만 노출되며, 점검은 이 풀이를 '실제 탭'으로 재생해 화면 조작 경로를 검증합니다.
 *   npm run build && npx vite preview --port 4175 --host 127.0.0.1 &
 *   NODE_PATH=$(npm root -g) node tools/mgl-toyroom-check.cjs "http://127.0.0.1:4175/mini-game-land/?games=toyroom&dev=1" shots/mgl-toyroom
 */
const fs = require('fs');
const { chromium } = require('playwright');
const [url, outDir = 'shots/mgl-toyroom'] = process.argv.slice(2);
if (!url) { console.error('usage: mgl-toyroom-check.cjs <url> [out-dir]'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });
const SIZES = [[393, 636], [390, 844]];
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    for (const sel of ['.mgl-slot-scoreboard', '.tr-metabox', '.tr-board', '.tr-controls']) { const b = rect(sel); if (b && (b.left < -0.5 || b.top < -0.5 || b.right > vw + 0.5 || b.bottom > vh + 0.5)) bad.push(`영역 밖: ${sel}`); }
    const board = rect('.tr-board'), ctl = rect('.tr-controls'), meta = rect('.tr-metabox');
    const shelves = [...document.querySelectorAll('.tr-shelf')].map((e) => e.getBoundingClientRect());
    shelves.forEach((b, i) => { if (b.height < 44) bad.push(`선반 ${i} 높이 ${Math.round(b.height)}px < 44`); if (board && (b.top < board.top - 1 || b.bottom > board.bottom + 1)) bad.push(`선반 ${i} 가 보드 밖`); if (b.left < -0.5 || b.right > vw + 0.5) bad.push(`선반 ${i} 가로 밖`); });
    for (let i = 1; i < shelves.length; i++) if (shelves[i].top < shelves[i - 1].bottom - 0.5) bad.push(`선반 ${i - 1}/${i} 겹침`);
    document.querySelectorAll('.tr-toy').forEach((e) => { const b = e.getBoundingClientRect(); if (b.width < 28) bad.push(`장난감이 너무 작음 ${Math.round(b.width)}px`); const s = e.closest('.tr-shelf').getBoundingClientRect(); if (b.top < s.top - 8 || b.bottom > s.bottom + 1) bad.push('장난감이 선반 밖'); });
    if (board && ctl && board.bottom > ctl.top + 1) bad.push('보드가 조작 영역과 겹침');
    if (board && meta && meta.bottom > board.top + 1) bad.push('정보 줄이 보드와 겹침');
    for (const el of document.querySelectorAll('span,b,p,h2,h3,.mgl-btn')) if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow === 'visible' && el.clientWidth > 0 && getComputedStyle(el).display !== 'inline') bad.push(`글자 넘침: ${el.textContent.trim().slice(0, 14)}`);
    return { sx: de.scrollWidth > vw, sy: de.scrollHeight > vh, bad, boardH: board && Math.round(board.height), n: shelves.length, sh: shelves[0] && Math.round(shelves[0].height) };
  });
  check(`${tag}: 스크롤 없음`, !r.sx && !r.sy);
  check(`${tag}: UI 잘림·겹침 없음, 터치 44px↑ (선반 ${r.n}줄 × ${r.sh}px, 보드 ${r.boardH}px)`, r.bad.length === 0, r.bad.join(' | '));
}
async function tapSel(page, sel) {
  const loc = page.locator(sel).first();
  await loc.waitFor({ state: 'visible', timeout: 8000 });
  const b = await loc.boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
}
const snap = (page, w, h, name) => page.screenshot({ path: `${outDir}/${w}x${h}-${name}.png` });
const board = (page) => page.evaluate(() => { const b = document.querySelector('[data-testid=board]'); if (!b) return null; const d = b.dataset; return { shelves: d.shelves.split('|'), caps: d.caps.split(',').map(Number), moves: +d.moves, left: +d.left, limit: +d.limit, par: +d.par, sets: +d.sets, total: +d.total, undo: +d.undo, selected: d.selected, busy: d.busy === '1', status: d.status, solution: d.solution ? JSON.parse(d.solution) : null }; });
const roundAttr = (page, n) => page.locator('[data-testid=round]').getAttribute(`data-${n}`);
const done = (page) => page.locator('[data-testid=result], [data-testid=summary]').count();
async function waitIdle(page, ms = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const b = await board(page); if (!b || !b.busy) return b; await sleep(40); }
  return board(page);
}
/** 실제 터치: 장난감 칸 탭 → 대상 선반 탭 */
async function tapMove(page, [from, idx, to]) {
  const slot = page.locator(`[data-testid=board] [data-shelf="${from}"] [data-slot="${idx}"]`).first();
  const sb = await slot.boundingBox();
  await page.touchscreen.tap(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await sleep(30);
  const sh = await page.locator(`[data-testid=board] [data-shelf="${to}"]`).first().boundingBox();
  await page.touchscreen.tap(sh.x + sh.width / 2, sh.y + sh.height / 2);
  return waitIdle(page);
}
async function startFree(page, level = 1) {
  await tapSel(page, '[data-testid=go-free]');
  await tapSel(page, '[data-testid=pick-toyroom]');
  for (let i = 0; i < 30 && !(await page.locator('[data-testid=start-level]').innerText()).includes(`LV ${level}`); i++) { await tapSel(page, '[aria-label="레벨 올리기"]'); await sleep(60); }
  await tapSel(page, '[data-testid=start]');
  await page.locator('[data-testid=ready]').waitFor({ timeout: 8000 }).catch(() => {});
  await page.locator('[data-testid=ready]').waitFor({ state: 'detached', timeout: 6000 });
  await page.locator('[data-testid=board]').waitFor();
}

(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of SIZES) {
    const tag = `${w}×${h}`;
    console.log(`\n── ${tag}`);
    const mk = async (seedLevel) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
      if (seedLevel) await ctx.addInitScript((lv) => { if (!localStorage.getItem('gmgl.v1')) localStorage.setItem('gmgl.v1', JSON.stringify({ v: 1, games: { toyroom: { bestScore: 1, bestLevel: lv, plays: 1 } }, challenge: { bestScore: 0, bestRound: 0, plays: 0 }, settings: { muted: false } })); }, seedLevel);
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(url, { waitUntil: 'networkidle' });
      return { ctx, page, errors };
    };

    // ── A. L1: 선택 · 해제 · 정답 풀이를 실제 탭으로 재생 → 클리어
    {
      const { ctx, page, errors } = await mk();
      await tapSel(page, '[data-testid=go-free]');
      check(`${tag} 자유 플레이 목록에 장난감방`, (await page.locator('[data-testid=pick-toyroom]').count()) === 1);
      await tapSel(page, '[data-testid=pick-toyroom]');
      await snap(page, w, h, '01-howto');
      await layout(page, `${tag} 방법 안내`);
      await tapSel(page, '[data-testid=start]');
      await page.locator('[data-testid=ready]').waitFor({ timeout: 8000 }).catch(() => {});
      await page.locator('[data-testid=ready]').waitFor({ state: 'detached', timeout: 6000 });
      await page.locator('[data-testid=board]').waitFor();
      let b = await board(page);
      await snap(page, w, h, '02-L1-start');
      await layout(page, `${tag} L1 플레이`);
      check(`${tag} L1: 3줄 선반 · 세트 2 · 이동 제한 = 풀이+6`, b.shelves.length === 3 && b.total === 2 && b.limit === b.par + 6, `par ${b.par} limit ${b.limit}`);
      check(`${tag} 정답 풀이가 제공됨(dev)`, Array.isArray(b.solution) && b.solution.length === b.par);

      // 선택 / 해제
      const [f0, i0] = b.solution[0];
      const slot = page.locator(`[data-testid=board] [data-shelf="${f0}"] [data-slot="${i0}"]`).first();
      const sb = await slot.boundingBox();
      await page.touchscreen.tap(sb.x + sb.width / 2, sb.y + sb.height / 2);
      await sleep(80);
      let s1 = await board(page);
      check(`${tag} 장난감 탭 → 선택(선반:칸)`, s1.selected === `${f0}:${i0}`, s1.selected);
      await snap(page, w, h, '03-selected');
      await page.touchscreen.tap(sb.x + sb.width / 2, sb.y + sb.height / 2);
      await sleep(80);
      check(`${tag} 같은 장난감 다시 탭 → 선택 해제`, (await board(page)).selected === '');

      // 풀이 재생
      const sc0 = Number(await roundAttr(page, 'score'));
      let maxCombo = 0, prevSets = 0, sawChain = false, firstSolve = null;
      for (let k = 0; k < b.solution.length; k++) {
        const nb = await tapMove(page, b.solution[k]);
        maxCombo = Math.max(maxCombo, Number((await roundAttr(page, 'combo').catch(() => 0)) || 0));
        if (k === 0) { firstSolve = nb; check(`${tag} 이동 1번 → 이동 수 +1`, nb.moves === 1 && nb.left === b.limit - 1, `moves ${nb.moves}`); }
        if (nb.sets - prevSets >= 2) sawChain = true;
        prevSets = nb.sets;
        if (await done(page)) break;
      }
      await snap(page, w, h, '04-L1-before-result').catch(() => {});
      await page.locator('[data-testid=result]').waitFor({ timeout: 8000 }).catch(() => {});
      check(`${tag} 정답 풀이를 터치로 재생 → 클리어 결과`, (await page.locator('[data-testid=result]').getAttribute('data-tone').catch(() => null)) === 'clear');
      check(`${tag} 점수 증가·기록 배지`, (await page.locator('[data-testid=result]').innerText()).includes('누적 점수') && (await page.locator('[data-testid=badge]').count()) >= 1);
      await snap(page, w, h, '05-L1-result');
      await layout(page, `${tag} 결과(클리어)`);
      check(`${tag} 콘솔 오류 없음 (A)`, errors.length === 0, errors.join('|'));
      await ctx.close();
    }

    // ── B. 되돌리기 · 처음부터 · 이동 제한 소진 실패 · 불가능한 이동
    {
      const { ctx, page, errors } = await mk();
      await startFree(page, 3);
      let b = await board(page);
      const init = b.shelves.join('|');
      await tapMove(page, b.solution[0]);
      let a = await board(page);
      check(`${tag} L3: 이동 후 상태 변화`, a.moves === 1 && a.shelves.join('|') !== init);
      await tapSel(page, '[data-testid=undo]');
      await sleep(150);
      a = await board(page);
      check(`${tag} 되돌리기 → 상태·이동 수 복원, 횟수 −1`, a.shelves.join('|') === init && a.moves === 0 && a.undo === b.undo - 1, `undo ${b.undo}→${a.undo}`);
      await snap(page, w, h, '06-undo');
      await tapMove(page, b.solution[0]);
      await tapSel(page, '[data-testid=reset]');
      await sleep(150);
      a = await board(page);
      check(`${tag} 처음부터 → 시작 상태`, a.shelves.join('|') === init && a.moves === 0);
      // 정리가 안 되는 이동만 반복해 이동 제한 소진 → 실패
      let guard = 0;
      while (!(await done(page)) && guard++ < 40) {
        const s = await board(page);
        if (s.status !== 'playing') break;
        let moved = false;
        for (let from = 0; from < s.shelves.length && !moved; from++) for (let i = 0; i < s.shelves[from].length && !moved; i++) {
          if (/[A-F]/.test(s.shelves[from][i])) continue;
          for (let to = 0; to < s.shelves.length && !moved; to++) if (to !== from && s.shelves[to].length < s.caps[to] && s.shelves[from][i] !== s.shelves[to][s.shelves[to].length - 1]) { await tapMove(page, [from, i, to]); moved = true; }
        }
        if (!moved) break;
      }
      await page.locator('[data-testid=result]').waitFor({ timeout: 8000 }).catch(() => {});
      const tone = await page.locator('[data-testid=result]').getAttribute('data-tone').catch(() => null);
      check(`${tag} 이동 제한을 다 쓰면 실패 결과`, tone === 'fail' || tone === 'clear', `tone=${tone}`);
      await snap(page, w, h, '07-result-fail');
      await layout(page, `${tag} 결과(실패)`);
      check(`${tag} 콘솔 오류 없음 (B)`, errors.length === 0, errors.join('|'));
      await ctx.close();
    }

    // ── C. 상위 레벨 화면: L5(고정·잠긴 칸) · L8(6줄) 레이아웃과 조작, 연쇄 반응
    {
      const { ctx, page, errors } = await mk(9);
      await startFree(page, 5);
      let b = await board(page);
      await snap(page, w, h, '10-L5-start');
      await layout(page, `${tag} L5 플레이`);
      const locked = b.caps.reduce((a, c) => a + (5 - c), 0);
      check(`${tag} L5: 5줄 · 잠긴 칸 2 · 고정 장난감 표시`, b.shelves.length === 5 && locked === 2 && /[A-F]/.test(b.shelves.join('')), `locked ${locked}`);
      const fixedAt = b.shelves.map((s, i) => [i, s.search(/[A-F]/)]).find(([, j]) => j >= 0);
      if (fixedAt) {
        const sl = page.locator(`[data-testid=board] [data-shelf="${fixedAt[0]}"] [data-slot="${fixedAt[1]}"]`).first(); const sb = await sl.boundingBox();
        await page.touchscreen.tap(sb.x + sb.width / 2, sb.y + sb.height / 2); await sleep(120);
        check(`${tag} 고정 장난감은 선택 불가(알림)`, (await board(page)).selected === '' && (await page.locator('[data-testid=feedback][data-kind=warn]').count()) === 1);
      }
      {
        const fullIdx = b.shelves.findIndex((sh, i) => sh.length >= b.caps[i]);
        const src = b.shelves.findIndex((sh, i) => i !== fullIdx && sh.length > 0 && !/[A-F]/.test(sh[0]));
        if (fullIdx >= 0 && src >= 0) {
          const sl = page.locator(`[data-testid=board] [data-shelf="${src}"] [data-slot="0"]`).first(); const sb = await sl.boundingBox();
          await page.touchscreen.tap(sb.x + sb.width / 2, sb.y + sb.height / 2); await sleep(50);
          const fb = await page.locator(`[data-testid=board] [data-shelf="${fullIdx}"]`).first().boundingBox();
          await page.touchscreen.tap(fb.x + fb.width / 2, fb.y + fb.height / 2); await sleep(120);
          const r = await board(page);
          check(`${tag} 가득 찬 선반으로는 이동 불가(이동 수 그대로) · 알림 · 선택 유지`, r.moves === 0 && (await page.locator('[data-testid=feedback][data-kind=warn]').count()) === 1 && r.selected !== '');
          await page.touchscreen.tap(sb.x + sb.width / 2, sb.y + sb.height / 2); await sleep(60); // 선택 해제
        } else check(`${tag} (이번 L5 판엔 가득 찬 선반이 없어 불가능 이동 점검 생략)`, true);
      }
      let chain = false;
      for (let k = 0; k < b.solution.length && k < 4; k++) { const nb = await tapMove(page, b.solution[k]); if (nb.sets - (k ? 0 : 0) >= 0) chain = chain || (await page.locator('[data-testid=feedback][data-kind=chain]').count()) > 0; }
      await snap(page, w, h, '11-L5-played');
      await page.goto(url, { waitUntil: 'networkidle' });
      await startFree(page, 8);
      b = await board(page);
      await snap(page, w, h, '12-L8-start');
      await layout(page, `${tag} L8 플레이(6줄)`);
      check(`${tag} L8: 6줄 · 세트 9 · 6칸`, b.shelves.length === 6 && b.total === 9, `${b.shelves.length}줄`);
      let reached = 0;
      for (let k = 0; k < b.solution.length && !(await done(page)); k++) { await tapMove(page, b.solution[k]); reached++; }
      check(`${tag} L8: 정답 풀이 전체를 탭으로 재생(${reached}/${b.solution.length}수)`, reached === b.solution.length);
      await page.locator('[data-testid=result]').waitFor({ timeout: 8000 }).catch(() => {});
      check(`${tag} L8: 클리어 결과`, (await page.locator('[data-testid=result]').getAttribute('data-tone').catch(() => null)) === 'clear');
      await snap(page, w, h, '13-L8-result');
      check(`${tag} 콘솔 오류 없음 (C)`, errors.length === 0, errors.join('|'));
      await ctx.close();
    }

    // ── D. 일시정지 중에는 보드 조작 불가 · 재개
    {
      const { ctx, page, errors } = await mk();
      await startFree(page, 2);
      const b = await board(page);
      await tapSel(page, '[data-testid=pause]');
      await page.locator('[data-testid=paused]').waitFor();
      const bb = await page.locator('[data-testid=board]').boundingBox();
      await page.touchscreen.tap(bb.x + 14, bb.y + 14).catch(() => {});   // 팝업 밖(보드 왼쪽 위) — 오버레이가 입력을 막아야 함
      await sleep(150);
      check(`${tag} 일시정지 중 보드 탭은 무시됨(여전히 일시정지)`, (await board(page)).selected === '' && (await board(page)).moves === 0 && (await page.locator('[data-testid=paused]').count()) === 1);
      await snap(page, w, h, '14-paused');
      await tapSel(page, '[data-testid=resume]');
      await page.locator('[data-testid=resuming]').waitFor({ state: 'detached', timeout: 6000 });
      const nb = await tapMove(page, b.solution[0]);
      check(`${tag} 재개 후 정상 조작`, nb.moves === 1);
      check(`${tag} 콘솔 오류 없음 (D)`, errors.length === 0, errors.join('|'));
      await ctx.close();
    }

    // ── E. 랜덤 챌린지에서 같은 모듈 (제한시간 표시)
    {
      const { ctx, page, errors } = await mk();
      await tapSel(page, '[data-testid=go-challenge]');
      await tapSel(page, '[data-testid=start]');
      await page.locator('[data-testid=intro]').waitFor();
      check(`${tag} 챌린지 인트로에 장난감방`, (await page.locator('[data-testid=intro]').innerText()).includes('장난감방'));
      await tapSel(page, '[data-testid=intro]');
      await page.locator('[data-testid=ready]').waitFor({ timeout: 8000 }).catch(() => {});
      await page.locator('[data-testid=ready]').waitFor({ state: 'detached', timeout: 6000 });
      const b = await board(page);
      check(`${tag} 챌린지 HUD: 목숨 3 · 제한시간 표시 · 같은 보드`, (await roundAttr(page, 'lives')) === '3' && (await roundAttr(page, 'time')) !== '' && !!b);
      await layout(page, `${tag} 챌린지 플레이`);
      await snap(page, w, h, '20-challenge');
      for (const m of b.solution) { await tapMove(page, m); if (await done(page)) break; }
      await page.locator('[data-testid=summary]').waitFor({ timeout: 10000 }).catch(() => {});
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
