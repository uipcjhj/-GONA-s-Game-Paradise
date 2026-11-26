/* 스토리 체크포인트 · CONTINUE/ARCADE 검수 (데스크톱 에뮬레이션)
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-story-save-check.cjs <url(끝 /)> <outdir> [w] [h] [arcade=1]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out, w = '393', h = '636', ARC = '1'] = process.argv.slice(2);
const FAMI = ['mom', 'dad', 'imo', 'halmeoni', 'halabeoji', 'samchon'];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => {
    localStorage.setItem('gona.skyadv.opened', '1'); localStorage.setItem('gona.skyadv.guide', '1');
    if (localStorage.getItem('qa.seeded')) return;
    localStorage.setItem('qa.seeded', '1');
    localStorage.setItem('gona.skyadv.profiles', JSON.stringify({ v: 1, active: 'p1', list: [{ id: 'p1', nick: '저장검수', created: '2026-11-20' }] }));
    // 기존 사용자: 사진 1장 · 엽서 1장 · 예전 전체 런 기록 (마이그레이션 보호 확인용)
    localStorage.setItem('gona.skyadv.rec2', JSON.stringify({ v: 2, boards: { 'run:hard': [{ score: 777000, fam: 'dad', stage: 6, at: '2026-11-10', time: 1500 }] }, daily: {}, col: { clears: { 'dad:hard': { at: '2026-11-10', score: 777000 } }, flags: {}, seen: {}, stages: { 'dad:hard:1': { rank: 'A', hits: 0, bombs: 0, allParts: true, at: '2026-11-10', score: 50000 } } } }));
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const res = [];
  const ok = (n, c, x = '') => { res.push(`${c ? 'PASS' : 'FAIL'} · ${n}${x ? ' — ' + x : ''}`); console.log(res[res.length - 1]); };
  const story = () => p.evaluate(() => JSON.parse(localStorage.getItem('gona.skyadv.story') || 'null'));
  const rec2 = () => p.evaluate(() => JSON.parse(localStorage.getItem('gona.skyadv.rec2')));
  const talk = async () => { if (await p.$('.sky-talk')) await p.tap('.sky-talk', { position: { x: 20, y: 20 } }).catch(() => {}); };
  const waitPlay = () => p.waitForFunction(() => window.__sky && document.querySelector('.sky-canvas') && !document.querySelector('.res'), null, { timeout: 30000 });
  const clearStage = async () => {
    await waitPlay();
    await p.evaluate(() => { const s = window.__sky; s.cheat('god'); s.cheat('boss'); });
    for (let i = 0; i < 100; i++) { await talk(); if (await p.evaluate(() => window.__sky.bs && window.__sky.bs.mode !== 'enter' && !window.__sky.talking)) break; await p.waitForTimeout(150); }
    await p.evaluate(() => { const s = window.__sky; s.boss.hp = 1; s.damage(s.boss, 99, 'shot', s.boss.x, s.boss.y); });
    for (let i = 0; i < 160 && !(await p.$('.res')); i++) { await talk(); await p.waitForTimeout(150); }
    await p.waitForSelector('.res', { timeout: 10000 }); await p.waitForTimeout(600);
    return p.evaluate(() => ({ stage: window.__sky.stageNo ?? null, ck: document.querySelector('.res-ck')?.innerText ?? '' }));
  };
  const gameOver = async () => { await waitPlay(); await p.evaluate(() => { const s = window.__sky; s.cheat('hp1'); s.cheat('hurt'); }); await p.waitForSelector('.cont', { timeout: 15000 }); };
  const toLobby = async () => { await p.goto(url + '?skytest'); await p.waitForSelector('.ttl-start', { timeout: 60000 }); await p.tap('.ttl-start'); await p.waitForSelector('.lb2-story'); };
  const pickSel = async (fam, d) => {
    await p.tap(`.sel-roster li:nth-child(${FAMI.indexOf(fam) + 1}) button`);
    await p.tap(`.sel-opts button:has-text("${{ easy: '쉬움', normal: '보통', hard: '어려움' }[d]}")`).catch(async () => { const bs = await p.$$('.sel-opts button'); await bs[['easy', 'normal', 'hard'].indexOf(d)].tap(); });
    await p.waitForTimeout(200);
  };
  // 1) 할아버지 HARD 새 모험 → STAGE 1 클리어 → 체크포인트 STAGE 2 (ARCADE 진행)
  await toLobby();
  await p.tap('.lb2-pick'); await p.waitForSelector('.sel-main');
  await pickSel('halabeoji', 'hard');
  ok('저장 없는 조합: 새 모험 · ARCADE 표시 · 출격만', !!(await p.$('.sel-ckinfo.new')) && !(await p.$('.sel-resume')));
  await p.tap('.sel-btns .sky-btn-go');
  const c1 = await clearStage();
  await p.screenshot({ path: `${out}/1-checkpoint-result.png` });
  let st = await story();
  ok('STAGE 1 클리어 → 체크포인트 STAGE 2 저장 (ARCADE 진행 중)', st?.slots?.['halabeoji:hard']?.stage === 2 && st.slots['halabeoji:hard'].arcade === true && /STAGE 2/.test(c1.ck), c1.ck);
  const sl2 = st.slots['halabeoji:hard'];
  ok('저장 내용: 동료·난이도·다음 스테이지·점수·체력·폭탄·무기·시각·버전', ['fam', 'diff', 'stage', 'score', 'hp', 'bombs', 'power', 'at', 'v'].every((k) => sl2[k] != null), JSON.stringify(sl2));
  const ph1 = Object.keys((await rec2()).col.stages).length;
  // 2) 새로고침(앱 종료) → 로비 '모험 계속하기' · 선택 화면 표시
  await toLobby();
  const card = await p.$eval('.lb2-story', (e) => e.innerText.replace(/\s+/g, ' '));
  ok('새로고침 후 로비: 할아버지 · HARD · STAGE 2 · 모험 계속하기', /할아버지 · HARD · STAGE 2/.test(card) && /모험 계속하기/.test(card), card);
  await p.screenshot({ path: `${out}/2-lobby-continue.png` });
  await p.tap('.lb2-pick'); await p.waitForSelector('.sel-main'); await pickSel('halabeoji', 'hard');
  const selTxt = await p.$eval('.sel-btns', (e) => e.innerText.replace(/\s+/g, ' '));
  const famBadge = await p.$eval('.sel-roster li:nth-child(5) .sel-ck', (e) => e.innerText).catch(() => '');
  ok('선택 화면: 이어하기 강조 + 처음부터(보조) · 동료 칸 S2 표시', /STAGE 2부터 이어하기/.test(selTxt) && /STAGE 1부터 새로 시작/.test(selTxt) && famBadge === 'S2', selTxt);
  await p.screenshot({ path: `${out}/3-select-continue.png` });
  await pickSel('halabeoji', 'easy');
  ok('HARD 진행 중 EASY 선택: 저장 없음 → 새 모험', !!(await p.$('.sel-ckinfo.new')));
  await pickSel('halabeoji', 'hard');
  // 3) 이어하기 → STAGE 2 · 점수·장비 = 저장값 (복제 없음) → 게임 오버 → 이어하기 안내 → 다시 STAGE 2 저장값
  await p.tap('.sel-resume');
  await waitPlay();
  const run2 = await p.evaluate(() => ({ score: window.__sky.score, hp: window.__sky.hp, bombs: window.__sky.bombs, power: window.__sky.power }));
  ok('이어하기 = STAGE 2 시작 · 점수·체력·폭탄·무기 = 저장값', run2.score === sl2.score && run2.hp === sl2.hp && run2.bombs === sl2.bombs && run2.power === sl2.power, JSON.stringify(run2));
  await gameOver();
  const contTxt = await p.$eval('.cont', (e) => e.innerText.replace(/\s+/g, ' '));
  ok('게임 오버: "STAGE 2부터 이어하기 가능" 안내', /STAGE 2부터 이어하기 가능/.test(contTxt), contTxt.slice(0, 90));
  await p.screenshot({ path: `${out}/4-gameover.png` });
  await p.tap('.cont .sky-btn-go');
  await waitPlay();
  const run3 = await p.evaluate(() => ({ score: window.__sky.score }));
  ok('게임 오버 후 이어하기 = 저장된 STAGE 2 지점 (점수 복제 없음)', run3.score === sl2.score, `${run3.score}`);
  const c2 = await clearStage();
  st = await story();
  ok('STAGE 2 클리어 → STAGE 3 저장 · CONTINUE 로 바뀜', st.slots['halabeoji:hard'].stage === 3 && st.slots['halabeoji:hard'].arcade === false && !/ARCADE/.test(c2.ck), c2.ck);
  // 4) 같은 스테이지 반복 클리어: 사진 1장만
  const r2 = await rec2();
  ok('사진 중복 없음 (할아버지 HARD 1·2 각 1장 · 기존 1장 유지)', Object.keys(r2.col.stages).length === ph1 + 1 && !!r2.col.stages['dad:hard:1'], Object.keys(r2.col.stages).join(','));
  // 5) 다른 동료 · MEMORY HUNT · 프로필 분리
  await toLobby(); await p.tap('.lb2-pick'); await p.waitForSelector('.sel-main'); await pickSel('mom', 'easy');
  await p.tap('.sel-btns .sky-btn-go'); await clearStage();
  st = await story();
  ok('다른 동료(엄마 EASY) 저장 분리 · 할아버지 HARD 그대로', st.slots['mom:easy'].stage === 2 && st.slots['halabeoji:hard'].stage === 3);
  await toLobby(); await p.tap('.lob-hunt'); await p.waitForSelector('.hunt-grid'); await p.tap('.hunt-card:nth-child(1)'); await p.waitForSelector('.sel-main');
  ok('MEMORY HUNT 선택 화면엔 이어하기 없음', !(await p.$('.sel-resume')));
  await p.tap('.sel-btns .sky-btn-go'); await clearStage();
  const st2 = await story();
  ok('MEMORY HUNT 클리어 → 스토리 저장 변화 없음', JSON.stringify(st2.slots) === JSON.stringify(st.slots));
  await p.evaluate(() => { const k = 'gona.skyadv.profiles'; const s = JSON.parse(localStorage.getItem(k)); s.list.push({ id: 'p2', nick: '둘째', created: '2026-11-26' }); s.active = 'p2'; localStorage.setItem(k, JSON.stringify(s)); });
  await toLobby();
  ok('다른 모험가 프로필: 저장 없음 (로비 출격)', !/모험 계속하기/.test(await p.$eval('.lb2-story', (e) => e.innerText)));
  await p.evaluate(() => { const k = 'gona.skyadv.profiles'; const s = JSON.parse(localStorage.getItem(k)); s.active = 'p1'; localStorage.setItem(k, JSON.stringify(s)); });
  await toLobby();
  ok('원래 프로필로 돌아오면 저장 그대로', /모험 계속하기/.test(await p.$eval('.lb2-story', (e) => e.innerText)));
  // 6) 저장 데이터 깨짐 → 백업 복구
  await p.evaluate(() => localStorage.setItem('gona.skyadv.story', '{broken'));
  await toLobby();
  st = await story();
  ok('깨진 저장 → 백업으로 복구(최신 진행 그대로) · 깨진 원본 보관', st?.slots?.['mom:easy']?.stage === 2 && st?.slots?.['halabeoji:hard']?.stage === 3 && await p.evaluate(() => !!localStorage.getItem('gona.skyadv.story.broken')), Object.keys(st?.slots ?? {}).join(','));
  // 7) CONTINUE CLEAR: STAGE 6 체크포인트에서 이어 완주 → 엽서 · CONTINUE 보드 · ARCADE 아님
  await p.evaluate(() => { const k = 'gona.skyadv.story'; const s = JSON.parse(localStorage.getItem(k)); s.slots['halabeoji:hard'] = { ...s.slots['halabeoji:hard'], stage: 6, arcade: false }; s.last = 'halabeoji:hard'; localStorage.setItem(k, JSON.stringify(s)); });
  await toLobby(); await p.tap('.lb2-story');
  await clearStage();
  const ckF = await p.$eval('.res-ck', (e) => e.innerText).catch(() => '');
  await p.screenshot({ path: `${out}/5-continue-clear.png` });
  const fin = await p.$('.res button:has-text("엔딩으로")'); if (fin) await fin.tap();
  await p.waitForTimeout(800);
  const r3 = await rec2(); st = await story();
  ok('CONTINUE CLEAR: 표시 · 엽서(할아버지 HARD) · CONTINUE 보드 · ARCADE 보드 없음 · 칸 비움', /CONTINUE CLEAR/.test(ckF) && !!r3.col.clears['halabeoji:hard'] && (r3.boards['cont:hard'] ?? []).length === 1 && !(r3.boards['arcade:hard'] ?? []).length && !st.slots['halabeoji:hard'] && !!st.cont['halabeoji:hard'], ckF);
  ok('예전 전체 런 기록 · 기존 엽서 보존 (ARCADE 로 분류 안 함)', (r3.boards['run:hard'] ?? []).length === 1 && !!r3.col.clears['dad:hard']);
  // 8) ARCADE 실패 → ARCADE 기록 없음
  await toLobby(); await p.tap('.lb2-pick'); await p.waitForSelector('.sel-main'); await pickSel('imo', 'normal');
  await p.tap('.sel-btns .sky-btn-go'); await gameOver();
  const arcTxt = await p.$eval('.cont', (e) => e.innerText);
  await p.tap('.cont .sky-btn:not(.sky-btn-go)'); await p.waitForTimeout(500);
  const r4 = await rec2();
  ok('ARCADE 실패(그만하기) → "연속 도전 종료" · ARCADE 보드 기록 없음', /ARCADE 연속 도전 종료/.test(arcTxt) && !(r4.boards['arcade:normal'] ?? []).length);
  // 9) ARCADE CLEAR: STAGE 1~6 끊김 없이
  if (ARC === '1') {
    await toLobby(); await p.tap('.lb2-pick'); await p.waitForSelector('.sel-main'); await pickSel('samchon', 'easy');
    await p.tap('.sel-btns .sky-btn-go');
    for (let s = 1; s <= 6; s++) { await clearStage(); if (s < 6) { await p.evaluate(() => window.__skyFlow.nextStage()); } }
    const ckA = await p.$eval('.res-ck', (e) => e.innerText).catch(() => '');
    await p.screenshot({ path: `${out}/6-arcade-clear.png` });
    const f2 = await p.$('.res button:has-text("엔딩으로")'); if (f2) await f2.tap();
    await p.waitForTimeout(800);
    const r5 = await rec2(); st = await story();
    ok('ARCADE CLEAR: 표시 · ARCADE 보드 · 엽서', /ARCADE CLEAR/.test(ckA) && (r5.boards['arcade:easy'] ?? []).length === 1 && !!r5.col.clears['samchon:easy'] && !!st.arcade['samchon:easy'], ckA);
  }
  // 10) 새 모험 시작 확인 2번 · 수집 기록 유지
  await toLobby(); await p.tap('.lb2-pick'); await p.waitForSelector('.sel-main'); await pickSel('mom', 'easy');
  await p.tap('.sel-fresh'); const armed = await p.$eval('.sel-fresh', (e) => e.innerText);
  const before = Object.keys((await rec2()).col.stages).length;
  await p.tap('.sel-fresh'); await waitPlay();
  st = await story();
  ok('처음부터: 두 번 눌러 확인 · STAGE 1 로 · 사진 기록 그대로', /한 번 더/.test(armed) && st.slots['mom:easy'].stage === 1 && Object.keys((await rec2()).col.stages).length === before);
  ok('콘솔 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log(`\n${res.filter((x) => x.startsWith('PASS')).length}/${res.length} PASS`);
  await b.close();
})();
