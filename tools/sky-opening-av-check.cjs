/* 오프닝 전수검사 (새 컷신 플레이어 · 자막 + 음악)
 *  자막: 단계마다 [진입 · 디졸브 중 · 전환 직후 · 대기] 상태 기록 → 대기 중 빈 대사창 / 나레이션 누락 / 읽기 전 사라짐 / 대사 없는 장면의 빈 틀
 *  음악: 재생 위치 · 곡 이름 0.1초 간격 기록 + 실제 출력 음량(RMS) → 재시작 · 겹침 · 무음 구간 · 갑작스러운 교체 · 교차 페이드 중 음량 튐
 *  모드: manual(장면마다 읽는 시간만큼 기다렸다 터치) · auto(AUTO 켬) · rapid(빠른 연타 + ◀ 이전)
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-opening-av-check.cjs <url(끝 /)> <outdir> <manual|auto|rapid> [w] [h] [video=0]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out, mode = 'manual', w = '393', h = '636', VIDEO = '0'] = process.argv.slice(2);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, ...(VIDEO === '1' ? { recordVideo: { dir: out, size: { width: +w, height: +h } } } : {}) });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const res = [];
  const ok = (n, c, x = '') => res.push(`${c ? 'PASS' : 'FAIL'} · ${n}${x ? ' — ' + x : ''}`);
  await p.goto(url + '?preview');
  await p.waitForSelector('.pv-opening', { timeout: 60000 });
  await p.tap('.pv-opening'); // 사용자 터치로 시작 (모바일 자동 재생 제한과 같은 조건)
  await p.waitForFunction(() => window.__cut, null, { timeout: 30000 });
  await p.waitForTimeout(300);
  // 페이지 안 기록기: 0.1초마다 자막 상태 · 음악 · 실제 음량
  await p.evaluate(() => {
    const rec = (window.__av = []);
    let an = null, buf = null;
    try {
      const st = window.__audioTap && window.__audioTap();
      if (st) { const ac = new AudioContext(); const src = ac.createMediaStreamSource(st); an = ac.createAnalyser(); an.fftSize = 2048; src.connect(an); buf = new Float32Array(an.fftSize); }
    } catch (e) { /* 음량 측정 불가 */ }
    const t0 = performance.now();
    setInterval(() => {
      const c = window.__cut || {}; const m = window.__bgmInfo ? window.__bgmInfo() : { name: null, pos: 0, running: false };
      const box = document.querySelector('.cp-box'); const tx = document.querySelector('.cp-text');
      let rms = -1; if (an) { an.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; rms = Math.sqrt(s / buf.length); }
      rec.push({ t: Math.round(performance.now() - t0), i: c.i, st: c.st, kind: c.kind, text: (c.text || '').slice(0, 14), boxOp: box ? +getComputedStyle(box).opacity : 0, txtOp: tx ? +getComputedStyle(tx).opacity : 0, shown: tx ? tx.textContent.trim().length : 0, bgm: m.name, pos: +m.pos.toFixed(2), run: m.running, rms: +rms.toFixed(4) });
    }, 100);
  });
  const cut = () => p.evaluate(() => window.__cut);
  const waitSt = async (pred, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const c = await cut(); if (c && pred(c)) return c; await p.waitForTimeout(40); } return null; };
  const tap = () => p.touchscreen.tap(+w / 2, +h * 0.35);
  const n = (await cut()).n;
  if (mode === 'auto') {
    await waitSt((c) => c.st === 'wait');
    await p.tap('.cp-auto');
    await waitSt((c) => c.kind === 'press' && c.st === 'wait', 180000);
    await p.waitForTimeout(3000);
  } else if (mode === 'rapid') {
    for (let k = 0; k < 400; k++) {
      const c = await cut(); if (c.kind === 'press') break;
      await tap(); await p.waitForTimeout(70);
      if (k % 9 === 4) { await p.tap('.cp-back').catch(() => {}); await p.waitForTimeout(90); }
    }
    await waitSt((c) => c.kind === 'press' && c.st === 'wait', 60000);
    await p.waitForTimeout(3500);
  } else {
    // 사람처럼: 대사 길이만큼 읽고(최소 2초) 터치
    for (let k = 0; k < n + 2; k++) {
      const c = await waitSt((x) => x.st === 'wait', 30000);
      if (!c || c.kind === 'press' || c.i >= 13) break; // 13~ = 음악 동기화 구간(자동) → 터치하지 않음
      await p.waitForTimeout(c.kind === 'none' ? 2600 : Math.max(2000, 900 + c.text.length * 110));
      await tap();
    }
    await waitSt((c) => c.kind === 'press' && c.st === 'wait', 30000);
    await p.waitForTimeout(8000); // 타이틀 팡파르 → 타이틀 곡 교차까지
  }
  const av = await p.evaluate(() => window.__av);
  const bl = await p.evaluate(() => window.__bgmLog || []);
  const steps = await p.evaluate(() => window.__cutSteps);
  fs.writeFileSync(`${out}/${mode}-av.json`, JSON.stringify({ av, bl, steps }, null, 0));
  // ── 자막 판정
  const waits = av.filter((r) => r.st === 'wait');
  const emptyWait = waits.filter((r) => (r.kind === 'narr' || r.kind === 'char') && (r.shown === 0 || r.txtOp < 0.99));
  ok(`[${mode}] 대기 중 빈 대사창 없음 (나레이션·대사 단계)`, emptyWait.length === 0, emptyWait.slice(0, 3).map((r) => `단계${r.i}`).join(','));
  const noneFrame = av.filter((r) => r.kind === 'none' && r.st === 'wait' && r.boxOp > 0.05);
  ok(`[${mode}] 대사 없는 연출 장면은 빈 틀을 숨김`, noneFrame.length === 0, `${noneFrame.length}회`);
  const seen = new Set(waits.filter((r) => r.shown > 0).map((r) => r.i));
  const missing = steps.map((s, i) => (s.kind === 'narr' && !seen.has(i) ? i : -1)).filter((i) => i >= 0);
  if (mode !== 'rapid') ok(`[${mode}] 모든 나레이션이 대기 상태로 표시됨 (${steps.filter((s) => s.kind === 'narr').length}줄)`, missing.length === 0, missing.join(','));
  // 대기 중 글자가 사라진 적 (같은 단계 대기 중 opacity 하락)
  let vanish = 0; for (let k = 1; k < av.length; k++) if (av[k].st === 'wait' && av[k - 1].st === 'wait' && av[k].i === av[k - 1].i && av[k].txtOp < av[k - 1].txtOp - 0.2) vanish++;
  ok(`[${mode}] 읽는 중 자막이 사라지지 않음`, vanish === 0, `${vanish}`);
  // 빈 틀이 보인 구간 (틀 보임 · 글자 없음) — 디졸브 중 짧은 순간만 허용
  let run = 0, maxRun = 0; for (const r of av) { if (r.boxOp > 0.5 && (r.shown === 0 || r.txtOp < 0.2) && r.kind !== 'press') { run += 100; maxRun = Math.max(maxRun, run); } else run = 0; }
  ok(`[${mode}] 글자 없는 대사창이 보이는 시간 1.2초 이하 (장면 전환 순간만)`, maxRun <= 1200, `최대 ${maxRun}ms`);
  // ── 음악 판정
  const nm = av.map((r) => r.bgm);
  const switches = []; for (let k = 1; k < av.length; k++) if (nm[k] !== nm[k - 1]) switches.push({ t: av[k].t, from: nm[k - 1], to: nm[k], step: av[k].i });
  const restarts = []; for (let k = 1; k < av.length; k++) if (nm[k] && nm[k] === nm[k - 1] && av[k].run && av[k - 1].run && av[k - 1].pos > 5 && av[k].pos < 1) restarts.push(av[k].t); // 처음(0초)으로 되돌아감 = 재시작
  ok(`[${mode}] 같은 곡이 처음부터 다시 시작되지 않음`, restarts.length === 0, restarts.slice(0, 3).join(','));
  ok(`[${mode}] 곡 교체는 최대 1번 (오프닝 → 타이틀)`, switches.filter((s) => s.from).length <= 1, JSON.stringify(switches));
  const stepSw = switches.filter((s) => s.from === 'opening' && s.to === 'title');
  const titleLog = bl.filter((x) => String(x[1]).startsWith('title'));
  ok(`[${mode}] 타이틀 곡은 타이틀 화면에 도착한 뒤에만 (중간 장면·곡 끝에서 먼저 나오지 않음)`, titleLog.length === 1 && /타이틀 화면/.test(titleLog[0][1]) && !av.some((r) => r.bgm === 'title' && r.kind !== 'press'), titleLog.map((x) => x[1]).join(','));
  // 수동 구간에서 곡이 앞서 가지 않음: 동기화 구간 진입 전에는 곡 위치가 31.3초(성문 '쿵' 직전)를 넘지 않음
  const firstB = av.findIndex((r) => r.i >= 13);
  const ahead = av.slice(0, firstB > 0 ? firstB : av.length).filter((r) => r.bgm === 'opening' && r.pos > 31.25);
  ok(`[${mode}] 스토리 구간에서 곡이 가족 등장 음악(32초~)으로 먼저 넘어가지 않음`, ahead.length === 0, `${ahead.length}회 · 스토리 구간 최대 곡 위치 ${Math.max(0, ...av.slice(0, firstB > 0 ? firstB : 0).map((r) => r.pos)).toFixed(1)}초`);
  // 무음: 곡 재생 중(시작 1초 이후) RMS 가 0.002 아래로 0.5초 이상
  const rmsOn = av.some((r) => r.rms > 0.003);
  let sil = 0, maxSil = 0; const start = av.findIndex((r) => r.rms > 0.003);
  for (let k = Math.max(0, start); k < av.length; k++) { if (av[k].rms >= 0 && av[k].rms < 0.002) { sil += 100; maxSil = Math.max(maxSil, sil); } else sil = 0; }
  ok(`[${mode}] 음악 무음 구간 없음 (0.5초 이상)`, rmsOn && maxSil < 500, rmsOn ? `최대 무음 ${maxSil}ms` : '음량 측정 불가');
  // 교차 페이드 중 음량 튐: 교체 전후 2초 평균 대비 최대값
  if (stepSw.length && rmsOn) {
    const t = stepSw[0].t;
    const win = (a, b2) => av.filter((r) => r.t >= a && r.t < b2 && r.rms >= 0).map((r) => r.rms);
    const before = win(t - 6000, t), during = win(t, t + 2600), after = win(t + 2600, t + 6000);
    const avg = (x) => x.reduce((a, b2) => a + b2, 0) / Math.max(1, x.length);
    const ref = Math.max(Math.max(...before), Math.max(...after)); // 각 곡 혼자일 때의 최대 음량
    const peak = Math.max(...during.map((x) => x));
    ok(`[${mode}] 곡 교체 중 음량 튐 없음 (두 곡이 겹칠 때 최대 ≤ 각 곡 혼자일 때 최대 ×1.25)`, peak <= ref * 1.25, `교체 전 최대 ${Math.max(...before).toFixed(3)} · 교체 중 최대 ${peak.toFixed(3)} · 교체 후 최대 ${Math.max(...after).toFixed(3)} · 교체 중 최저 ${Math.min(...during).toFixed(3)}`);
    const dips = during.filter((x) => x < 0.002).length;
    ok(`[${mode}] 교체 중 뚝 끊김 없음`, dips < 5, `무음 표본 ${dips}`);
  }
  ok(`[${mode}] 콘솔 오류 없음`, errs.length === 0, errs.slice(0, 2).join(' | '));
  // 타임라인 (장면별 BGM)
  const tl = []; let lastI = -2;
  for (const r of av) if (r.i !== lastI && (r.st === 'in' || r.st === 'wait')) { lastI = r.i; tl.push({ t: +(r.t / 1000).toFixed(1), step: r.i, kind: r.kind, text: r.text, bgm: r.bgm, pos: r.pos }); }
  fs.writeFileSync(`${out}/${mode}-timeline.json`, JSON.stringify({ timeline: tl, switches, bgmLog: bl }, null, 1));
  console.log(res.join('\n') + `\n${res.filter((x) => x.startsWith('PASS')).length}/${res.length} PASS`);
  const v = p.video();
  await ctx.close();
  if (v) fs.renameSync(await v.path(), `${out}/opening-${mode}-${w}x${h}.webm`);
  await b.close();
})();
