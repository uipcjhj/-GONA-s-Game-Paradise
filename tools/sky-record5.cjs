/* 전 스테이지 플레이 영상: 타이틀 → 선택 → S1(편대·중간보스·보스·결산) → S2 → S3·S4·S5 보스 → 최종 보스 → 엔딩·크레딧
 * 화면 = Playwright recordVideo / 소리 = 게임 Web Audio 출력 녹음 (자동 조종 봇 + 무적 치트로 진행)
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-record5.cjs <url> <outdir> */
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out = 'rec5'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const t0 = Date.now();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, recordVideo: { dir: out, size: { width: 390, height: 844 } } });
  const page = await ctx.newPage();
  await page.goto(url);
  await page.waitForSelector('.ttl-start');
  const tRec = await page.evaluate(() => {
    const s = window.__skyAudioTap(); window.__chunks = [];
    const r = new MediaRecorder(s, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 160000 });
    r.ondataavailable = (e) => window.__chunks.push(e.data); r.start(500); window.__rec = r; return Date.now();
  });
  await page.touchscreen.tap(30, 400);
  await page.waitForTimeout(3500);
  await page.tap('.ttl-start'); await page.waitForSelector('.sel-art'); await page.waitForTimeout(1500);
  const go = async (st) => {
    await page.evaluate((s) => window.__skyFlow.start(s, 'normal'), st);
    await page.waitForFunction((s) => window.__sky && window.__sky.debug().stage === s && document.querySelector('.sky-canvas'), st, { timeout: 30000 });
    await page.evaluate(() => { const s = window.__sky; s.cheat('god'); s.cheat('auto'); s.power = 3; });
  };
  await page.tap('.sky-btn-go');
  await page.waitForFunction(() => window.__sky && document.querySelector('.sky-canvas'), null, { timeout: 30000 });
  await page.evaluate(() => { const s = window.__sky; s.cheat('god'); s.cheat('auto'); });
  await page.waitForTimeout(14000);
  await page.evaluate(() => window.__sky.cheat('midboss')); await page.waitForTimeout(9000);
  await page.evaluate(() => { window.__sky.cheat('killmid'); }); await page.waitForTimeout(2500);
  await page.evaluate(() => { window.__sky.cheat('gauge'); window.__sky.cheat('boss'); }); await page.waitForTimeout(16000);
  await page.evaluate(() => window.__sky.cheat('killboss'));
  await page.waitForSelector('.tally', { timeout: 20000 }); await page.waitForTimeout(3000);
  await page.tap('text=다음 스테이지');
  await page.waitForFunction(() => window.__sky && window.__sky.debug().stage === 2, null, { timeout: 30000 });
  await page.evaluate(() => { const s = window.__sky; s.cheat('god'); s.cheat('auto'); });
  await page.waitForTimeout(10000);
  for (const st of [3, 4, 5]) {
    await go(st);
    await page.waitForTimeout(st === 3 ? 7000 : 3000);
    await page.evaluate(() => window.__sky.cheat('boss')); await page.waitForTimeout(13000);
  }
  await go(6);
  await page.waitForTimeout(4000);
  await page.evaluate(() => window.__sky.cheat('boss')); await page.waitForTimeout(14000);
  await page.evaluate(() => { const s = window.__sky; for (const e of s.en) if (e.kind === 'part') e.dead = true; s.boss.hp = s.boss.max * 0.3; }); await page.waitForTimeout(9000);
  await page.evaluate(() => window.__sky.cheat('killboss'));
  await page.waitForSelector('.end-pic', { timeout: 30000 }); await page.waitForTimeout(13000);
  for (let i = 0; i < 3; i++) { await page.tap('.end'); await page.waitForTimeout(700); }
  await page.waitForSelector('.cred-scroll'); await page.waitForTimeout(10000);
  const b64 = await page.evaluate(async () => {
    const r = window.__rec; await new Promise((res) => { r.onstop = res; r.stop(); });
    const buf = new Uint8Array(await new Blob(window.__chunks, { type: 'audio/webm' }).arrayBuffer());
    let s = ''; for (let k = 0; k < buf.length; k += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(k, k + 0x8000)); return btoa(s);
  });
  fs.writeFileSync(`${out}/audio.webm`, Buffer.from(b64, 'base64'));
  const vpath = await page.video().path();
  await ctx.close(); await b.close();
  fs.writeFileSync(`${out}/meta.json`, JSON.stringify({ video: vpath, audioOffset: (tRec - t0) / 1000 }));
  console.log('ok', vpath);
})();
