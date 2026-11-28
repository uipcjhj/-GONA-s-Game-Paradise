/* 오프닝 음악 동기화 검수 (하이브리드: 스토리 구간 수동 · 출격 시퀀스 곡 위치 기준 자동)
 *  ① 등장 효과가 켜진 순간의 '곡 위치' vs 원래 시각표(at) 오차  ② 가족 등장 순서  ③ 실제 소리(팀파니) 시각 vs 화면 등장 시각
 *  ④ 연타 · ◀ 이전 후 재진입 · AUTO 에서도 같은지  ⑤ 오디오 포함 녹화(webm 소리 + 화면 → mp4)
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-opening-sync-check.cjs <url(끝 /)> <outdir> <manual|auto|rapid|reenter> [w] [h] [record=0]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const { execSync } = require('child_process');
const [url, out, mode = 'manual', w = '393', h = '636', REC = '0'] = process.argv.slice(2);
const FAM = ['mom', 'dad', 'imo', 'samchon', 'halmeoni', 'halabeoji'];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const t0Video = Date.now();
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, ...(REC === '1' ? { recordVideo: { dir: out, size: { width: +w, height: +h } } } : {}) });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const res = [];
  const ok = (n, c, x = '') => res.push(`${c ? 'PASS' : 'FAIL'} · ${n}${x ? ' — ' + x : ''}`);
  await p.goto(url + '?preview');
  await p.waitForSelector('.pv-opening', { timeout: 60000 });
  await p.tap('.pv-opening');
  await p.waitForFunction(() => window.__cut && window.__songPos, null, { timeout: 30000 });
  // 소리 기록: 실제 출력 음량(매 프레임) + MediaRecorder(녹음)
  await p.evaluate((rec) => {
    const env = (window.__env = []);
    const st = window.__audioTap();
    const ac = new AudioContext();
    const src = ac.createMediaStreamSource(st);
    const an = ac.createAnalyser(); an.fftSize = 1024; src.connect(an);
    const buf = new Float32Array(an.fftSize);
    const f = () => { an.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; env.push([performance.now(), Math.sqrt(s / buf.length), window.__songPos()]); requestAnimationFrame(f); };
    requestAnimationFrame(f);
    if (rec) {
      const mr = new MediaRecorder(st, { mimeType: 'audio/webm' });
      const chunks = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      window.__recStartWall = Date.now();
      mr.start(500);
      window.__stopRec = () => new Promise((r) => { mr.onstop = async () => { const bl = new Blob(chunks, { type: 'audio/webm' }); const ab = await bl.arrayBuffer(); r(Array.from(new Uint8Array(ab))); }; mr.stop(); });
    }
  }, REC === '1');
  const cut = () => p.evaluate(() => window.__cut);
  const waitSt = async (pred, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { const c = await cut(); if (c && pred(c)) return c; await p.waitForTimeout(40); } return null; };
  const tap = () => p.touchscreen.tap(+w / 2, +h * 0.35);
  const reachB = async (slow) => {
    for (let g = 0; g < 80; g++) {
      const c = await waitSt((x) => x.st === 'wait' || (x.i >= 13), 60000);
      if (!c || c.i >= 13) return;
      if (slow) await p.waitForTimeout(c.kind === 'none' ? 2600 : Math.max(2200, 900 + c.text.length * 120));
      await tap();
      if (mode === 'rapid') { await p.waitForTimeout(60); await tap(); await tap(); }
    }
  };
  if (mode === 'auto') { await waitSt((c) => c.st === 'wait'); await p.tap('.cp-auto'); await waitSt((c) => c.i >= 13, 150000); }
  else if (mode === 'reenter') {
    await reachB(false);
    await waitSt((c) => c.kind === 'press' && c.st === 'wait', 30000);
    await p.tap('.cp-back'); // 타이틀 → 마왕 대사로 (동기화 구간을 건너뜀)
    await waitSt((c) => c.st === 'wait' && c.i < 13, 15000);
    await p.evaluate(() => { if (window.__syncLog) window.__syncLog.length = 0; window.__reT = performance.now(); });
    await p.waitForTimeout(1500);
  } else await reachB(mode === 'manual');
  if (mode === 'reenter') await tap();
  // 동기화 구간: 터치하지 않음 (rapid 는 계속 연타)
  const tB = Date.now();
  while (Date.now() - tB < 16000) {
    const c = await cut();
    if (c && c.kind === 'press' && c.st === 'wait') break;
    if (mode === 'rapid') { await tap(); await p.waitForTimeout(90); } else await p.waitForTimeout(100);
  }
  await waitSt((c) => c.kind === 'press' && c.st === 'wait', 20000);
  await p.waitForTimeout(6500); // 타이틀 팡파르 → 타이틀 곡 교차까지
  const sync = await p.evaluate(() => window.__syncLog || []);
  const env = await p.evaluate(() => window.__env);
  const bl = await p.evaluate(() => window.__bgmLog || []);
  // ① 등장 · 장면 전환이 켜진 곡 위치 vs 원래 시각
  const items = sync.map(([t, pos, at, k]) => ({ t, pos, at, k, err: +(pos - at).toFixed(3) })).filter((q) => q.k);
  const fam = items.filter((q) => q.k.startsWith('등장:'));
  const order = fam.map((q) => q.k.slice(3));
  ok(`[${mode}] 가족 등장 순서 = 엄마·아빠·이모·삼촌·할머니·할아버지 (원래 오프닝과 같음)`, JSON.stringify(order) === JSON.stringify(FAM), order.join('→'));
  const maxErr = Math.max(...items.map((q) => Math.abs(q.err)));
  ok(`[${mode}] 모든 등장·장면 전환이 원래 곡 위치에서 (오차 ≤ 0.05초)`, items.length >= 18 && maxErr <= 0.05, `${items.length}개 · 최대 오차 ${(maxErr * 1000).toFixed(0)}ms`);
  ok(`[${mode}] 등장 효과 중복 없음 (각 1번)`, new Set(items.map((q) => q.k)).size === items.length, `${items.length}개 중 고유 ${new Set(items.map((q) => q.k)).size}`);
  // ② 실제 소리: 팀파니(가족 컷인 박자) 시각 = 출력 음량이 직전 대비 튀는 순간 (기대 곡 위치 ±0.12초 안)
  const reT0 = await p.evaluate(() => window.__reT || 0);
  const onset = (songT) => {
    const win = env.filter((e) => e[2] >= songT - 0.15 && e[2] <= songT + 0.2 && e[0] > reT0);
    let best = null, jump = 0;
    for (let k = 3; k < win.length; k++) { const d = win[k][1] - Math.min(win[k - 3][1], win[k - 2][1]); if (d > jump) { jump = d; best = win[k]; } }
    return best;
  };
  // 화면 등장 시각 - 측정된 소리 시작 시각 (음수 = 화면이 먼저). 측정 경로(분석기) 지연이 섞여 있어 소리가 조금 늦게 잡힘
  const av = fam.map((q) => { const o = onset(q.at); return { fam: q.k.slice(3), at: q.at, visT: q.t, audT: o ? Math.round(o[0]) : null, diff: o ? Math.round(q.t - o[0]) : null }; });
  const okAv = av.every((q) => q.diff != null && q.diff >= -60 && q.diff <= 60);
  ok(`[${mode}] 실제 소리(팀파니)와 화면 등장 시각 차이 ±60ms 이내 (측정 경로 지연 포함 · 한 프레임 16.7ms)`, okAv, av.map((q) => `${q.fam} ${q.diff}ms`).join(' · '));
  // ③ 곡 위치 연속성: 동기화 구간에서 곡이 되감기거나 겹치지 않음
  const reT = await p.evaluate(() => window.__reT || 0);
  const bEnv = env.filter((e) => e[2] >= 31.2 && e[0] > reT + 2500);
  let back = 0; for (let k = 1; k < bEnv.length; k++) if (bEnv[k][2] < bEnv[k - 1][2] - 0.05) back++;
  ok(`[${mode}] 동기화 구간에서 곡이 처음부터 다시 · 겹쳐 재생되지 않음`, back === 0, `되감김 ${back}`);
  ok(`[${mode}] 콘솔 오류 없음`, errs.length === 0, errs.slice(0, 2).join(' | '));
  fs.writeFileSync(`${out}/${mode}-sync.json`, JSON.stringify({ items, av, bgmLog: bl }, null, 1));
  if (REC === '1') {
    const bytes = await p.evaluate(() => window.__stopRec());
    const recWall = await p.evaluate(() => window.__recStartWall);
    fs.writeFileSync(`${out}/${mode}-audio.webm`, Buffer.from(bytes));
    const v = p.video();
    await ctx.close();
    const vp = `${out}/${mode}-video.webm`;
    fs.renameSync(await v.path(), vp);
    const off = ((recWall - t0Video) / 1000).toFixed(3);
    execSync(`ffmpeg -loglevel error -y -i ${vp} -itsoffset ${off} -i ${out}/${mode}-audio.webm -map 0:v -map 1:a -c:v libx264 -pix_fmt yuv420p -crf 26 -c:a aac -b:a 160k -shortest ${out}/opening-${mode}-${w}x${h}-sound.mp4`);
    res.push(`녹화: ${out}/opening-${mode}-${w}x${h}-sound.mp4 (소리 시작 ${off}s)`);
  } else await ctx.close();
  console.log(res.join('\n') + `\n${res.filter((x) => x.startsWith('PASS')).length}/${res.filter((x) => /^(PASS|FAIL)/.test(x)).length} PASS`);
  console.log('TIMECODE', JSON.stringify(items.map((q) => [q.k, q.at, q.pos])));
  await b.close();
})();
