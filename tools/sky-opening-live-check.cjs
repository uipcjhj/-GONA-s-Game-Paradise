/* 정식 게임 흐름에서 새 오프닝 검사 (미리보기 아님)
 *  ① 첫 실행: 관문 터치 → 새 오프닝(하단 대사창) 시작 · 음악 재생 ② 끝까지(출격 시퀀스 자동 · 가족 순서) → 닉네임/타이틀
 *  ③ 로비 설정 → 오프닝 다시보기 → 끝 → 로비 ④ 기존 저장(기록·사진·체크포인트·프로필) 그대로 · 오프닝 본 표시 저장
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-opening-live-check.cjs <url(끝 /)> <outdir> [w] [h]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out, w = '393', h = '636'] = process.argv.slice(2);
const FAM = ['mom', 'dad', 'imo', 'samchon', 'halmeoni', 'halabeoji'];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const res = []; const ok = (n, c, x = '') => res.push(`${c ? 'PASS' : 'FAIL'} · ${n}${x ? ' — ' + x : ''}`);
  const SEED = {
    'gona.skyadv.profiles': JSON.stringify({ v: 1, active: 'p1', list: [{ id: 'p1', nick: '징구', created: '2026-11-20' }] }),
    'gona.skyadv.rec2': JSON.stringify({ v: 2, boards: { 'arcade:normal': [{ score: 1650000, fam: 'samchon', stage: 6, at: '2026-11-26' }] }, daily: {}, col: { clears: { 'mom:normal': 1 }, flags: { nomiss: true }, seen: {}, stages: {} } }),
    'gona.skyadv.story': JSON.stringify({ v: 1, last: 'mom:normal', arcade: {}, cont: {}, slots: { 'mom:normal': { v: 1, fam: 'mom', diff: 'normal', stage: 4, score: 300000, hp: 4, bombs: 2, power: 3, arcade: false, at: '2026-11-27T10:00:00Z' } } }),
  };
  // 1) 첫 실행 (오프닝 본 적 없음)
  const c1 = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await c1.addInitScript((seed) => { if (!sessionStorage.getItem('s')) { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); sessionStorage.setItem('s', '1'); } }, SEED);
  const p = await c1.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(url + '?skytest&firstrun');
  await p.waitForSelector('.gate', { timeout: 60000 });
  await p.tap('.gate');
  const started = await p.waitForSelector('.cp-opening .cp-box', { timeout: 20000 }).then(() => true).catch(() => false);
  await p.waitForFunction(() => window.__cut && window.__cut.st === 'wait', null, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const m0 = await p.evaluate(() => window.__bgmInfo && window.__bgmInfo());
  ok('첫 실행: 관문 터치 → 새 오프닝(하단 대사창) 시작', started);
  ok('오프닝 음악 재생 중', !!m0 && m0.name === 'opening' && m0.running && m0.pos > 0.5, JSON.stringify(m0));
  await p.screenshot({ path: `${out}/1-first.png` });
  // 끝까지: 스토리 구간은 터치, 동기화 구간은 기다림
  for (let g = 0; g < 80; g++) { const c = await p.evaluate(() => window.__cut); if (!c || c.i >= 13) break; if (c.st === 'wait') await p.touchscreen.tap(+w / 2, +h * 0.35); await p.waitForTimeout(250); }
  await p.waitForFunction(() => window.__cut && window.__cut.kind === 'press' && window.__cut.st === 'wait', null, { timeout: 30000 }).catch(() => {});
  const sync = await p.evaluate(() => (window.__syncLog || []).filter((q) => String(q[3]).startsWith('등장:')).map((q) => [q[3].slice(3), +(q[1] - q[2]).toFixed(3)]));
  ok('출격 시퀀스: 가족 순서 · 곡 위치 오차 ≤ 50ms', JSON.stringify(sync.map((q) => q[0])) === JSON.stringify(FAM) && sync.every((q) => Math.abs(q[1]) <= 0.05), sync.map((q) => `${q[0]} ${Math.round(q[1] * 1000)}ms`).join(' · '));
  await p.screenshot({ path: `${out}/2-title.png` });
  await p.touchscreen.tap(+w / 2, +h * 0.35);
  const after = await p.waitForSelector('.ttl-start, .nick-box, .lb2-story', { timeout: 15000 }).then(() => true).catch(() => false);
  await p.waitForTimeout(1500);
  const m1 = await p.evaluate(() => window.__bgmInfo && window.__bgmInfo());
  ok('오프닝 끝 → 타이틀 화면 · 타이틀 곡', after && !!m1 && m1.name === 'title', JSON.stringify(m1));
  const opened = await p.evaluate(() => localStorage.getItem('gona.skyadv.opened'));
  ok('오프닝 본 기록 저장 (다음 접속은 바로 타이틀)', opened === '1');
  const kept = await p.evaluate((keys) => Object.fromEntries(keys.map((k) => [k, localStorage.getItem(k)])), Object.keys(SEED));
  ok('기존 기록·체크포인트·프로필 그대로', JSON.stringify(kept) === JSON.stringify(SEED));
  await p.screenshot({ path: `${out}/3-after.png` });
  // 2) 로비 → 설정 → 오프닝 다시보기 → SKIP → 로비
  await p.goto(url + '?skytest');
  await p.waitForSelector('.ttl-start', { timeout: 60000 }); await p.tap('.ttl-start'); await p.waitForSelector('.lob-story', { timeout: 15000 });
  await p.tap('.lob-gear'); await p.tap('.lob-set button:has-text("오프닝 다시보기")');
  const re = await p.waitForSelector('.cp-opening', { timeout: 15000 }).then(() => true).catch(() => false);
  await p.waitForTimeout(2500);
  const m2 = await p.evaluate(() => window.__bgmInfo && window.__bgmInfo());
  ok('로비 설정 → 오프닝 다시보기 → 새 오프닝 · 음악 처음부터', re && !!m2 && m2.name === 'opening' && m2.pos < 5, JSON.stringify(m2));
  await p.tap('.cp-skip');
  const back = await p.waitForSelector('.lob-story', { timeout: 10000 }).then(() => true).catch(() => false);
  await p.waitForTimeout(1200);
  const m3 = await p.evaluate(() => window.__bgmInfo && window.__bgmInfo());
  ok('SKIP → 로비 복귀 · 오프닝 곡 멈춤', back && !!m3 && m3.name !== 'opening', JSON.stringify(m3));
  ok('콘솔 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log(res.join('\n') + `\n${res.filter((x) => x.startsWith('PASS')).length}/${res.length} PASS`);
  await b.close();
})();
