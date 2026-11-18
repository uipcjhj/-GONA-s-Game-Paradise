// 오프닝 시네마틱 자동 검수 (iPhone 크기 · 터치)
//  1) 첫 실행: 타이틀 START → 오프닝 자동 재생 → 시각별 캡처 · 장면/자막/BGM 기록 → 끝나면 선택 화면 → STAGE 1 진입
//  2) 재방문(새로고침): START → 오프닝 없이 선택 화면
//  3) 타이틀 '오프닝 다시보기' → SKIP 연타 → 타이틀로 (중복 전환 없음)
//  녹화: video=1 이면 첫 실행 전체를 webm 으로 (tools 밖에서 ffmpeg 로 mp4/gif 변환)
// 사용: NODE_PATH=$(npm root -g) node tools/sky-opening-check.cjs <url> <outdir> [w] [h] [video=0]
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out, W = '393', H = '636', VIDEO = '0'] = process.argv.slice(2);
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const SHOTS = [0.6, 1.6, 2.6, 3.6, 4.6, 5.6, 6.6, 7.7, 8.6, 9.6, 10.5, 11.4, 12.3, 12.75, 13.3, 13.65, 14.4, 15.0, 15.6, 16.4, 17.2, 18.4, 19.2, 19.85, 20.45, 21.05, 21.65, 22.25, 22.85, 23.5, 24.6, 25.5, 26.2, 26.7, 27.6, 28.3, 28.8, 29.2, 30.0, 31.5, 32.6];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const tag = `${W}x${H}`;
  const ctx = await b.newContext({ viewport: { width: +W, height: +H }, isMobile: true, hasTouch: true, userAgent: UA, deviceScaleFactor: 1, ...(VIDEO === '1' ? { recordVideo: { dir: out, size: { width: +W, height: +H } } } : {}) });
  const p = await ctx.newPage();
  const errs = [], bad = [], log = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  p.on('response', (r) => r.status() >= 400 && bad.push(r.status() + ' ' + r.url()));
  await p.goto(url);
  await p.waitForSelector('.ttl-start');
  await p.waitForTimeout(800);
  await p.tap('.ttl-start');
  await p.waitForSelector('.oc', { timeout: 10000 });
  log.push('1) 첫 실행: START → 오프닝 자동 재생');
  await p.waitForFunction(() => window.__skyOpening && window.__skyOpening.t() > 0.05, null, { timeout: 15000 });
  const seenScenes = [], seenLines = [], audio = [];
  let k = 0;
  const t0 = Date.now();
  while (!(await p.$('.sel-art'))) {
    const st = await p.evaluate(() => ({ t: window.__skyOpening ? window.__skyOpening.t() : -1, sc: window.__skyOpening ? window.__skyOpening.scene() : -1, lines: [...document.querySelectorAll('.oc-line:not(.out)')].map((e) => e.textContent), title: !!document.querySelector('.oc-title'), a: window.__skyAudio ? window.__skyAudio() : null, hud: !!document.querySelector('.sky-ctrl, .sky-pause, .sel-roster') }));
    if (st.hud && st.t < 32.2) log.push(`! 오프닝 중 HUD/선택 UI 노출 t=${st.t.toFixed(2)}`);
    if (st.sc > 0 && seenScenes[seenScenes.length - 1] !== st.sc) seenScenes.push(st.sc);
    for (const l of st.lines) if (!seenLines.includes(l)) seenLines.push(l);
    if (st.a) audio.push(`${st.t.toFixed(1)}:${st.a.bgm}/${st.a.wanted}`);
    while (k < SHOTS.length && st.t >= SHOTS[k]) {
      await p.screenshot({ path: `${out}/${tag}-op-${String(k).padStart(2, '0')}-${SHOTS[k].toFixed(2)}s.png` });
      k++;
    }
    if (Date.now() - t0 > 60000) { log.push('! 시간 초과'); break; }
    await p.waitForTimeout(40);
  }
  log.push(`장면 순서: ${seenScenes.join(' → ')}`);
  log.push(`자막 ${seenLines.length}줄: ${seenLines.join(' / ')}`);
  const bgms = [...new Set(audio.map((x) => x.split(':')[1]))];
  log.push(`BGM 상태 변화: ${bgms.join(' → ')}`);
  log.push(`끝난 뒤 화면: ${(await p.$('.sel-art')) ? '캐릭터 선택' : '?'} · 걸린 시간 ${((Date.now() - t0) / 1000).toFixed(1)}초 · 캡처 ${k}장`);
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${out}/${tag}-after-select.png` });
  log.push(`선택 화면 BGM: ${JSON.stringify(await p.evaluate(() => window.__skyAudio && window.__skyAudio()))}`);
  // STAGE 1 진입
  await p.tap('.sky-btn-go');
  await p.waitForSelector('.sky-canvas', { timeout: 20000 });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/${tag}-after-stage1.png` });
  log.push(`STAGE 1 진입: ${(await p.$('.sky-canvas')) ? 'OK' : '실패'} · BGM ${JSON.stringify(await p.evaluate(() => window.__skyAudio().bgm))}`);
  // 2) 재방문
  await p.reload();
  await p.waitForSelector('.ttl-start');
  await p.waitForTimeout(500);
  await p.tap('.ttl-start');
  await p.waitForSelector('.sel-art, .oc', { timeout: 10000 });
  log.push(`2) 재방문 START → ${(await p.$('.oc')) ? '! 오프닝이 다시 나옴' : '선택 화면 (오프닝 반복 안 함)'}`);
  // 3) 다시보기 + SKIP 연타
  await p.tap('text=타이틀');
  await p.waitForSelector('.ttl-start');
  const btn = await p.$('text=오프닝 다시보기');
  log.push(`3) 타이틀 '오프닝 다시보기' 버튼: ${btn ? '있음' : '없음'}`);
  if (btn) {
    await btn.tap();
    await p.waitForSelector('.oc');
    await p.waitForFunction(() => window.__skyOpening && window.__skyOpening.t() > 2);
    await p.screenshot({ path: `${out}/${tag}-replay.png` });
    let transitions = 0;
    p.on('framenavigated', () => transitions++);
    await Promise.all([p.tap('.oc-skip'), p.tap('.oc-skip').catch(() => {}), p.tap('.oc-skip').catch(() => {})]);
    await p.waitForSelector('.ttl-start', { timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(1200);
    const where = (await p.$('.ttl-start')) ? '타이틀' : (await p.$('.sel-art')) ? '선택' : (await p.$('.oc')) ? '오프닝' : '?';
    log.push(`SKIP 3연타 → ${where} · BGM ${JSON.stringify(await p.evaluate(() => window.__skyAudio().bgm))}`);
  }
  log.push(`콘솔 오류 ${errs.length ? errs.join(' | ') : 0} · 실패 요청 ${bad.length ? bad.join(', ') : 0}`);
  fs.writeFileSync(`${out}/${tag}-log.txt`, log.join('\n'));
  console.log(log.join('\n'));
  await ctx.close();
  await b.close();
})();
