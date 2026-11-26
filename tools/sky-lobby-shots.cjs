/* 타이틀(단순화) · 메인 로비 · 로비 메뉴 화면 캡처 (기록이 조금 있는 사용자 상태)
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-lobby-shots.cjs <url(끝 /)> <outdir>
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
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ctx.addInitScript(seed);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(url + '?skytest');
    await p.waitForSelector('.ttl-start', { timeout: 60000 });
    await p.waitForTimeout(2200);
    await p.screenshot({ path: `${out}/${w}x${h}-1-title.png` });
    await p.tap('.ttl-start');
    await p.waitForSelector('.lob-story', { timeout: 10000 });
    // 새 보상 표시를 보려고: 로비 첫 진입 후 사진 1장 추가 → 다시 그리기
    await p.evaluate(() => { const k = 'gona.skyadv.rec2'; const r = JSON.parse(localStorage.getItem(k)); r.col.stages['imo:normal:3'] = { rank: 'S', hits: 0, bombs: 0, allParts: true, at: '2026-11-26', score: 90000 }; r.col.flags.nomiss = true; localStorage.setItem(k, JSON.stringify(r)); });
    await p.tap('.lob-nav button:nth-child(3)'); await p.waitForSelector('.recs-tabs'); await p.waitForTimeout(500);
    await p.screenshot({ path: `${out}/${w}x${h}-5-rank.png` });
    await p.tap('.lob-nav button:nth-child(1)'); await p.waitForSelector('.lob-story');
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${out}/${w}x${h}-2-lobby.png` });
    const sc = await p.evaluate(() => { const e = document.querySelector('.lob-scroll'); return [e.scrollHeight, e.clientHeight]; });
    await p.evaluate(() => { const e = document.querySelector('.lob-scroll'); e.scrollTop = e.scrollHeight; });
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${out}/${w}x${h}-3-lobby-bottom.png` });
    await p.tap('.lob-gear'); await p.waitForSelector('.lob-set'); await p.screenshot({ path: `${out}/${w}x${h}-4-settings.png` }); await p.tap('.lob-set .sky-btn-go');
    await p.tap('.lob-nav button:nth-child(4)'); await p.waitForSelector('.prof-box'); await p.screenshot({ path: `${out}/${w}x${h}-6-profile.png` }); await p.tap('.prof-box .sky-btn-go:has-text("닫기")');
    await p.tap('.lob-reward'); await p.waitForSelector('.recs-tabs'); await p.waitForTimeout(500); await p.screenshot({ path: `${out}/${w}x${h}-7-album-from-reward.png` });
    await p.tap('.lob-nav button:nth-child(1)'); await p.waitForSelector('.lob-story'); await p.waitForTimeout(400);
    const dot = await p.$('.lob-reward .lob-dot');
    await p.screenshot({ path: `${out}/${w}x${h}-8-lobby-after-ack.png` });
    console.log(w, h, '로비 스크롤', sc.join('/'), '확인 후 보상 알림', dot ? '남음 ⚠' : '사라짐');
    await ctx.close();
  }
  console.log('오류', errs.length, errs.slice(0, 2).join(' | '));
  await b.close();
})();
