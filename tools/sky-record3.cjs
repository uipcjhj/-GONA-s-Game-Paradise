/* 3차 개선 플레이 영상: 타이틀 → 선택 → 스테이지(차지·필살기·폭탄) → 보스전 → 클리어
 * 화면: Playwright recordVideo / 소리: 게임 Web Audio 출력을 MediaRecorder 로 녹음 → ffmpeg 로 합침
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-record3.cjs <url> <outdir> [fam] */
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out = 'rec3', fam = 'dad'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const t0 = Date.now();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, recordVideo: { dir: out, size: { width: 390, height: 844 } } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto(url);
  await page.waitForSelector('.ttl-start');
  // 녹음 시작
  const tRec = await page.evaluate(() => {
    const s = window.__skyAudioTap();
    window.__chunks = [];
    const r = new MediaRecorder(s, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 160000 });
    r.ondataavailable = (e) => window.__chunks.push(e.data);
    r.start(500);
    window.__rec = r;
    return Date.now();
  });
  await page.touchscreen.tap(30, 400);
  await page.waitForTimeout(4200);
  await page.tap('.ttl-start');
  await page.waitForSelector('.sel-art');
  await page.waitForTimeout(900);
  const fams = ['mom', 'dad', 'imo', 'halmeoni', 'halabeoji', 'samchon'];
  for (const f of ['mom', 'imo', fam]) { await page.tap(`.sel-roster li:nth-child(${fams.indexOf(f) + 1}) button`); await page.waitForTimeout(650); }
  await page.waitForTimeout(500);
  await page.tap('.sky-btn-go');
  await page.waitForSelector('.sky-canvas');
  await page.evaluate(() => { window.__sky.cheat('god'); });
  const box = await (await page.$('.sky-canvas')).boundingBox();
  const P = (x, y, id = 0) => ({ x: box.x + (x / 180) * box.width, y: box.y + (y / 320) * box.height, id });
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const center = async (sel, id) => { const r = await (await page.$(sel)).boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, id }; };
  let i = 0;
  const fly = async (secs, other = []) => {
    const e = Date.now();
    while (Date.now() - e < secs * 1000) {
      i++;
      await touch('touchMove', [P(90 + 55 * Math.sin(i / 14), 245 - 16 * Math.sin(i / 21)), ...other]);
      await page.waitForTimeout(30);
    }
  };
  await touch('touchStart', [P(90, 245)]);
  await fly(5);
  await page.evaluate(() => window.__sky.cheat('power'));
  await fly(4);
  const C = await center('.sky-charge', 1);
  await touch('touchStart', [P(90, 245), C]);
  await fly(1.3, [C]);
  await touch('touchEnd', [C]);
  await fly(2.5);
  await page.evaluate(() => window.__sky.cheat('gauge'));
  await fly(0.6);
  const S = await center('.sky-sp', 2);
  await touch('touchStart', [P(90, 245), S]); await touch('touchEnd', [S]);
  await fly(4.5);
  const B = await center('.sky-bomb', 3);
  await touch('touchStart', [P(90, 245), B]); await touch('touchEnd', [B]);
  await fly(3.5);
  await page.evaluate(() => window.__sky.cheat('boss'));
  await fly(12);
  await touch('touchStart', [P(90, 245), C]);
  await fly(1.3, [C]);
  await touch('touchEnd', [C]);
  await fly(3);
  await page.evaluate(() => { const s = window.__sky; s.boss.hp = Math.min(s.boss.hp, s.boss.max * 0.3); });
  await fly(5);
  await page.evaluate(() => window.__sky.cheat('killboss'));
  await fly(6.5);
  await page.waitForTimeout(1500);
  const b64 = await page.evaluate(async () => {
    const r = window.__rec;
    await new Promise((res) => { r.onstop = res; r.stop(); });
    const blob = new Blob(window.__chunks, { type: 'audio/webm' });
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let k = 0; k < buf.length; k += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(k, k + 0x8000));
    return btoa(s);
  });
  fs.writeFileSync(`${out}/audio.webm`, Buffer.from(b64, 'base64'));
  const vpath = await page.video().path();
  await ctx.close(); await b.close();
  fs.writeFileSync(`${out}/meta.json`, JSON.stringify({ video: vpath, audioOffset: (tRec - t0) / 1000 }));
  console.log('ok', vpath, (tRec - t0) / 1000);
})();
