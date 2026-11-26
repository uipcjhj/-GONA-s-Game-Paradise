/* 로비 v1(현재) vs v2(?lobby=2) 캡처 · 스크롤/넘침 검사 · 393×636 · 390×844
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-lobby2-shots.cjs <url(끝 /)> <outdir>
 */
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out] = process.argv.slice(2);
const seed = () => {
  localStorage.setItem('gona.skyadv.opened', '1');
  if (localStorage.getItem('qa.seeded')) return;
  localStorage.setItem('qa.seeded', '1');
  localStorage.setItem('gona.skyadv.profiles', JSON.stringify({ v: 1, active: 'p1', list: [{ id: 'p1', nick: '고나아빠', created: '2026-11-20' }] }));
  localStorage.setItem('gona.skyadv.records', JSON.stringify({ easy: { score: 120000, reach: 3, clear: false }, normal: { score: 0, reach: 1, clear: false }, hard: { score: 0, reach: 1, clear: false } }));
  localStorage.setItem('gona.skyadv.rec2', JSON.stringify({ v: 2, boards: {}, daily: {}, col: { clears: {}, flags: {}, seen: {}, counts: { allParts: 1 }, stages: { 'mom:easy:1': { rank: 'A', hits: 1, bombs: 0, allParts: true, at: '2026-11-20', score: 40000 }, 'dad:easy:2': { rank: 'B', hits: 3, bombs: 1, allParts: false, at: '2026-11-21', score: 30000 } } } }));
};
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const errs = [];
  for (const [w, h] of [[393, 636], [390, 844]]) {
    for (const v of ['v1', 'v2']) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await ctx.addInitScript(seed);
      const p = await ctx.newPage();
      p.on('pageerror', (e) => errs.push(e.message));
      await p.goto(url + '?skytest' + (v === 'v2' ? '&lobby=2' : ''));
      await p.waitForSelector('.ttl-start', { timeout: 60000 });
      await p.tap('.ttl-start');
      await p.waitForSelector(v === 'v2' ? '.lb2-story' : '.lob-story', { timeout: 15000 });
      // 새 보상 1장 생긴 상태
      await p.evaluate(() => { const k = 'gona.skyadv.rec2'; const r = JSON.parse(localStorage.getItem(k)); r.col.stages['imo:normal:3'] = { rank: 'S', hits: 0, bombs: 0, allParts: true, at: '2026-11-26', score: 90000 }; r.col.flags.nomiss = true; localStorage.setItem(k, JSON.stringify(r)); });
      await p.tap('.lob-nav button:nth-child(3)'); await p.waitForSelector('.recs'); await p.tap('.lob-nav button:nth-child(1)');
      await p.waitForSelector(v === 'v2' ? '.lb2-story' : '.lob-story'); await p.waitForTimeout(900);
      await p.screenshot({ path: `${out}/${w}x${h}-${v}.png` });
      if (v === 'v2') {
        const m = await p.evaluate(() => {
          const doc = document.scrollingElement; const main = document.querySelector('.lb2-main');
          const nav = document.querySelector('.lob-nav').getBoundingClientRect(); const wid = document.querySelector('.lb2-widgets').getBoundingClientRect();
          const story = document.querySelector('.lb2-story').getBoundingClientRect(); const hud = document.querySelector('.lb2-hud').getBoundingClientRect();
          const texts = [...document.querySelectorAll('.lb2-main *')].filter((e) => e.children.length === 0 && e.innerText).map((e) => e.innerText.trim()).filter(Boolean);
          return { scroll: doc.scrollHeight - innerHeight, hOver: doc.scrollWidth - innerWidth, mainOver: main.scrollHeight - main.clientHeight, gapNav: Math.round(nav.top - wid.bottom), storyTop: Math.round(story.top - hud.bottom), words: texts.join(' ').length, texts };
        });
        console.log(`${w}x${h} v2: 세로 스크롤 ${m.scroll} · 가로 넘침 ${m.hOver} · 본문 넘침 ${m.mainOver} · 위젯↔탭 ${m.gapNav}px · HUD↔배너 ${m.storyTop}px · 메인 글자 수 ${m.words} (${m.texts.join(' / ')})`);
        // 눌러서 들어가는지
        await p.tap('.lb2-hunt'); const hunt = !!(await p.waitForSelector('.hunt-grid', { timeout: 5000 }).catch(() => null));
        await p.tap('text=로비').catch(() => {}); await p.waitForSelector('.lb2-story');
        await p.tap('.lb2-daily'); const daily = !!(await p.waitForSelector('.sky.end, .daily, .dly', { timeout: 5000 }).catch(() => null));
        await p.goto(url + '?skytest&lobby=2'); await p.waitForSelector('.ttl-start'); await p.tap('.ttl-start'); await p.waitForSelector('.lb2-story');
        await p.tap('.lb2-new'); const alb = !!(await p.waitForSelector('.album', { timeout: 5000 }).catch(() => null));
        await p.tap('.lob-nav button:nth-child(1)'); await p.waitForSelector('.lb2-story'); const gone = !(await p.$('.lb2-new'));
        await p.tap('.lb2-story'); const sel = !!(await p.waitForSelector('.sel-main', { timeout: 5000 }).catch(() => null));
        console.log(`   이동: STORY→선택 ${sel} · 추억사냥 ${hunt} · 오늘의 도전 ${daily} · NEW→앨범 ${alb} · 확인 후 NEW 사라짐 ${gone}`);
      }
      await ctx.close();
    }
  }
  console.log('오류', errs.length, errs.slice(0, 2).join(' | '));
  await b.close();
})();
