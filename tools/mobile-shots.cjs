#!/usr/bin/env node
/**
 * 모바일 시각 검수 — 같은 화면을 iPhone 크기로 캡처하고, 수정 전/후를 나란히 붙인 비교 이미지를 만듭니다.
 *
 *   NODE_PATH=$(npm root -g) node tools/mobile-shots.cjs <after-url> [before-url] [out-dir]
 *
 *   예) 수정 후는 로컬 빌드, 수정 전은 배포본(또는 main 빌드를 다른 포트로)
 *   npm run build && npx vite preview --port 4173 &
 *   NODE_PATH=$(npm root -g) node tools/mobile-shots.cjs http://localhost:4173/ http://localhost:4174/ shots
 *
 * 필수 화면: 393×636(iPhone 인앱 브라우저) · 390×844. 추가: SHOT_SIZES="375x667,430x932"
 * 검사: 가로·세로 스크롤 / 섬 터치(실제 좌표 탭) → 팝업 제목 / 팝업이 화면 안에 있는지 / 콘솔 오류
 * Playwright 는 이 환경에 설치되어 있음(chromium). 프로젝트 의존성에는 넣지 않음.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const [after, before, outDir = 'shots'] = process.argv.slice(2);
if (!after) {
  console.error('usage: mobile-shots.cjs <after-url> [before-url] [out-dir]');
  process.exit(1);
}
const sizes = (process.env.SHOT_SIZES || '').split(',').filter(Boolean);
const SIZES = ['393x636', '390x844', ...sizes].map((s) => s.split('x').map(Number));
fs.mkdirSync(outDir, { recursive: true });

async function capture(browser, url, tag, [w, h]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url);
  if (await page.waitForSelector('.title, .hit', { timeout: 10000 }).then((el) => el.evaluate((n) => n.classList.contains('title')))) {
    await page.touchscreen.tap(w / 2, h / 2); // 타이틀 → 월드맵 (실제 흐름 그대로)
  }
  await page.waitForSelector('.hit', { timeout: 10000 });
  await page.waitForTimeout(700);
  const name = `${w}x${h}`;
  const shots = { home: path.join(outDir, `${tag}-${name}-home.png`) };
  await page.screenshot({ path: shots.home });

  const report = { size: name, tag, islands: [], errors };
  const n = await page.locator('.hit').count();
  for (let i = 1; i < n; i++) {
    // 0번은 중앙 광장. 섬 터치 영역의 '정중앙'을 실제 좌표로 탭
    const el = page.locator('.hit').nth(i);
    const label = await el.getAttribute('aria-label');
    const b = await el.boundingBox();
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(1300);
    const title = await page.locator('.popup h2').textContent().catch(() => null);
    const pop = await page.locator('.popup').boundingBox();
    const inside = !!pop && pop.x >= 0 && pop.y >= 0 && pop.x + pop.width <= w && pop.y + pop.height <= h;
    report.islands.push({ label, popup: title, popupInside: inside });
    shots[`island${i}`] = path.join(outDir, `${tag}-${name}-island${i}.png`);
    await page.screenshot({ path: shots[`island${i}`] });
  }
  report.overflow = await page.evaluate(() => [document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight]);
  await ctx.close();
  return { shots, report };
}

function sideBySide(left, right, out) {
  // ImageMagick 없이 Python/PIL 로 합성 (환경에 설치되어 있음)
  const { execFileSync } = require('child_process');
  execFileSync('python3', ['-c', `
import sys
from PIL import Image
a=Image.open(sys.argv[1]);b=Image.open(sys.argv[2])
im=Image.new('RGB',(a.width+b.width+24,max(a.height,b.height)),'white');im.paste(a,(0,0));im.paste(b,(a.width+24,0));im.save(sys.argv[3])`, left, right, out]);
}

(async () => {
  const browser = await chromium.launch();
  let bad = 0;
  for (const size of SIZES) {
    const a = await capture(browser, after, 'after', size);
    const r = [a.report];
    if (before) {
      const b = await capture(browser, before, 'before', size);
      r.unshift(b.report);
      for (const k of Object.keys(a.shots)) sideBySide(b.shots[k], a.shots[k], path.join(outDir, `compare-${size.join('x')}-${k}.png`));
    }
    for (const rep of r) {
      const ok = rep.overflow.every((v) => v <= 0) && rep.islands.every((i) => i.popup && i.popupInside) && rep.errors.length === 0;
      if (!ok && rep.tag === 'after') bad++;
      console.log(`${ok ? 'OK ' : 'FAIL'} ${rep.tag.padEnd(6)} ${rep.size}  overflow=${rep.overflow}  ${rep.islands.map((i) => `${i.popup}${i.popupInside ? '' : '(팝업 화면밖)'}`).join(' | ')}${rep.errors.length ? '  errors=' + rep.errors : ''}`);
    }
  }
  await browser.close();
  console.log(`\n결과 이미지: ${path.resolve(outDir)}  (before 지정 시 compare-*.png = 왼쪽 수정 전 / 오른쪽 수정 후)`);
  process.exit(bad ? 1 : 0);
})();
