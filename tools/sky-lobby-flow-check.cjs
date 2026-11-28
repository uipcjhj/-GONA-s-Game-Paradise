/* 타이틀 → 로비 흐름 검수: 첫 방문(관문→오프닝→닉네임→타이틀→PRESS START→로비) · 재방문 · STORY/HUNT 진입
 *  · 보스 격파 → 결과 → 로비 복귀 → 새 사진 알림 · 미션 갱신 · 알림 확인 후 사라짐(사진은 그대로) · 하단 내비 · 콘솔 오류
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-lobby-flow-check.cjs <url(끝 /)> <outdir> [w] [h]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out, w = '393', h = '636'] = process.argv.slice(2);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [], bad = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  p.on('response', (r) => r.status() >= 400 && bad.push(`${r.status()} ${r.url()}`));
  const res = [];
  const ok = (n, c, x = '') => res.push(`${c ? 'PASS' : 'FAIL'} · ${n}${x ? ' — ' + x : ''}`);
  // 1) 첫 방문
  await p.goto(url + '?skytest&firstrun');
  await p.waitForSelector('.gate', { timeout: 60000 });
  await p.tap('.gate');
  await p.waitForSelector('.oc-skip, .cp-skip', { timeout: 30000 });
  await p.waitForTimeout(1500);
  await p.tap('.oc-skip, .cp-skip');
  const nick = await p.waitForSelector('.nick-box', { timeout: 15000 }).then(() => true).catch(() => false);
  ok('첫 방문: 관문 → 오프닝 → (SKIP) → 닉네임', nick);
  await p.fill('.nick-box input', '흐름검수');
  await p.tap('.nick-box .sky-btn-go');
  await p.waitForTimeout(600);
  const tBtns = await p.$$eval('.ttl2 button', (e) => e.map((x) => x.innerText.trim()).filter(Boolean));
  ok('타이틀: 버튼은 PRESS START 하나', tBtns.length === 1 && /PRESS START/.test(tBtns[0]), tBtns.join(' | '));
  await p.screenshot({ path: `${out}/1-title.png` });
  await p.tap('.ttl-start');
  ok('PRESS START → 메인 로비', !!(await p.waitForSelector('.lob-story', { timeout: 10000 }).catch(() => null)));
  const nickShown = await p.$eval('.lob-prof b', (e) => e.innerText);
  ok('로비 프로필: 닉네임', nickShown === '흐름검수', nickShown);
  const ov = await p.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
  ok('로비 가로 넘침 없음', ov <= 0, `${ov}px`);
  // 하단 내비 → 앨범 · 랭킹 · 홈
  await p.tap('.lob-nav button:nth-child(2)'); const alb = !!(await p.waitForSelector('.album', { timeout: 5000 }).catch(() => null));
  await p.tap('.lob-nav button:nth-child(3)'); const rk = !!(await p.waitForSelector('.recs', { timeout: 5000 }).catch(() => null));
  await p.tap('.recs-tabs button:has-text("온라인")'); await p.waitForTimeout(300);
  const olMsg = await p.$eval('.ol-msg', (e) => e.innerText).catch(() => '');
  await p.tap('.lob-nav button:nth-child(1)'); const hm = !!(await p.waitForSelector('.lob-story', { timeout: 5000 }).catch(() => null));
  ok('하단 내비: 추억앨범 · 랭킹 · 홈', alb && rk && hm);
  ok('온라인 랭킹: 서버 없으면 "연결 준비 중"', /연결 준비 중/.test(olMsg), olMsg.split('\n')[0]);
  // 2) STORY: 로비 → 동료/난이도 선택 → 출격 → 보스 격파 → 결과 → 로비
  await p.tap('.lob-story');
  ok('STORY MODE → 동료·난이도 선택', !!(await p.waitForSelector('.sel-main', { timeout: 10000 }).catch(() => null)));
  await p.tap('text=출격!');
  await p.waitForFunction(() => window.__sky && document.querySelector('.sky-canvas'), null, { timeout: 30000 });
  await p.evaluate(() => { const s = window.__sky; s.cheat('god'); s.cheat('boss'); });
  for (let i = 0; i < 80; i++) { if (await p.$('.sky-talk')) await p.tap('.sky-talk', { position: { x: 20, y: 20 } }).catch(() => {}); if (await p.evaluate(() => window.__sky.bs && window.__sky.bs.mode !== 'enter' && !window.__sky.talking)) break; await p.waitForTimeout(150); }
  await p.evaluate(() => { const s = window.__sky; s.boss.hp = 1; s.damage(s.boss, 99, 'shot', s.boss.x, s.boss.y); });
  for (let i = 0; i < 140 && !(await p.$('.res')); i++) { if (await p.$('.sky-talk')) await p.tap('.sky-talk', { position: { x: 20, y: 20 } }).catch(() => {}); await p.waitForTimeout(150); }
  const resOk = !!(await p.waitForSelector('.res', { timeout: 10000 }).catch(() => null));
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/2-result.png` });
  const lobBtn = await p.$('.res button:has-text("로비로")');
  ok('보스 격파 → 결과 화면 · "로비로" 버튼', resOk && !!lobBtn);
  if (lobBtn) await lobBtn.tap();
  const back = !!(await p.waitForSelector('.lob-story', { timeout: 10000 }).catch(() => null));
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/3-lobby-after.png` });
  const dot = await p.$eval('.lb2-new b', (e) => +e.innerText).catch(() => 0);
  const rate = await p.$eval('.lb2-chip', (e) => e.innerText.replace(/\s/g, '')).catch(() => '');
  ok('결과 → 로비 복귀 · 새 보상 알림 (NEW n)', back && dot > 0, `알림 ${dot}`);
  ok('로비 추억사진 수 갱신', /1$/.test(rate), rate);
  const albDot = !!(await p.$('.lob-nav .lob-ndot'));
  ok('하단 내비 추억앨범에 알림 점', albDot);
  // 보상 카드 확인 → 앨범 → 홈: 알림 사라짐 · 사진은 그대로
  await p.tap('.lb2-new'); await p.waitForSelector('.album');
  await p.tap('.lob-nav button:nth-child(1)'); await p.waitForSelector('.lob-story');
  const dot2 = await p.$('.lb2-new');
  const keep = await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('gona.skyadv.rec2')).col.stages || {}).length);
  ok('보상 확인 후 알림 사라짐 · 사진 기록은 유지', !dot2 && keep === 1, `사진 ${keep}장`);
  // 3) MEMORY HUNT: 로비 → 스테이지 선택 → 동료 선택
  await p.tap('.lob-hunt'); const hg = !!(await p.waitForSelector('.hunt-grid', { timeout: 5000 }).catch(() => null));
  await p.tap('.hunt-card:nth-child(1)'); const hs = !!(await p.waitForSelector('.sel-main', { timeout: 5000 }).catch(() => null));
  ok('MEMORY HUNT → 스테이지 선택 → 동료 선택', hg && hs);
  // 4) 재방문: 관문 → 타이틀(오프닝 없음) → 로비
  await p.goto(url + '?gate');
  await p.waitForSelector('.gate', { timeout: 30000 });
  await p.tap('.gate');
  const t2 = await p.waitForSelector('.ttl-start', { timeout: 15000 }).then(() => true).catch(() => false);
  const noOc = !(await p.$('.oc-skip, .cp-skip'));
  await p.tap('.ttl-start');
  const l2 = !!(await p.waitForSelector('.lob-story', { timeout: 10000 }).catch(() => null));
  ok('재방문: 관문 → 타이틀(오프닝 없음) → 로비', t2 && noOc && l2);
  // 5) 설정 → 오프닝 다시보기 → SKIP → 로비로 복귀
  await p.tap('.lob-gear'); await p.tap('.lob-set button:has-text("오프닝 다시보기")');
  await p.waitForSelector('.oc-skip, .cp-skip', { timeout: 15000 }); await p.waitForTimeout(800); await p.tap('.oc-skip, .cp-skip');
  ok('설정 → 오프닝 다시보기 → SKIP → 로비', !!(await p.waitForSelector('.lob-story', { timeout: 10000 }).catch(() => null)));
  ok('콘솔 오류 · 실패 요청 없음', errs.length === 0 && bad.length === 0, [...errs, ...bad].slice(0, 2).join(' | '));
  console.log(res.join('\n'));
  await b.close();
})();
