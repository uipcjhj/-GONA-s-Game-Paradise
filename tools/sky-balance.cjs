/* 밸런스 검수: 자동 조종 봇으로 스테이지별·난이도별 시뮬레이션 (그리기 없이 1/60초 고정 간격으로 빠르게 진행)
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-balance.cjs <url> [diffs] [stages] [runs] [fam] */
const { chromium } = require('playwright');
const [url, diffs = 'easy,normal,hard', stages = '1,2,3,4,5,6', runs = '2', fam = 'mom'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(url);
  await page.waitForSelector('.ttl-start');
  await page.click('.ttl-start');
  await page.waitForSelector('.sel-art');
  const out = [];
  for (const d of diffs.split(',')) {
    for (const st of stages.split(',').map(Number)) {
      for (let r = 0; r < +runs; r++) {
        await page.evaluate(([s, dd]) => window.__skyFlow.start(s, dd), [st, d]);
        await page.waitForFunction((s) => window.__sky && window.__sky.debug().stage === s && window.__sky.debug().t < 1, st, { timeout: 20000 });
        const res = await page.evaluate(() => {
          const s = window.__sky;
          s.setPaused(true);
          s.cheat('auto');
          s.power = 3; // 이전 스테이지에서 이어 온 평균적인 화력
          let bossT = -1, midT = -1, midEnd = -1, maxEb = 0;
          for (let i = 0; i < 900 && !s.over; i++) {
            s.sim(0.5);
            const d = s.debug();
            maxEb = Math.max(maxEb, d.ebullets);
            if (midT < 0 && d.block === 'midboss') midT = d.t;
            if (midT >= 0 && midEnd < 0 && d.block !== 'midboss') midEnd = d.t;
            if (bossT < 0 && d.block === 'boss') bossT = d.t;
          }
          const d = s.debug();
          return { won: d.won, over: d.over, t: d.t, hits: d.hits, hp: d.hp, score: d.score, bossT, bossDur: d.won ? +(d.t - bossT).toFixed(1) : -1, midDur: midEnd > 0 ? +(midEnd - midT).toFixed(1) : -1, phase: d.phase, bossLeft: d.boss, maxEb, cause: d.cause };
        });
        out.push({ d, st, ...res });
        console.log(JSON.stringify({ d, st, ...res }));
        await page.evaluate(() => window.__sky.destroy());
      }
    }
  }
  console.log('errors', errs.length ? errs.slice(0, 5) : 'none');
  await b.close();
})();
