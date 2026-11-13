#!/usr/bin/env node
/**
 * Phase 1 브라우저 테스트 + 스크린샷 (393×636 · 390×844)
 *   npm run build && npx vite preview --port 4173 &
 *   NODE_PATH=$(npm root -g) node tools/platform-e2e.cjs http://localhost:4173/ shots-p1
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const [url = 'http://localhost:4173/', out = 'shots-p1'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const results = [];
const ok = (name, cond, extra = '') => { results.push([name, !!cond, extra]); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };

async function newPage(browser, w, h, { seen = true, init } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, acceptDownloads: true });
  if (seen) await ctx.addInitScript(() => { if (!sessionStorage.getItem('__init')) { sessionStorage.setItem('__init', '1'); try { localStorage.setItem('gona.openingSeen', '1'); } catch (e) {} } });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return { ctx, page, errors };
}
const tapTitle = async (page, w, h) => { await page.waitForSelector('.title'); await page.touchscreen.tap(w / 2, h / 2); };
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.body.scrollWidth <= window.innerWidth);
const shot = async (page, w, h, name) => { await page.waitForTimeout(450); return page.screenshot({ path: path.join(out, `${name}_${w}x${h}.png`) }); };
const ls = (page, k) => page.evaluate((k) => localStorage.getItem(k), k);

async function register(page, w, h, nick = '고나짱', avatarName = '엄마') {
  await tapTitle(page, w, h);
  await page.waitForSelector('#gp-nick');
  await page.fill('#gp-nick', nick);
  await page.getByRole('button', { name: /다음/ }).tap();
  await page.getByRole('radio', { name: avatarName }).tap();
  await page.getByRole('button', { name: '이걸로 결정!' }).tap();
  await page.waitForSelector('text=WELCOME!');
}

(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of [[393, 636], [390, 844]]) {
    const tag = `${w}x${h}`;
    // ── 1. 최초 방문: 타이틀 → 등록 3단계 → 월드맵
    let { ctx, page, errors } = await newPage(browser, w, h);
    await page.goto(url);
    await tapTitle(page, w, h);
    await page.waitForSelector('#gp-nick');
    ok(`[${tag}] 첫 방문 타이틀 터치 → 등록 화면`, await page.locator('text=NEW PLAYER').count());
    await shot(page, w, h, '01-register-1-empty');
    await page.fill('#gp-nick', '고 나');
    ok(`[${tag}] 공백 닉네임 오류 안내`, await page.locator('.p-error', { hasText: '공백' }).count());
    ok(`[${tag}] 오류 시 다음 버튼 비활성`, await page.getByRole('button', { name: /다음/ }).isDisabled());
    await page.fill('#gp-nick', '고나!');
    ok(`[${tag}] 특수문자 오류 안내`, await page.locator('.p-error', { hasText: '한글·영문·숫자' }).count());
    await page.fill('#gp-nick', '가나다라마바사아자차카');
    ok(`[${tag}] 11자 오류 안내`, await page.locator('.p-error', { hasText: '2~10자' }).count());
    await page.fill('#gp-nick', '고나짱');
    await shot(page, w, h, '01-register-1-name');
    await page.getByRole('button', { name: /다음/ }).tap();
    await page.waitForSelector('text=CHARACTER SELECT');
    // 새로고침: 초안 유지
    await page.reload();
    await tapTitle(page, w, h);
    await page.waitForSelector('text=CHARACTER SELECT');
    ok(`[${tag}] 등록 도중 새로고침 → 초안 이어짐`, await page.locator('.p-preview b', { hasText: '고나' }).count());
    const cards = await page.locator('.p-card').count();
    ok(`[${tag}] 아바타 카드 7개 (고나+가족6)`, cards === 7, `${cards}`);
    await page.getByRole('radio', { name: '엄마' }).tap();
    await shot(page, w, h, '02-register-2-avatar');
    // 뒤로가기 → 1단계
    await page.goBack();
    await page.waitForSelector('text=NEW PLAYER');
    ok(`[${tag}] 뒤로가기 → 1단계`, true);
    await page.getByRole('button', { name: /다음/ }).tap();
    await page.getByRole('radio', { name: '엄마' }).tap();
    // 화면 회전
    await page.setViewportSize({ width: h, height: w });
    await page.waitForTimeout(300);
    ok(`[${tag}] 가로 회전 오류 없음`, errors.length === 0);
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: '이걸로 결정!' }).tap();
    await page.waitForSelector('text=WELCOME!');
    await shot(page, w, h, '03-register-3-welcome');
    const stored = JSON.parse(await ls(page, 'gp.v1.player'));
    ok(`[${tag}] 플레이어 저장 (playerId·publicCode·avatar)`, stored.playerId && /^[A-Z2-9]{4}$/.test(stored.publicCode) && stored.avatarId === 'mom' && stored.nickname === '고나짱' && stored.coinBalance === 0 && stored.playerLevel === 1);
    const pid = stored.playerId; const pcode = stored.publicCode;
    await page.getByRole('button', { name: /게임천국 입장/ }).tap();
    await page.waitForSelector('.hit');
    await page.waitForTimeout(600);
    ok(`[${tag}] 월드맵 HUD: 닉네임·LV·코인`, (await page.locator('.p-pbtn').innerText()).includes('고나짱') && (await page.locator('.p-pbtn').innerText()).includes('LV1') && (await page.locator('.p-coinchip').innerText()).trim() === '0');
    await shot(page, w, h, '04-world-hud');
    // HUD 겹침/크기
    const geo = await page.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); const a = r('.p-pbtn'), l = r('.logo'), c = r('.p-coinchip'), m = r('.mapbox'); return { a: [a.left, a.right], l: [l.left, l.right], c: [c.left, c.right], top: a.top >= 0 && c.top >= 0, mapH: m.height, mapTop: m.top }; });
    ok(`[${tag}] HUD 좌·로고·우 겹침 없음`, geo.a[1] <= geo.l[0] && geo.l[1] <= geo.c[0], JSON.stringify(geo));
    ok(`[${tag}] 월드맵 영역 높이 불변(전체−48−66)`, Math.abs(geo.mapH - (h - 48 - 66)) < 2, `${geo.mapH}`);
    ok(`[${tag}] 가로 스크롤 없음 (월드맵)`, await noHScroll(page));

    // ── 2. 섬 터치 · 팝업 · Food 링크
    const n = await page.locator('.hit').count();
    const titles = [];
    for (let i = 1; i < n; i++) {
      const el = page.locator('.hit').nth(i); const b = await el.boundingBox();
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      await page.waitForTimeout(1300);
      titles.push(await page.locator('.popup h2').textContent().catch(() => null));
      if (i === 1) await shot(page, w, h, '05-island-food');
      if (i === 2) await shot(page, w, h, '05-island-sky');
    }
    ok(`[${tag}] 섬 3개 터치 → 팝업 제목`, titles.length === 3 && titles.every(Boolean), titles.join(' | '));
    const hit = page.locator('.hit').nth(1); const hb = await hit.boundingBox();
    await page.touchscreen.tap(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.waitForTimeout(1300);
    ok(`[${tag}] Food 입장 링크 유지`, (await page.locator('.popup a.btn-go').getAttribute('href')) === 'https://uipcjhj.github.io/GoNa/');
    const hb3 = await page.locator('.hit').nth(3).boundingBox();
    await page.touchscreen.tap(hb3.x + hb3.width / 2, hb3.y + hb3.height / 2);
    await page.waitForTimeout(1300);
    ok(`[${tag}] 미출시 게임 COMING SOON`, await page.locator('.popup .chip-soon', { hasText: 'COMING SOON' }).count());

    // ── 3. 프로필
    await page.getByRole('button', { name: /PROFILE/ }).tap();
    await page.waitForSelector('.p-pcard');
    const ptxt = await page.locator('.p-pcard').innerText();
    ok(`[${tag}] 프로필: 닉네임·식별코드·LV·XP·코인`, ptxt.includes('고나짱') && ptxt.includes('#' + pcode) && ptxt.includes('LV') && ptxt.includes('XP 0 / 100'));
    ok(`[${tag}] 프로필: 가짜 기록 숫자 없음`, (await page.locator('.p-screen').innerText()).includes('아직 기록이 없어요'));
    await shot(page, w, h, '06-profile');
    ok(`[${tag}] 가로 스크롤 없음 (프로필)`, await noHScroll(page));
    // 닉네임 변경 (취소 → 유지, 저장 → 변경)
    await page.getByRole('button', { name: '닉네임 변경' }).tap();
    await page.fill('#gp-nick', '바뀐이름');
    await shot(page, w, h, '07-profile-nick-edit');
    await page.getByRole('button', { name: '취소' }).tap();
    ok(`[${tag}] 닉네임 편집 취소 → 기존 유지`, JSON.parse(await ls(page, 'gp.v1.player')).nickname === '고나짱');
    await page.getByRole('button', { name: '닉네임 변경' }).tap();
    await page.fill('#gp-nick', '바뀐이름');
    await page.getByRole('button', { name: '저장' }).tap();
    await page.waitForTimeout(300);
    let st = JSON.parse(await ls(page, 'gp.v1.player'));
    ok(`[${tag}] 닉네임 변경 저장 · playerId/코드 유지`, st.nickname === '바뀐이름' && st.playerId === pid && st.publicCode === pcode);
    // 아바타 변경
    await page.getByRole('button', { name: '아바타 변경' }).tap();
    await page.getByRole('radio', { name: '할아버지' }).tap();
    await shot(page, w, h, '08-profile-avatar-edit');
    await page.getByRole('button', { name: '저장' }).tap();
    await page.waitForTimeout(300);
    st = JSON.parse(await ls(page, 'gp.v1.player'));
    ok(`[${tag}] 아바타 변경 · 기존 데이터 유지`, st.avatarId === 'halabeoji' && st.playerId === pid && st.nickname === '바뀐이름' && st.createdAt);
    ok(`[${tag}] HUD 에 새 아바타·닉네임 반영`, (await page.locator('.p-pbtn').innerText()).includes('바뀐이름') && (await page.locator('.p-pbtn img').getAttribute('alt')) === '할아버지');

    // ── 4. 랭킹
    await page.getByRole('button', { name: /RANKING/ }).tap();
    await page.waitForSelector('.p-tabs');
    const rtxt = await page.locator('.p-screen').innerText();
    ok(`[${tag}] 랭킹: 준비 중 안내 · 가짜 순위 없음`, rtxt.includes('온라인 랭킹 준비 중') && !/\d{1,3},\d{3}/.test(rtxt) && !rtxt.includes('예시'));
    await page.getByRole('tab', { name: '역대 최고' }).tap();
    await page.getByRole('tab', { name: 'Sky' }).tap();
    ok(`[${tag}] 랭킹: 게임/기간 탭 전환`, await page.locator('text=COMING SOON').count());
    await page.getByRole('tab', { name: 'Food' }).tap();
    await shot(page, w, h, '09-ranking');
    ok(`[${tag}] 가로 스크롤 없음 (랭킹)`, await noHScroll(page));

    // ── 5. MORE · 설정
    await page.getByRole('button', { name: /MORE/ }).tap();
    await page.waitForSelector('.p-menu');
    await shot(page, w, h, '10-more');
    await page.getByRole('button', { name: /업적/ }).tap();
    ok(`[${tag}] MORE: 업적 → 준비 중 화면`, await page.locator('text=준비 중이에요').count());
    await page.goBack(); await page.waitForSelector('.p-menu');
    ok(`[${tag}] 뒤로가기 → MORE 목록`, true);
    await page.getByRole('button', { name: /설정/ }).tap();
    await page.waitForSelector('text=데이터 백업');
    await shot(page, w, h, '11-settings');
    ok(`[${tag}] 가로 스크롤 없음 (설정)`, await noHScroll(page));
    await page.getByRole('switch', { name: '효과음' }).tap();
    ok(`[${tag}] 효과음 끄기 → gona.mute=1`, (await ls(page, 'gona.mute')) === '1');
    await page.getByRole('switch', { name: '효과음' }).tap();
    ok(`[${tag}] 효과음 켜기 → gona.mute 제거`, (await ls(page, 'gona.mute')) === null);
    ok(`[${tag}] BGM 토글 비활성(준비 중)`, await page.getByRole('switch', { name: /배경음/ }).isDisabled());
    // 백업
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '파일로 백업' }).tap()]);
    const bpath = path.join(out, `backup_${tag}.json`); await dl.saveAs(bpath);
    const backup = JSON.parse(fs.readFileSync(bpath, 'utf8'));
    ok(`[${tag}] 백업 JSON 내보내기`, backup.kind === 'gona-game-paradise/player-backup' && backup.player.playerId === pid && /^gona-paradise-backup-\d{8}\.json$/.test(dl.suggestedFilename()), dl.suggestedFilename());
    // 잘못된 파일
    fs.writeFileSync(path.join(out, 'bad.json'), '{"hello":1}');
    await page.locator('input[type=file]').setInputFiles(path.join(out, 'bad.json'));
    await page.waitForSelector('text=복원할 수 없어요');
    ok(`[${tag}] 잘못된 백업 파일 오류 안내`, await page.locator('text=게임천국 백업 파일이 아니에요').count());
    await shot(page, w, h, '12-restore-error');
    await page.getByRole('button', { name: '확인' }).tap();
    // 정상 복원(덮어쓰기 확인)
    backup.player.nickname = '복원이'; fs.writeFileSync(path.join(out, 'good.json'), JSON.stringify(backup));
    await page.locator('input[type=file]').setInputFiles(path.join(out, 'good.json'));
    await page.waitForSelector('text=백업으로 덮어쓸까요?');
    await shot(page, w, h, '13-restore-confirm');
    await page.getByRole('button', { name: '취소' }).tap();
    ok(`[${tag}] 복원 취소 → 기존 데이터 유지`, JSON.parse(await ls(page, 'gp.v1.player')).nickname === '바뀐이름');
    await page.locator('input[type=file]').setInputFiles(path.join(out, 'good.json'));
    await page.getByRole('button', { name: '덮어쓰기' }).tap();
    await page.waitForTimeout(300);
    ok(`[${tag}] 복원 완료`, JSON.parse(await ls(page, 'gp.v1.player')).nickname === '복원이' && JSON.parse(await ls(page, 'gp.v1.player')).playerId === pid);

    // ── 6. 재방문 (새로고침 → 타이틀 → 바로 월드맵)
    await page.reload();
    await tapTitle(page, w, h);
    await page.waitForSelector('.hit');
    ok(`[${tag}] 재방문: 등록 생략 → 월드맵 · 데이터 유지`, (await page.locator('.p-pbtn').innerText()).includes('복원이'));

    // ── 7. 초기화 (이중 확인) → 등록 화면, gona.* 보존
    await page.evaluate(() => { localStorage.setItem('gona.mute', '1'); localStorage.setItem('dino-snack-adventure.best', '777'); });
    await page.getByRole('button', { name: /MORE/ }).tap();
    await page.getByRole('button', { name: /설정/ }).tap();
    await page.getByRole('button', { name: '초기화', exact: true }).tap();
    await page.waitForSelector('text=정말 초기화할까요?');
    await page.getByRole('button', { name: '취소' }).tap();
    ok(`[${tag}] 초기화 1차 취소 → 데이터 유지`, !!(await ls(page, 'gp.v1.player')));
    await page.getByRole('button', { name: '초기화', exact: true }).tap();
    await page.getByRole('button', { name: '계속' }).tap();
    await page.waitForSelector('text=마지막 확인');
    await shot(page, w, h, '14-reset-confirm2');
    await page.getByRole('button', { name: '모두 삭제' }).tap();
    await page.waitForSelector('text=NEW PLAYER');
    ok(`[${tag}] 초기화 후 등록 화면 복귀`, true);
    ok(`[${tag}] 초기화: gp.v1.* 삭제`, (await ls(page, 'gp.v1.player')) === null && (await ls(page, 'gp.v1.player.bak')) === null);
    ok(`[${tag}] 초기화: gona.openingSeen·gona.mute·타 게임 키 보존`, (await ls(page, 'gona.openingSeen')) === '1' && (await ls(page, 'gona.mute')) === '1' && (await ls(page, 'dino-snack-adventure.best')) === '777');
    ok(`[${tag}] 콘솔 오류 없음 (전체 흐름)`, errors.length === 0, errors.join(' / '));
    await ctx.close();

    // ── 8. 손상 데이터
    ({ ctx, page, errors } = await newPage(browser, w, h, { init: () => { if (!sessionStorage.getItem('__c')) { sessionStorage.setItem('__c', '1'); localStorage.setItem('gp.v1.player', '{broken'); } } }));
    await page.goto(url);
    await tapTitle(page, w, h);
    await page.waitForSelector('text=SAVE ERROR');
    ok(`[${tag}] 손상 데이터 → 복구 안내 화면(앱 정상)`, true);
    await shot(page, w, h, '15-corrupt-notice');
    ok(`[${tag}] 손상 원본 보관`, (await ls(page, 'gp.v1.player.corrupt')) === '{broken');
    await page.getByRole('button', { name: '새로 시작하기' }).tap();
    await page.getByRole('button', { name: '새로 시작' }).last().tap();
    await page.waitForSelector('text=NEW PLAYER');
    ok(`[${tag}] 새로 시작 → 등록`, errors.length === 0, errors.join(' / '));
    await ctx.close();

    // ── 9. 타이틀 · 오프닝 회귀 (첫 방문: 오프닝 자동 재생)
    ({ ctx, page, errors } = await newPage(browser, w, h, { seen: false }));
    await page.goto(url);
    await page.waitForSelector('.title.playing', { timeout: 5000 });
    ok(`[${tag}] 첫 방문 오프닝 재생`, true);
    await page.waitForTimeout(2300);
    ok(`[${tag}] 오프닝 종료 후 TAP 문구`, await page.locator('.t-tap').count());
    ok(`[${tag}] gona.openingSeen 기록`, (await ls(page, 'gona.openingSeen')) === '1');
    await shot(page, w, h, '16-title');
    ok(`[${tag}] 타이틀 콘솔 오류 없음`, errors.length === 0, errors.join(' / '));
    await ctx.close();
  }
  await browser.close();
  const failed = results.filter((r) => !r[1]);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  fs.writeFileSync(path.join(out, 'e2e-result.json'), JSON.stringify(results, null, 1));
  process.exit(failed.length ? 1 : 0);
})();
