// 응가 테마 스토리 흐름 자동 검수: 타이틀 → (오프닝 스킵) → 선택 → 스테이지 진행 (엔진 sim 으로 빠르게) →
// 대화창이 뜨면 대사 기록·캡처·터치로 진행 → 클리어 → 다음 스테이지 … → 엔딩 → 크레딧
// 사용: NODE_PATH=$(npm root -g) node tools/sky-story-check.cjs <url> <outdir> [w] [h] [fam] [stages=1-6] [shots=1]
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out, W = '393', H = '636', FAM = 'mom', RANGE = '1-6', SHOTS = '1'] = process.argv.slice(2);
const ORDER = ['mom', 'dad', 'imo', 'halmeoni', 'halabeoji', 'samchon'];
const [s0, s1] = RANGE.split('-').map(Number);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: +W, height: +H }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [], bad = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  page.on('response', (r) => r.status() >= 400 && bad.push(r.status() + ' ' + r.url()));
  const tag = `${W}x${H}`;
  let n = 0;
  const shot = async (name) => { if (SHOTS === '1') await page.screenshot({ path: `${out}/${tag}-${String(++n).padStart(3, '0')}-${name}.png` }); };
  await page.goto(url);
  await page.waitForSelector('.ttl-start');
  await page.tap('.ttl-start');
  await page.waitForSelector('.sel-art, .opening-skip');
  if (await page.$('.opening-skip')) await page.tap('.opening-skip');
  await page.waitForSelector('.sel-art');
  await page.tap(`.sel-roster li:nth-child(${ORDER.indexOf(FAM) + 1}) button`);
  await page.waitForTimeout(150);
  if (s0 > 1) await page.evaluate((st) => window.__skyFlow.start(st), s0);
  else await page.tap('.sky-btn-go');
  const log = [];
  let fromIdx = 0; // 이번 스테이지 대사 기록이 시작되는 위치 (스테이지 시작 전에 정함)
  for (let st = s0; st <= s1; st++) {
    await page.waitForSelector('.sky-canvas');
    await page.waitForFunction(() => window.__sky && window.__sky.debug().stage > 0);
    await page.waitForTimeout(400);
    await page.evaluate(() => { window.__sky.cheat('god'); window.__sky.cheat('power'); window.__sky.cheat('auto'); });
    const seen = new Set();
    const from = fromIdx;
    const t0 = Date.now();
    for (;;) {
      if (Date.now() - t0 > 300000) { log.push(`S${st} 시간 초과`); break; }
      const phase = await page.evaluate(() => (document.querySelector('.tally') ? 'tally' : document.querySelector('.sky.end') ? 'ending' : 'play'));
      if (phase === 'tally' || phase === 'ending') break;
      const st8 = await page.evaluate(() => ({ talk: window.__skyTalk ? { i: window.__skyTalk.i, typing: window.__skyTalk.typing, text: window.__skyTalk.text } : null, bark: !!window.__skyBark, d: window.__sky ? window.__sky.debug() : null }));
      const { talk, bark, d } = st8;
      if (talk) {
        // 정지 대화: 첫 줄이 다 찍히면 캡처 → 실제 터치로 한 번씩 진행
        if (!talk.typing && talk.i === 0 && !seen.has(talk.text)) { seen.add(talk.text); await shot(`s${st}-talk`); }
        await page.tap('.sky-talk', { position: { x: 30, y: 30 } }).catch(() => {});
        await page.waitForTimeout(talk.typing ? 40 : 120);
        continue;
      }
      if (d && d.over) { await page.waitForTimeout(300); continue; }
      if (bark && d && !seen.has('bark' + d.step + d.phase + d.vil)) { seen.add('bark' + d.step + d.phase + d.vil); await page.waitForTimeout(500); await shot(`s${st}-bark`); }
      // 무전창이 떠 있으면 실제 시간에 가깝게 (대사가 보일 시간을 줌), 아니면 빠르게
      await page.evaluate((b) => window.__sky.sim(b ? 0.12 : 1.5), bark);
      await page.waitForTimeout(bark ? 90 : 20);
    }
    // 대사 검증: 열린 대화 키 순서대로 기대 대사를 만들고, 실제로 화면에 보인 대사와 비교
    const chk = await page.evaluate(({ st, fam, from }) => {
      const keys = (window.__talkKeys || []).filter((k) => k.startsWith(`S${st}:`)).map((k) => k.split(':')[1]);
      const exp = keys.flatMap((k) => window.__skyExpected(st, k, fam));
      const endT = new Set(window.__skyEndingExpected || []); // 엔딩 대사는 엔딩 검증에서
      const raw = (window.__talkSeen || []).slice(from).filter((x) => !endT.has(x.text));
      const seenL = raw.filter((x, i) => !(i > 0 && raw[i - 1].text === x.text && raw[i - 1].mode === x.mode));
      const cmp = (m) => {
        const e = exp.filter((x) => x.mode === m).map((x) => x.text);
        // 무전창: 정지 대화가 시작돼 버려진 줄(drop)도 '처리됨'으로 셈 (화면에는 안 나오는 것이 맞음)
        const g = seenL.filter((x) => x.mode === m || (m === 'bark' && x.mode === 'drop')).map((x) => x.text);
        const miss = e.filter((t) => !g.includes(t));
        const order = miss.length === 0 && e.every((t, i) => g[i] === t);
        return { n: e.length, shown: g.length, miss, order };
      };
      return { keys, talk: cmp('talk'), bark: cmp('bark'), dropped: seenL.filter((x) => x.mode === 'drop').length, lines: seenL.map((x) => `${x.mode === 'talk' ? '■' : x.mode === 'drop' ? '×' : '·'} ${x.name || '(해설)'}: ${x.text}`) };
    }, { st, fam: FAM, from });
    log.push(...chk.lines.map((l) => `S${st} ${l}`));
    log.push(`S${st} 검증: 열린 키 ${chk.keys.length}개 [${chk.keys.join(' ')}] · 정지 대화 ${chk.talk.shown}/${chk.talk.n} 순서 ${chk.talk.order ? 'OK' : '틀림'} · 무전창 ${chk.bark.shown}/${chk.bark.n} 순서 ${chk.bark.order ? 'OK' : '틀림'} (보스 대화로 생략 ${chk.dropped}줄)` + (chk.talk.miss.length + chk.bark.miss.length ? ` · 누락 ${JSON.stringify([...chk.talk.miss, ...chk.bark.miss])}` : ''));
    await shot(`s${st}-clear`);
    if (st < s1) {
      fromIdx = await page.evaluate(() => (window.__talkSeen || []).length);
      await page.waitForSelector('.tally .sky-btn-go', { timeout: 15000 });
      await page.tap('.tally .sky-btn-go');
      await page.waitForTimeout(300);
    }
  }
  // 최종 스테이지면 엔딩 → 크레딧까지 (장면마다 캡처 · 터치로 진행)
  if (s1 === 6) {
    await page.waitForSelector('.sky.end', { timeout: 20000 });
    const efrom = fromIdx; // 마지막 스테이지 시작 위치부터 찾아서 엔딩 첫 줄 위치를 정함
    const shotScene = new Set();
    for (let k = 0; k < 600; k++) {
      if (await page.$('.cred')) break;
      const cls = await page.evaluate(() => (document.querySelector('.sky.end')?.className || '').replace('sky end pe ', ''));
      if (!shotScene.has(cls)) { shotScene.add(cls); await page.waitForTimeout(900); await shot(`ending-${cls}`); }
      // 엔딩은 자동으로 넘어감 — 터치하지 않고 실제 시간 그대로 (타이밍 측정)
      await page.waitForTimeout(150);
    }
    const ech = await page.evaluate((efrom) => {
      const exp = window.__skyEndingExpected || [];
      const all = (window.__talkSeen || []).slice(efrom).map((x) => x.text);
      const st0 = all.indexOf(exp[0]);
      const raw = (st0 >= 0 ? all.slice(st0) : all.filter((t) => exp.includes(t))).filter((t, i, arr) => !(i > 0 && arr[i - 1] === t));
      return { exp: exp.length, shown: raw.length, order: exp.every((t, i) => raw[i] === t), miss: exp.filter((t) => !raw.includes(t)), lines: raw };
    }, efrom);
    log.push(...ech.lines.map((l) => `ENDING ${l}`));
    log.push(`ENDING 검증: ${ech.shown}/${ech.exp} 순서 ${ech.order ? 'OK' : '틀림'}` + (ech.miss.length ? ` · 누락 ${JSON.stringify(ech.miss)}` : ''));
    await page.waitForSelector('.cred', { timeout: 20000 });
    await page.waitForTimeout(800);
    await shot('credits');
    log.push('크레딧 도착');
  }
  log.push('열린 대화 키: ' + (await page.evaluate(() => (window.__talkKeys || []).join(' '))));
  fs.writeFileSync(`${out}/${tag}-log.txt`, log.join('\n'));
  console.log(log.join('\n'));
  console.log('실패 요청', bad.length ? bad : '없음', '· 콘솔 오류', errs.length ? errs : '없음');
  await b.close();
})();
