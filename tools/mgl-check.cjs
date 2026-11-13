#!/usr/bin/env node
/**
 * Mini Game Land 모바일 점검 — 실제 터치(touchscreen.tap)로 플레이하며 화면 잘림·스크롤·터치 오류·콘솔 오류를 검사하고 스크린샷을 남깁니다.
 *
 *   npm run build && npx vite preview --port 4175 &
 *   NODE_PATH=$(npm root -g) node tools/mgl-check.cjs http://localhost:4175/mini-game-land/ shots/mgl
 *
 * 환경변수: MGL_LONG=1 → 챌린지에서 5연속 클리어(목숨 +1)까지 실제로 확인 (약 1분 추가)
 */
const fs = require('fs');
const { chromium } = require('playwright');

const [url, outDir = 'shots/mgl'] = process.argv.slice(2);
if (!url) { console.error('usage: mgl-check.cjs <url> [out-dir]'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });
const SIZES = [[393, 636], [390, 844]];
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function layout(page, tag) {
  const r = await page.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const de = document.documentElement;
    const bad = [];
    for (const el of document.querySelectorAll('button, a')) {
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      if (b.left < -0.5 || b.top < -0.5 || b.right > vw + 0.5 || b.bottom > vh + 0.5) bad.push(`밖: ${el.textContent.trim().slice(0, 12)} ${Math.round(b.left)},${Math.round(b.top)}-${Math.round(b.right)},${Math.round(b.bottom)}`);
      if ((b.width < 44 || b.height < 44) && !el.classList.contains('tt-cell')) bad.push(`작음: ${el.textContent.trim().slice(0, 12)} ${Math.round(b.width)}x${Math.round(b.height)}`);
    }
    for (const el of document.querySelectorAll('h1,h2,h3,p,span,dt,dd,li,.mgl-btn')) {
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow === 'visible' && el.clientWidth > 0 && getComputedStyle(el).display !== 'inline') bad.push(`글자 넘침: ${el.textContent.trim().slice(0, 14)}`);
    }
    return { sx: de.scrollWidth > vw, sy: de.scrollHeight > vh, bad };
  });
  check(`${tag}: 가로/세로 스크롤 없음`, !r.sx && !r.sy);
  check(`${tag}: 버튼 화면 안·터치 영역 44px↑·글자 잘림 없음`, r.bad.length === 0, r.bad.join(' | '));
}

async function tapEl(page, sel) {
  const loc = page.locator(sel).first();
  await loc.waitFor({ state: 'visible', timeout: 8000 });
  const b = await loc.boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
}
const snap = (page, w, h, name) => page.screenshot({ path: `${outDir}/${w}x${h}-${name}.png` });
const text = (page, sel) => page.locator(sel).first().innerText();

/** 보이는 고나를 실제 터치로 눌러 라운드를 클리어 (gona 가 없으면 잠깐 대기) */
async function botPlay(page, { until, maxMs = 30000 }) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    if (await page.locator(until).count()) return true;
    const cell = page.locator('[data-kind="gona"]').first();
    if (await cell.count()) {
      const b = await cell.boundingBox();
      if (b) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    }
    await sleep(60);
  }
  return false;
}

(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of SIZES) {
    const tag = `${w}×${h}`;
    console.log(`\n── ${tag}`);
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(url, { waitUntil: 'networkidle' });

    // 홈
    await page.locator('[data-testid=home]').waitFor();
    await snap(page, w, h, '01-home');
    await layout(page, `${tag} 홈`);

    // 자유 플레이: 선택 → 방법/레벨 → 시작
    await tapEl(page, '[data-testid=go-free]');
    await page.locator('[data-testid=free-select]').waitFor();
    await snap(page, w, h, '02-free-select');
    await layout(page, `${tag} 자유-선택`);
    await tapEl(page, '[data-testid=pick-tap-test]');
    await page.locator('[data-testid=free-prepare]').waitFor();
    await snap(page, w, h, '03-free-prepare');
    await layout(page, `${tag} 자유-준비`);
    check(`${tag} 자유: 첫 시작 레벨은 LV 1`, (await text(page, '[data-testid=start-level]')).includes('LV 1'));
    await tapEl(page, '[data-testid=start]');
    await page.locator('[data-testid=ready]').waitFor();
    await snap(page, w, h, '04-ready');
    await page.locator('[data-testid=ready]').waitFor({ state: 'detached', timeout: 4000 });

    // 플레이 중 고나 등장 → 터치 → 점수 증가
    await page.locator('[data-kind="gona"]').first().waitFor({ timeout: 5000 });
    await snap(page, w, h, '05-playing');
    await layout(page, `${tag} 플레이`);
    const s0 = Number((await text(page, '[data-testid=score]')).replace(/,/g, ''));
    await botPlay(page, { until: '[data-testid=score]:text-matches("^[1-9]")', maxMs: 5000 });
    await sleep(200);
    const s1 = Number((await text(page, '[data-testid=score]')).replace(/,/g, ''));
    check(`${tag} 터치로 고나 콕 → 점수 증가`, s1 > s0, `${s0} → ${s1}`);

    // 일시정지 → 시간 정지 → 재개 카운트다운
    await tapEl(page, '[data-testid=pause]');
    await page.locator('[data-testid=paused]').waitFor();
    await snap(page, w, h, '06-paused');
    await layout(page, `${tag} 일시정지`);
    const t0 = await text(page, '[data-testid=time]');
    await sleep(1600);
    const t1 = await text(page, '[data-testid=time]');
    check(`${tag} 일시정지 중 시간 정지`, t0 === t1, `${t0} → ${t1}`);
    await tapEl(page, '[data-testid=resume]');
    await page.locator('[data-testid=resuming]').waitFor();
    await snap(page, w, h, '07-resuming');
    await page.locator('[data-testid=resuming]').waitFor({ state: 'detached', timeout: 5000 });

    // 시스템 이벤트(앱 전환 등)로 자동 일시정지
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    check(`${tag} 앱 전환(pagehide) 시 자동 일시정지`, await page.locator('[data-testid=paused]').count() === 1);
    await tapEl(page, '[data-testid=resume]');
    await page.locator('[data-testid=resuming]').waitFor({ state: 'detached', timeout: 5000 });

    // 클리어까지 실제 터치로 플레이
    const cleared = await botPlay(page, { until: '[data-testid=result]', maxMs: 40000 });
    check(`${tag} 터치만으로 라운드 클리어 → 결과 화면`, cleared);
    await snap(page, w, h, '08-result-clear');
    await layout(page, `${tag} 결과(클리어)`);
    check(`${tag} 결과: 클리어 표시·다음 레벨 버튼`, (await page.locator('[data-testid=result]').getAttribute('data-tone')) === 'clear' && (await page.locator('[data-testid=next]').count()) === 1);
    check(`${tag} 결과: 최고 기록 NEW 배지`, (await page.locator('[data-testid=badge]').count()) >= 1);

    // 다음 레벨 → 레벨 2, 난이도 상승(HUD LV)
    await tapEl(page, '[data-testid=next]');
    await page.locator('[data-testid=ready]').waitFor();
    check(`${tag} 다음 레벨 LV 2 시작`, (await page.locator('.mgl-hud').innerText()).includes('LV 2'));
    await page.locator('[data-testid=ready]').waitFor({ state: 'detached', timeout: 4000 });
    await tapEl(page, '[data-testid=pause]');
    await tapEl(page, '[data-testid=quit]'); // 1회: 확인 문구
    await tapEl(page, '[data-testid=quit]'); // 2회: 나가기
    await page.locator('[data-testid=free-select]').waitFor();
    await layout(page, `${tag} 자유-선택(복귀)`);

    // 기록 저장 확인
    const rec = await page.evaluate(() => JSON.parse(localStorage.getItem('gmgl.v1') || 'null'));
    check(`${tag} 기록 저장(localStorage gmgl.v1)`, !!rec && rec.games['tap-test'] && rec.games['tap-test'].bestScore > 0 && rec.games['tap-test'].bestLevel >= 1, JSON.stringify(rec && rec.games));

    // 랜덤 챌린지
    await page.getByText('돌아가기').first().tap();
    await tapEl(page, '[data-testid=go-challenge]');
    await page.locator('[data-testid=challenge-start]').waitFor();
    await snap(page, w, h, '09-challenge-start');
    await layout(page, `${tag} 챌린지-안내`);
    await tapEl(page, '[data-testid=start]');
    await page.locator('[data-testid=intro]').waitFor();
    await snap(page, w, h, '10-challenge-intro');
    await layout(page, `${tag} 챌린지-인트로`);
    await tapEl(page, '[data-testid=intro]'); // 탭하면 건너뜀
    await page.locator('[data-testid=ready]').waitFor();
    check(`${tag} 챌린지: 목숨 3개로 시작`, (await page.locator('[data-testid=lives]').getAttribute('data-lives')) === '3');
    await page.locator('[data-testid=ready]').waitFor({ state: 'detached', timeout: 4000 });
    await snap(page, w, h, '11-challenge-playing');
    await layout(page, `${tag} 챌린지-플레이`);

    // 라운드 1 클리어 → 요약 카드
    await botPlay(page, { until: '[data-testid=summary]', maxMs: 40000 });
    await snap(page, w, h, '12-challenge-summary');
    await layout(page, `${tag} 챌린지-요약`);
    check(`${tag} 챌린지: 클리어 요약 표시`, (await text(page, '[data-testid=summary]')).includes('CLEAR'));
    await page.locator('[data-testid=ready]').waitFor({ timeout: 6000 }); // 자동 진행 → ROUND 2

    // 실패(시간 초과) → 목숨 −1 (아무것도 안 함)
    await page.locator('[data-testid=ready]').waitFor({ state: 'detached', timeout: 4000 });
    const failed = await page.locator('[data-testid=summary]').waitFor({ timeout: 40000 }).then(() => true, () => false);
    check(`${tag} 챌린지: 시간 초과 → 실패 요약`, failed && (await text(page, '[data-testid=summary]')).includes('MISS'));
    await snap(page, w, h, '13-challenge-miss');
    await page.locator('[data-testid=ready]').waitFor({ timeout: 6000 });
    check(`${tag} 챌린지: 실패 후 목숨 2개`, (await page.locator('[data-testid=lives]').getAttribute('data-lives')) === '2');

    // 나가기 → 종료·기록
    await page.locator('[data-testid=ready]').waitFor({ state: 'detached', timeout: 4000 });
    await tapEl(page, '[data-testid=pause]');
    await tapEl(page, '[data-testid=quit]');
    await tapEl(page, '[data-testid=quit]');
    await page.locator('[data-testid=result]').waitFor();
    await snap(page, w, h, '14-challenge-over');
    await layout(page, `${tag} 챌린지-종료`);
    const rec2 = await page.evaluate(() => JSON.parse(localStorage.getItem('gmgl.v1')).challenge);
    check(`${tag} 챌린지 종합 기록 저장`, rec2.bestScore > 0 && rec2.plays === 1, JSON.stringify(rec2));
    await tapEl(page, '[data-testid=menu]');
    await page.locator('[data-testid=home]').waitFor();

    // 긴 점검(선택): 5연속 클리어 → 목숨 +1
    if (process.env.MGL_LONG && w === 393) {
      await tapEl(page, '[data-testid=go-challenge]');
      await tapEl(page, '[data-testid=start]');
      let gained = false;
      for (let i = 1; i <= 5; i++) {
        await page.locator('[data-testid=ready]').waitFor({ timeout: 8000 });
        await page.locator('[data-testid=ready]').waitFor({ state: 'detached', timeout: 4000 });
        await botPlay(page, { until: '[data-testid=summary]', maxMs: 60000 });
        if (i === 5) { gained = (await text(page, '[data-testid=summary]')).includes('목숨 +1'); await snap(page, w, h, '15-challenge-lifeup'); }
      }
      check(`${tag} 챌린지: 5연속 클리어 → 목숨 +1`, gained);
    }

    check(`${tag} 콘솔 오류 없음`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  await browser.close();
  const fail = results.filter((r) => !r.ok);
  console.log(`\n${results.length - fail.length}/${results.length} 통과`);
  fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(results, null, 2));
  process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
