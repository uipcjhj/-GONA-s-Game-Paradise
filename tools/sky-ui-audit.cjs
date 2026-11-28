/* 전 화면 글자·버튼 자동 검사 (현재 UI vs ?ui=2)
 *  화면마다 보이는 버튼/탭/칩 전부: 의도치 않은 줄바꿈 · 글자 넘침 · 글자 세로 중심 vs '보이는 면' 중심(아래 3D 띠 제외) · 11px 미만 글씨 · 화면 밖
 *  + 화면 캡처
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-ui-audit.cjs <url(끝 /)> <outdir> <old|ui2> [w] [h] [play=1]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out, mode = 'ui2', w = '393', h = '636', PLAY = '1'] = process.argv.slice(2);
const Q = mode === 'ui2' ? '&ui=2' : '';
const AUDIT = () => {
  const sel = 'button, .sky-btn, a.sky-btn';
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 4 && r.height > 4 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05 && r.bottom > 0 && r.top < innerHeight; };
  const issues = [];
  let n = 0;
  for (const e of document.querySelectorAll(sel)) {
    if (!vis(e)) continue;
    // 덮개(모달) 뒤에 가려진 버튼은 제외
    const r = e.getBoundingClientRect();
    const top = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2)));
    if (top && !e.contains(top) && !top.contains(e)) continue;
    const text = (e.innerText || '').trim().replace(/\s+/g, ' ');
    if (!text) continue;
    n++;
    const cs = getComputedStyle(e);
    const label = `${e.className.toString().split(' ')[0] || e.tagName.toLowerCase()}「${text.slice(0, 18)}」`;
    const multi = !!e.querySelector('small, br, b, em, img') || e.matches('.lob-nav button, .sel-roster button, .sel-fresh, .lb2-story, .lb2-mode, .hunt-card, .bd-cell, .lb2-go');
    const fs_ = parseFloat(cs.fontSize);
    if (fs_ < 10.9 && !e.matches('.ol-fams button, .os-ctl button')) issues.push(`작은 글씨 ${fs_}px ${label}`);
    if (e.scrollWidth > e.clientWidth + 1 && cs.overflow !== 'visible') issues.push(`넘침 ${label}`);
    if (r.right > innerWidth + 1 || r.left < -1) issues.push(`화면 밖 ${label}`);
    // 텍스트 줄 수 · 글자 영역
    const rg = document.createRange(); rg.selectNodeContents(e);
    const rects = [...rg.getClientRects()].filter((q) => q.width > 1 && q.height > 4);
    if (!rects.length) continue;
    const tops = [...new Set(rects.map((q) => Math.round(q.top / 4)))];
    if (!multi && tops.length > 1) issues.push(`줄바꿈 ${label}`);
    if (multi) continue;
    const ty = (Math.min(...rects.map((q) => q.top)) + Math.max(...rects.map((q) => q.bottom))) / 2;
    const bt = parseFloat(cs.borderTopWidth), bb = parseFloat(cs.borderBottomWidth);
    const m = /inset\s+0px\s+-(\d+(?:\.\d+)?)px/.exec(cs.boxShadow) || /-(\d+(?:\.\d+)?)px[^,]*inset/.exec(cs.boxShadow);
    const band = m ? parseFloat(m[1]) : 0;
    const face = (r.top + bt + (r.bottom - bb - band)) / 2;
    const off = ty - face;
    if (Math.abs(off) > 1.6) issues.push(`글자 ${off > 0 ? '아래' : '위'} ${off.toFixed(1)}px ${label}`);
  }
  return { n, issues, scrollY: document.scrollingElement.scrollHeight - innerHeight };
};
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => {
    localStorage.setItem('gona.skyadv.opened', '1'); localStorage.setItem('gona.skyadv.guide', '1');
    if (localStorage.getItem('qa.s')) return; localStorage.setItem('qa.s', '1');
    localStorage.setItem('gona.skyadv.profiles', JSON.stringify({ v: 1, active: 'p1', list: [{ id: 'p1', nick: '징구', created: '2026-11-20' }] }));
    localStorage.setItem('gona.skyadv.rec2', JSON.stringify({ v: 2, boards: { 'arcade:normal': [{ score: 1650000, fam: 'samchon', stage: 6, at: '2026-11-26', time: 1400, nick: '징구' }], 'stage:1:normal': [{ score: 60000, rank: 'A', fam: 'mom', stage: 1, at: '2026-11-25', time: 120 }] }, daily: {}, col: { clears: {}, flags: { nomiss: true }, seen: {}, stages: { 'imo:normal:3': { rank: 'S', hits: 0, bombs: 0, allParts: true, at: '2026-11-26', score: 90000 } } } }));
    localStorage.setItem('gona.skyadv.story', JSON.stringify({ v: 1, last: 'halabeoji:hard', arcade: {}, cont: {}, slots: { 'halabeoji:hard': { v: 1, fam: 'halabeoji', diff: 'hard', stage: 5, score: 512000, hp: 4, bombs: 2, power: 3, arcade: false, at: new Date().toISOString() } } }));
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const report = [];
  const tag = `${mode}-${w}x${h}`;
  let k = 0;
  const shot = async (name) => {
    await p.waitForTimeout(450);
    const a = await p.evaluate(AUDIT);
    report.push({ screen: name, buttons: a.n, issues: a.issues, pageScroll: a.scrollY });
    await p.screenshot({ path: `${out}/${tag}-${String(++k).padStart(2, '0')}-${name}.png` });
  };
  const home = async () => { await p.goto(url + '?skytest' + Q); await p.waitForSelector('.ttl-start', { timeout: 60000 }); };
  const lobby = async () => { await home(); await p.tap('.ttl-start'); await p.waitForSelector('.lb2-story', { timeout: 15000 }); };
  const T = async (s) => { await p.tap(s); };
  await home(); await shot('title');
  await p.tap('.ttl-start'); await p.waitForSelector('.lb2-story'); await shot('lobby');
  await T('.lob-gear'); await p.waitForSelector('.lob-set'); await shot('settings');
  await p.tap('.lob-set .sky-btn-go'); await T('.lob-prof'); await p.waitForSelector('.prof-box'); await shot('profile');
  await p.tap('.prof-box .sky-btn-go:has-text("닫기")');
  await T('.lb2-pick'); await p.waitForSelector('.sel-main'); await shot('select-new');
  await p.tap('.sel-roster li:nth-child(5) button'); const bs = await p.$$('.sel-opts button'); await bs[2].tap(); await shot('select-continue');
  await lobby(); await T('.lob-hunt'); await p.waitForSelector('.hunt-grid'); await shot('memory-hunt');
  await lobby(); await T('.lb2-daily'); await p.waitForTimeout(400); await shot('daily');
  await lobby(); await T('.lob-nav button:nth-child(2)'); await p.waitForSelector('.album');
  const at = await p.$$('.album .recs-tabs button');
  for (let i = 0; i < at.length; i++) { await at[i].tap(); await shot(`album-${i + 1}`); }
  await p.tap('.bd-cell'); await p.waitForSelector('.bd-zoom').catch(() => {}); await shot('badge-zoom'); await p.tap('.bd-view').catch(() => {});
  await lobby(); await T('.lob-nav button:nth-child(3)'); await p.waitForSelector('.recs');
  const rt = mode === 'ui2' ? '.rk2-tabs button' : '.recs-tabs button';
  const tabs = await p.$$(rt);
  for (let i = 0; i < tabs.length; i++) { const t2 = await p.$$(rt); await t2[i].tap(); await shot(`ranking-${i + 1}`); }
  if (mode !== 'ui2') { const rk = await p.$$('.run-kinds button'); if (rk.length) { /* 예전 화면: 온라인 탭 확인됨 */ } }
  await p.goto(url + '?preview' + Q); await p.waitForSelector('.pv-box'); await shot('preview-menu');
  if (PLAY === '1') {
    await home();
    await p.evaluate(() => window.__skyFlow.start(1, 'normal'));
    await p.waitForFunction(() => window.__sky && document.querySelector('.sky-canvas'), null, { timeout: 30000 });
    await p.waitForTimeout(3500); await shot('play-hud');
    await p.tap('.sky-pause'); await p.waitForSelector('.sky-panel'); await shot('pause');
    await p.tap('.sky-panel .sky-btn-go');
    await p.evaluate(() => { const s = window.__sky; s.cheat('god'); s.cheat('boss'); });
    for (let i = 0; i < 100; i++) { if (await p.$('.sky-talk')) await p.tap('.sky-talk', { position: { x: 20, y: 20 } }).catch(() => {}); if (await p.evaluate(() => window.__sky.bs && window.__sky.bs.mode !== 'enter' && !window.__sky.talking)) break; await p.waitForTimeout(150); }
    await p.evaluate(() => { const s = window.__sky; s.boss.hp = 1; s.damage(s.boss, 99, 'shot', s.boss.x, s.boss.y); });
    for (let i = 0; i < 160 && !(await p.$('.res')); i++) { if (await p.$('.sky-talk')) await p.tap('.sky-talk', { position: { x: 20, y: 20 } }).catch(() => {}); await p.waitForTimeout(150); }
    await p.waitForSelector('.res', { timeout: 10000 }); await p.waitForTimeout(2500); await shot('stage-clear-result');
    await p.evaluate(() => window.__skyFlow.nextStage());
    await p.waitForFunction(() => window.__sky && !document.querySelector('.res'), null, { timeout: 30000 });
    await p.waitForTimeout(1500);
    await p.evaluate(() => { const s = window.__sky; s.cheat('hp1'); s.cheat('hurt'); }); await p.waitForSelector('.cont', { timeout: 15000 }); await shot('game-over-continue');
  }
  const total = report.reduce((a, r) => a + r.issues.length, 0);
  fs.writeFileSync(`${out}/${tag}-report.json`, JSON.stringify(report, null, 1));
  console.log(`${tag}: 화면 ${report.length} · 버튼 ${report.reduce((a, r) => a + r.buttons, 0)} · 문제 ${total} · 오류 ${errs.length}`);
  for (const r of report) if (r.issues.length) console.log(`  [${r.screen}] ${r.issues.slice(0, 6).join(' | ')}${r.issues.length > 6 ? ` …+${r.issues.length - 6}` : ''}`);
  await b.close();
})();
