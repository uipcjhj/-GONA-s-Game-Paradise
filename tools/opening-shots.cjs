#!/usr/bin/env node
/**
 * 오프닝 검수: 시각별 프레임(?seek) → GIF · 대표 프레임 시트 · 실제 재생 영상(webm→mp4)
 *   NODE_PATH=$(npm root -g) node tools/opening-shots.cjs <url> [out-dir] [WxH=393x636]
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const [url, outDir = 'shots', size = '393x636'] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(`${url}?seek=0`);
  await page.waitForSelector('.title.seeking');
  await page.waitForTimeout(500);
  const frames = [];
  for (let t = 0; t <= 2600; t += 50) {
    await page.evaluate((ms) => document.querySelector('.title').style.setProperty('--seek', ms + 'ms'), t);
    await page.waitForTimeout(40);
    const f = path.join(outDir, `frame-${size}-${String(t).padStart(4, '0')}.png`);
    await page.screenshot({ path: f });
    frames.push(f);
  }
  await ctx.close();
  execFileSync('python3', ['-c', `
import sys
from PIL import Image
out=sys.argv[1]; fr=sys.argv[2:]
ims=[Image.open(f).convert('RGB') for f in fr]
ims_all=ims+[ims[-1]]*14
pal=[im.quantize(colors=128,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE) for im in ims_all]
pal[0].save(out,save_all=True,append_images=pal[1:],duration=50,loop=0,optimize=False)`, path.join(outDir, `opening-${size}.gif`), ...frames]);
  const picks = [0, 150, 450, 700, 850, 1050, 1300, 1500, 1700, 1900, 2200, 2600];
  execFileSync('python3', ['-c', `
import sys
from PIL import Image
out=sys.argv[1]; fr=sys.argv[2:]
ims=[Image.open(f).convert('RGB') for f in fr]
tw=ims[0].width//2; th=ims[0].height//2; cols=6; rows=2
sheet=Image.new('RGB',(cols*tw+(cols+1)*6,rows*th+(rows+1)*6),'white')
for i,im in enumerate(ims):
    sheet.paste(im.resize((tw,th),Image.LANCZOS),(6+(i%cols)*(tw+6),6+(i//cols)*(th+6)))
sheet.save(out)`, path.join(outDir, `opening-sheet-${size}.png`), ...picks.map((t) => path.join(outDir, `frame-${size}-${String(t).padStart(4, '0')}.png`))]);

  // 실제 재생 녹화: 첫 방문 → 오프닝 자동 재생 → 타이틀 대기 → 터치 → 월드맵
  const vctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, recordVideo: { dir: outDir, size: { width: w, height: h } } });
  const vp = await vctx.newPage();
  await vp.goto(url);
  await vp.waitForSelector('.title.playing');
  await vp.waitForTimeout(3600);
  await vp.screenshot({ path: path.join(outDir, `title-${size}.png`) });
  await vp.touchscreen.tap(w / 2, h / 2);
  await vp.waitForSelector('.hit', { timeout: 5000 });
  await vp.waitForTimeout(900);
  const video = vp.video();
  await vctx.close();
  fs.renameSync(await video.path(), path.join(outDir, `opening-real-${size}.webm`));
  await browser.close();
  console.log('done', outDir);
})();
