// 응가 테마 모바일 화면 자동 검수 (iPhone 크기 5종 · 터치 · iPhone Safari UA)
//  타이틀 → 선택 → STAGE 1 전투(무전창) → 보스 등장 대화창 → 엔딩 전 장면 → 크레딧
//  검사: 대화창·무전창·버튼이 화면 안 · 가로 스크롤 없음 · 엔딩 그림이 화면 밖으로 잘리지 않음 · 콘솔 오류 · 엔딩 시간
// 사용: NODE_PATH=$(npm root -g) node tools/sky-mobile-check.cjs <url> <outdir> [sizes=375x667,393x636,390x844,393x852,430x932]
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out, SIZES = '375x667,393x636,390x844,393x852,430x932'] = process.argv.slice(2);
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const report = [];
  for (const sz of SIZES.split(',')) {
    const [W, H] = sz.split('x').map(Number);
    const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: UA });
    const p = await ctx.newPage();
    const errs = [], bad = [], issues = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    p.on('response', (r) => r.status() >= 400 && bad.push(r.status() + ' ' + r.url()));
    const shot = (n) => p.screenshot({ path: `${out}/${sz}-${n}.png` });
    // 요소가 화면 안에 다 들어오는지
    const inView = async (sel, name) => {
      const r = await p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; }, sel);
      if (!r) { issues.push(`${name} 없음`); return; }
      if (r[0] < -1 || r[1] < -1 || r[2] > W + 1 || r[3] > H + 1) issues.push(`${name} 화면 밖 [${r.map(Math.round)}]`);
    };
    const noHScroll = async (where) => {
      const sw = await p.evaluate(() => document.documentElement.scrollWidth);
      if (sw > W + 1) issues.push(`${where} 가로 스크롤 ${sw}px`);
    };
    await p.goto(url);
    await p.waitForSelector('.ttl-start');
    await p.waitForTimeout(1200);
    await shot('01-title'); await noHScroll('타이틀');
    await p.tap('.ttl-start');
    await p.waitForSelector('.sel-art, .opening-skip');
    if (await p.$('.opening-skip')) { await p.waitForTimeout(600); await shot('02-opening'); await p.tap('.opening-skip'); }
    await p.waitForSelector('.sel-art'); await p.waitForTimeout(500);
    await shot('03-select'); await noHScroll('선택'); await inView('.sky-btn-go', '출격 버튼');
    await p.tap('.sky-btn-go');
    await p.waitForSelector('.sky-canvas');
    await p.waitForFunction(() => window.__sky);
    // 시작 무전창 (전투 계속)
    await p.waitForSelector('.sky-bark', { timeout: 8000 }).catch(() => issues.push('시작 무전창 안 보임'));
    await p.waitForTimeout(700);
    await shot('04-bark'); await inView('.sky-bark', '무전창');
    const t1 = await p.evaluate(() => window.__sky.debug().t); await p.waitForTimeout(800); const t2 = await p.evaluate(() => window.__sky.debug().t);
    if (!(t2 > t1)) issues.push('무전창 중 전투가 멈춤');
    await inView('.sky-sp', '필살 버튼'); await inView('.sky-bomb', '폭탄 버튼'); await inView('.sky-pause', '일시정지');
    // 보스 등장 정지 대화
    await p.evaluate(() => { window.__sky.cheat('god'); window.__sky.cheat('boss'); });
    for (let i = 0; i < 200 && !(await p.$('.sky-talk')); i++) { await p.evaluate(() => window.__sky.sim(0.3)); await p.waitForTimeout(40); }
    await p.waitForTimeout(1500);
    await shot('05-boss-talk'); await inView('.talk-win', '대화창'); await inView('.talk-skip', 'SKIP');
    await p.tap('.talk-skip');
    await p.waitForTimeout(600);
    await shot('06-boss-fight');
    // 엔딩 (테스트용 '엔딩 보기')
    await p.evaluate(() => window.__sky.setPaused(true));
    await p.tap('.sky-pause').catch(() => {});
    await p.goto(url); await p.waitForSelector('.ttl-start'); await p.waitForTimeout(400);
    await p.tap('.ttl-test');
    await p.waitForSelector('.pe');
    const t0 = Date.now();
    const seenScene = new Set();
    let k = 7;
    while (!(await p.$('.cred')) && Date.now() - t0 < 120000) {
      const cls = await p.evaluate(() => (document.querySelector('.pe')?.className || '').replace('sky end pe ', ''));
      if (cls && !seenScene.has(cls)) {
        seenScene.add(cls);
        await p.waitForTimeout(900);
        await shot(`${String(k++).padStart(2, '0')}-ending-${cls}`);
        await inView('.talk-win', `엔딩 대화창(${cls})`); await inView('.pe-skipall', '엔딩 건너뛰기');
        // 원화가 화면 밖으로 잘리는지 (일부만 보이는 그림)
        const cut = await p.evaluate(([W, H]) => [...document.querySelectorAll('.pe-stage img')].filter((im) => { const r = im.getBoundingClientRect(); return r.width > 0 && !im.classList.contains('pe-bg') && !im.classList.contains('pe-train') && (r.left < -2 || r.right > W + 2 || r.top < -2 || r.bottom > H + 2); }).map((im) => im.className), [W, H]);
        if (cut.length) issues.push(`엔딩 ${cls} 그림 잘림: ${cut.join(',')}`);
      }
      await p.waitForTimeout(200);
    }
    const endSec = ((Date.now() - t0) / 1000).toFixed(1);
    await p.waitForTimeout(800);
    await shot('20-credits'); await inView('.cred-btns', '크레딧 버튼');
    report.push(`${sz}: 엔딩 ${seenScene.size}장면 ${endSec}초(자동 진행) · 문제 ${issues.length ? issues.join(' / ') : '없음'} · 실패 요청 ${bad.length} · 콘솔 오류 ${errs.length ? errs.join(' | ') : 0}`);
    await ctx.close();
  }
  fs.writeFileSync(`${out}/report.txt`, report.join('\n'));
  console.log(report.join('\n'));
  await b.close();
})();
