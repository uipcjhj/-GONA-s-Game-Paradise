#!/usr/bin/env node
/**
 * Phase 7 통합 테스트: 게임천국 → (실제) Mini Game Land 편가르기 1판 → 게임천국 복귀 → 결과·기록·랭킹 반영.
 * 단독 실행(gp 없음) 시 아무것도 기록되지 않는지, 한 번도 안 한 챌린지는 기록 안 되는지도 확인. 393×636 · 390×844
 *   npm run build && npx vite preview --port 4173 &
 *   NODE_PATH=$(npm root -g) node tools/platform-e2e3.cjs http://127.0.0.1:4173/ shots-p3
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const [url = 'http://127.0.0.1:4173/', out = 'shots-p3'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const has = (card, c) => card[c.axis] === c.value;
function correctBin(card, rule) {
  const [a, b] = rule.conds; let base;
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
async function tapSel(page, sel) {
  const loc = page.locator(sel).first();
  await loc.waitFor({ state: 'visible', timeout: 8000 });
  const b = await loc.boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
}
const readStage = (page) => page.evaluate(() => {
  const st = document.querySelector('[data-testid=stage]'); const card = document.querySelector('[data-testid=card]');
  if (!st) return null;
  return { rule: JSON.parse(st.dataset.rule), locked: st.dataset.locked === '1', index: Number(st.dataset.index), card: card ? { color: card.dataset.color, face: card.dataset.face, feature: card.dataset.feature } : null };
});
async function playAll(page) {
  let n = 0;
  while (n < 40 && !(await page.locator('[data-testid=result]').count())) {
    let s = null;
    for (let i = 0; i < 80; i++) { if (await page.locator('[data-testid=result]').count()) break; const st = await readStage(page); if (st && !st.locked && st.card) { s = st; break; } await sleep(40); }
    if (!s) break;
    await tapSel(page, `[data-testid=bin-${correctBin(s.card, s.rule)}]`);
    for (let i = 0; i < 60; i++) { const nx = await readStage(page); if (!nx || nx.index !== s.index || (await page.locator('[data-testid=result]').count())) break; await sleep(30); }
    n++;
  }
  return n;
}
const waitPlaying = async (page) => { await page.locator('[data-testid=ready]').waitFor({ timeout: 8000 }).catch(() => {}); await page.locator('[data-testid=ready]').waitFor({ state: 'detached', timeout: 4000 }); await page.locator('[data-testid=card]').waitFor({ timeout: 8000 }); };
const keys = (page, pre) => page.evaluate((pre) => Object.keys(localStorage).filter((k) => k.startsWith(pre)), pre);
const player = async (page) => JSON.parse(await page.evaluate(() => localStorage.getItem('gp.v1.player')));
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of [[393, 636], [390, 844]]) {
    const tag = `${w}x${h}`;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await ctx.addInitScript(() => { if (!sessionStorage.getItem('__init')) { sessionStorage.setItem('__init', '1'); try { localStorage.setItem('gona.openingSeen', '1'); } catch (e) {} } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
    await page.goto(url);
    await page.waitForSelector('.title'); await page.touchscreen.tap(w / 2, h / 2);
    await page.fill('#gp-nick', '미니탐험'); await page.getByRole('button', { name: /다음/ }).tap(); await page.getByRole('button', { name: '이걸로 결정!' }).tap();
    await page.waitForSelector('text=WELCOME!'); await page.getByRole('button', { name: /시작|입장|출발|월드/ }).first().tap().catch(() => {}); await page.waitForSelector('.hit');

    // ── 섬 팝업
    const b = await page.locator('.hit').nth(3).boundingBox();
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForSelector('[data-testid=island-popup]'); await page.waitForTimeout(1300);
    ok(`[${tag}] 미니게임천국 섬: 플레이 가능 + 입장 버튼 + 연동 안내`, (await page.locator('.popup .chip-open').count()) === 1 && (await page.locator('[data-testid=island-play]').count()) === 1 && (await page.locator('[data-testid=island-record]').innerText()).includes('아직 기록이 없어요'));
    await page.screenshot({ path: path.join(out, `01-mini-popup_${tag}.png`) });
    await page.locator('[data-testid=island-play]').tap();
    await page.waitForURL(/mini-game-land\/\?gp=/);
    await page.waitForSelector('[data-testid=home]');
    const sid = new URL(page.url()).searchParams.get('gp');
    ok(`[${tag}] 입장 → Mini Game Land 가 gp 세션과 함께 열림`, !!sid && (await keys(page, 'gp.v1.session.')).length === 1);
    ok(`[${tag}] ← 게임천국 링크가 세션의 returnUrl 사용`, (await page.locator('[data-testid=back-hub]').getAttribute('href')).replace(/\/$/, '') === new URL(url).origin);

    // ── 실제 편가르기 1판 (자유 플레이 LV1) → 클리어
    await tapSel(page, '[data-testid=go-free]'); await tapSel(page, '[data-testid=pick-sort]'); await tapSel(page, '[data-testid=start]'); await waitPlaying(page);
    const n = await playAll(page);
    await page.locator('[data-testid=result]').waitFor({ timeout: 8000 });
    const cleared = (await page.locator('[data-testid=result]').getAttribute('data-outcome').catch(() => null)) ?? 'clear';
    ok(`[${tag}] 실제 플레이: 카드 ${n}장 처리 → 결과 화면`, n >= 8);
    await page.waitForTimeout(400);
    const inbox = await keys(page, 'gp.v1.inbox.');
    ok(`[${tag}] 라운드 종료 → inbox 에 결과 1건(게임이 쓴 새 키)`, inbox.length === 1);
    const env = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), inbox[0]));
    ok(`[${tag}] 봉투: gameId·subGameId·sdk·점수·단계`, env.result.gameId === 'minigame-paradise' && env.result.subGameId === 'sort' && env.sdk === 'gp-sdk/0.1' && env.result.score > 0 && env.result.stage === 1 && env.result.sessionId === sid);
    const miniOwn = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('gmgl.')));
    ok(`[${tag}] Mini Game Land 자체 저장(gmgl.*)은 별도로 유지`, miniOwn.length >= 1);
    await page.screenshot({ path: path.join(out, `02-mini-result_${tag}.png`) });
    // 같은 결과 화면에서 다시 이벤트가 나지 않음 (중복 방지)
    await page.waitForTimeout(500);
    ok(`[${tag}] 결과 화면 유지 중 중복 기록 없음`, (await keys(page, 'gp.v1.inbox.')).length === 1);

    // ── 챌린지: 한 라운드도 안 하고 나가면 기록 없음
    await page.getByText('메뉴', { exact: false }).first().tap().catch(() => {});
    // 결과 화면 → 홈으로: 버튼 문구가 달라서 홈 직접 이동
    await page.goto(page.url().split('?')[0] + `?gp=${sid}`);
    await page.waitForSelector('[data-testid=home]');
    await tapSel(page, '[data-testid=go-challenge]'); await page.locator('[data-testid=challenge-start]').waitFor();
    await page.getByText('돌아가기').first().tap(); await page.locator('[data-testid=home]').waitFor();
    ok(`[${tag}] 챌린지 시작 화면에서 나가면 기록 없음`, (await keys(page, 'gp.v1.inbox.')).length === 1);

    // ── 게임천국 복귀 → 결과 화면
    await tapSel(page, '[data-testid=back-hub]');
    if (process.env.DBG) { await page.waitForTimeout(1500); console.log('DBG', page.url(), await keys(page, 'gp.v1.'), await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('gp.v1.rejected')).map((k) => [k, localStorage.getItem(k)])))); }
    await page.waitForSelector('[data-testid=result]', { timeout: 8000 });
    const rtxt = await page.locator('[data-testid=result]').innerText();
    ok(`[${tag}] 복귀 → 결과 화면: 편가르기 · 점수 · XP/코인`, rtxt.includes('편가르기') && /\+\d+\s*XP/.test(rtxt) && Number(await page.locator('[data-testid=result-score]').getAttribute('data-value')) === env.result.score);
    ok(`[${tag}] 결과 화면 가로 스크롤 없음`, await noHScroll(page));
    await page.screenshot({ path: path.join(out, `03-paradise-result_${tag}.png`) });
    const pl = await player(page);
    const sub = pl.gameRecords['minigame-paradise']?.subGames?.sort;
    ok(`[${tag}] 저장: 미니게임 부모 plays 1 · 편가르기 기록(점수/단계)`, pl.gameRecords['minigame-paradise'].plays === 1 && sub && sub.plays === 1 && sub.bestScore === env.result.score && sub.bestStage === 1);
    ok(`[${tag}] 도감·업적: 미니게임 도감 열림`, !!pl.codex['mini-sort'] && !!pl.codex['game-minigame-paradise']);
    await page.locator('[data-testid=result-map]').tap(); await page.waitForSelector('.hit');
    // 프로필 / 랭킹
    await page.locator('[data-testid=nav-profile]').tap(); await page.waitForSelector('[data-testid=stats]');
    ok(`[${tag}] 프로필: 편가르기 기록 줄`, (await page.locator('[data-testid=rec-minigame-paradise-sort]').innerText()).includes(String(env.result.score).slice(0, 1)));
    await page.locator('[data-testid=nav-ranking]').tap();
    await page.getByRole('tab', { name: 'Mini' }).tap();
    await page.getByRole('tab', { name: '편가르기' }).tap();
    ok(`[${tag}] 랭킹: Mini › 편가르기 이 기기 순위 1건`, (await page.locator('[data-testid=rank-list] li').count()) === 1);
    await page.getByRole('tab', { name: '탑' }).tap();
    ok(`[${tag}] 랭킹: 다른 미니게임은 비어 있음`, (await page.locator('[data-testid=rank-empty]').count()) === 1);
    await page.screenshot({ path: path.join(out, `04-ranking-mini_${tag}.png`) });

    // ── 단독 실행(게임천국 거치지 않음): 아무것도 기록되지 않음
    await page.goto(new URL(url).origin + '/mini-game-land/');
    await page.waitForSelector('[data-testid=home]');
    await tapSel(page, '[data-testid=go-free]'); await tapSel(page, '[data-testid=pick-sort]'); await tapSel(page, '[data-testid=start]'); await waitPlaying(page);
    await playAll(page); await page.locator('[data-testid=result]').waitFor({ timeout: 8000 });
    await page.waitForTimeout(400);
    ok(`[${tag}] 단독 실행: gp 없음 → inbox 기록 없음(완전한 no-op)`, (await keys(page, 'gp.v1.inbox.')).length === 0 && (await page.locator('[data-testid=back-hub]').count()) === 0);
    ok(`[${tag}] 콘솔 오류 없음`, errors.length === 0, errors.slice(0, 2).join(' | '));
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${pass}/${pass + fail} 통과`);
  process.exit(fail ? 1 : 0);
})();
