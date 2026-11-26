/* 온라인 클라이언트 연결 검수 (가짜 Supabase 서버로 요청 가로채기)
 *  ⚠ 실제 서버 검증이 아님 — 게임 쪽 코드가 올바른 요청을 보내고 응답을 올바르게 처리하는지만 확인
 *  가입 → 저장 병합 업로드 → 다른 기기 기록과 병합(합집합) → 플레이 세션 → 점수 제출 → 온라인 랭킹 표시 → 로그아웃
 * 사용: VITE_SUPABASE_URL=https://mock.supabase.test VITE_SUPABASE_ANON_KEY=anon 로 빌드한 판에서
 *       NODE_PATH=$(npm root -g) node tools/sky-online-mock-check.cjs <url(끝 /)> <outdir>
 */
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out] = process.argv.slice(2);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 393, height: 636 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => localStorage.setItem('gona.skyadv.opened', '1'));
  const srv = { save: null, rev: 0, sessions: {}, scores: [], calls: [] };
  // 다른 기기에 이미 있던 클라우드 기록: 할아버지 HARD 보스1 사진 1장
  srv.save = { schema: 3, rec2: { v: 2, boards: {}, daily: {}, col: { clears: {}, flags: { nomiss: true }, seen: {}, stages: { 'halabeoji:hard:1': { rank: 'A', hits: 0, bombs: 0, allParts: true, at: '2026-11-20', score: 90000 } }, counts: {} } }, records: { easy: { score: 0, reach: 1, clear: false }, normal: { score: 0, reach: 2, clear: false }, hard: { score: 50000, reach: 2, clear: false } } };
  srv.rev = 4;
  await ctx.route('https://mock.supabase.test/**', async (route) => {
    const r = route.request();
    const u = new URL(r.url());
    const body = r.postData() ? JSON.parse(r.postData()) : null;
    srv.calls.push(`${r.method()} ${u.pathname}`);
    const ok = (j, s = 200) => route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(j) });
    if (r.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    if (u.pathname === '/auth/v1/signup') return ok({ access_token: 'tok', refresh_token: 'ref', expires_in: 3600, user: { id: 'user-1' } });
    if (u.pathname === '/auth/v1/logout') return ok({});
    if (u.pathname === '/rest/v1/sky_players') return ok([]);
    if (u.pathname === '/rest/v1/sky_saves') return ok(srv.save ? [{ bundle: srv.save, rev: srv.rev }] : []);
    if (u.pathname === '/rest/v1/rpc/sky_save_put') { if (body.p_rev !== srv.rev) return ok(-1); srv.save = body.p_bundle; srv.rev += 1; return ok(srv.rev); }
    if (u.pathname === '/functions/v1/start-play') { const id = `s${Object.keys(srv.sessions).length + 1}`; srv.sessions[id] = body; return ok({ session: id }); }
    if (u.pathname === '/functions/v1/submit-score') { srv.scores.push(body); return ok({ verified: true, board: 'x', place: 3 }); }
    if (u.pathname.startsWith('/rest/v1/sky_leaderboard')) return ok([
      { user_id: 'u9', nickname: '챔피언', fam: 'dad', diff: 'normal', stage: 6, score: 2100000, rank: 'S', time_s: 1300, created_at: '2026-11-25T10:00:00Z' },
      { user_id: 'u8', nickname: '두번째', fam: 'mom', diff: 'normal', stage: 6, score: 1800000, rank: 'A', time_s: 1400, created_at: '2026-11-24T10:00:00Z' },
      { user_id: 'user-1', nickname: '검수', fam: 'imo', diff: 'normal', stage: 1, score: 120000, rank: 'B', time_s: 140, created_at: '2026-11-26T10:00:00Z' },
    ]);
    return ok({ error: 'unhandled' }, 404);
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const res = [];
  const chk = (n, c, x = '') => res.push(`${c ? 'PASS' : 'FAIL'} · ${n}${x ? ' — ' + x : ''}`);
  // 이 기기 기록: 엄마 EASY 보스1 사진
  await p.goto(url + '?skytest&firstrun');
  await p.waitForSelector('.gate', { timeout: 60000 });
  await p.tap('.gate');
  await p.waitForSelector('.nick-box', { timeout: 30000 });
  await p.fill('.nick-box input', '검수');
  await p.tap('.nick-box .sky-btn-go');
  await p.waitForTimeout(500);
  await p.evaluate(() => localStorage.setItem('gona.skyadv.rec2', JSON.stringify({ v: 2, boards: {}, daily: {}, col: { clears: {}, flags: {}, seen: {}, stages: { 'mom:easy:1': { rank: 'B', hits: 2, bombs: 1, allParts: false, at: '2026-11-26', score: 40000 } }, counts: {} } })));
  await p.goto(url + '?skytest');
  await p.waitForSelector('.ttl-start');
  await p.tap('.ttl2-nick');
  await p.waitForSelector('.prof-box');
  await p.fill('.prof-in[type=email]', 'qa@example.com');
  await p.fill('.prof-in[type=password]', 'secret123');
  await p.tap('.prof-box button:has-text("가입")');
  await p.waitForSelector('.prof-toast');
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/1-account.png` });
  const toast = await p.$eval('.prof-toast', (e) => e.innerText);
  chk('가입 → 자동 동기화 완료 메시지', toast.includes('가입 완료'), toast);
  const loc = await p.evaluate(() => JSON.parse(localStorage.getItem('gona.skyadv.rec2')).col.stages);
  chk('병합: 기기 사진 + 클라우드 사진 합집합', !!loc['mom:easy:1'] && !!loc['halabeoji:hard:1'], Object.keys(loc).join(','));
  chk('업로드: rev 4 → 5 · 서버 저장에도 두 사진', srv.rev === 5 && !!srv.save.rec2.col.stages['mom:easy:1'] && !!srv.save.rec2.col.stages['halabeoji:hard:1']);
  chk('처음 로그인 전 기기 기록 백업 보관', await p.evaluate(() => !!localStorage.getItem('gona.skyadv.backup.prelogin')));
  const recs = await p.evaluate(() => JSON.parse(localStorage.getItem('gona.skyadv.records') || 'null'));
  chk('스토리 도달 기록: 더 좋은 쪽 (HARD reach 2)', recs && recs.hard.reach === 2, JSON.stringify(recs?.hard));
  await p.tap('.prof-box .sky-btn-go:has-text("닫기")');
  // 플레이 → 세션 → 보스 격파 (MEMORY HUNT STAGE 1) → 제출
  await p.tap('.ttl2-hunt');
  await p.waitForSelector('.hunt-grid');
  await p.tap('.hunt-card:nth-child(1)');
  await p.waitForSelector('.sel-main');
  await p.tap('text=출격!');
  await p.waitForFunction(() => window.__sky && document.querySelector('.sky-canvas'), null, { timeout: 30000 });
  await p.evaluate(() => { const s = window.__sky; s.cheat('god'); s.cheat('boss'); });
  for (let i = 0; i < 80; i++) { if (await p.$('.sky-talk')) await p.tap('.sky-talk', { position: { x: 20, y: 20 } }).catch(() => {}); if (await p.evaluate(() => window.__sky.bs && window.__sky.bs.mode !== 'enter' && !window.__sky.talking)) break; await p.waitForTimeout(150); }
  await p.evaluate(() => { const s = window.__sky; s.boss.hp = 1; s.damage(s.boss, 99, 'shot', s.boss.x, s.boss.y); });
  for (let i = 0; i < 120 && !(await p.$('.res')); i++) { if (await p.$('.sky-talk')) await p.tap('.sky-talk', { position: { x: 20, y: 20 } }).catch(() => {}); await p.waitForTimeout(150); }
  await p.waitForSelector('.res', { timeout: 10000 });
  await p.waitForTimeout(1500);
  chk('출격 시 서버 플레이 세션 요청 (hunt · stage 1)', Object.values(srv.sessions).some((s) => s.mode === 'hunt' && s.stage === 1));
  const sub = srv.scores[0];
  chk('격파 후 점수 제출: 스테이지 보고 1개 · 합계', sub && sub.stages.length === 1 && sub.stages[0].stage === 1 && sub.total > 0, sub ? `total ${sub.total} rank ${sub.stages[0].rank}` : '없음');
  const ol = await p.$eval('.res-new.online', (e) => e.innerText).catch(() => '');
  chk('결과 화면에 온라인 순위', ol.includes('3위'), ol);
  await p.screenshot({ path: `${out}/2-result.png` });
  // 온라인 랭킹 화면
  await p.goto(url + '?skytest');
  await p.waitForSelector('.ttl-start');
  await p.tap('text=랭킹');
  await p.tap('.recs-tabs button:has-text("온라인")');
  await p.waitForSelector('.ol-list li');
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/3-ranking.png` });
  const rows = await p.$$eval('.ol-list li', (e) => e.map((x) => x.className + ':' + x.innerText.replace(/\s+/g, ' ')));
  chk('온라인 TOP 표시 · 메달 · 내 기록 강조', rows.length === 3 && rows[0].includes('🥇') && rows[2].includes('me'), rows.join(' | '));
  console.log(res.join('\n') + `\n서버 호출: ${[...new Set(srv.calls)].join(', ')}\n오류 ${errs.length} ${errs.slice(0, 2).join(' | ')}`);
  await b.close();
})();
