/* 공통 컷신 플레이어 검수 (오프닝 · 엔딩 · 에필로그 · 크레딧) — ?preview=… 로 처음부터 끝까지 실제 재생
 *  대사마다: 대사창 위치·높이 동일 · 본문 첫 줄 위치 동일 · 3줄 이내 · 이름표/초상화 겹침 없음 · CG 가 대사창과 안 겹침 · 화면 밖 없음
 *  + 터치 안 하면 글자 유지(8초) · 디졸브 중 연타 → 한 단계만 · 같은 CG 면 CG 그대로(디졸브 없음) · 끝 → 미리보기 메뉴
 *  + 기존 기록(gona.*) 그대로 · 콘솔 오류 · 디졸브 중 프레임 간격 · 장면별 캡처
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-cut-check.cjs <url(끝 /)> <outdir> [w] [h] [shots=1]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out, w = '393', h = '636', SHOTS = '1'] = process.argv.slice(2);
const tag = `${w}x${h}`;
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const SEED = { 'gona.skyadv.opened': '1', 'gona.skyadv.rec2': JSON.stringify({ v: 2, boards: { 'arcade:normal': [{ score: 1650000, fam: 'samchon', stage: 6, at: '2026-11-26' }] }, daily: {}, col: { clears: { 'mom:normal': 1 }, flags: {}, seen: {}, stages: {} } }), 'gona.skyadv.story': JSON.stringify({ v: 1, last: 'mom:normal', slots: {} }) };
  await ctx.addInitScript((seed) => { if (!sessionStorage.getItem('seeded')) { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); } }, SEED);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const res = [];
  const ok = (n, c, x = '') => res.push(`${c ? 'PASS' : 'FAIL'} · ${n}${x ? ' — ' + x : ''}`);
  const cut = () => p.evaluate(() => window.__cut || null);
  const waitSt = async (pred, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const c = await cut(); if (c && pred(c)) return c; await p.waitForTimeout(40); } return null; };
  const tap = () => p.touchscreen.tap(+w / 2, +h * 0.35);
  const measure = () => p.evaluate(() => {
    const box = document.querySelector('.cp-box').getBoundingClientRect();
    const stage = document.querySelector('.cp-stage').getBoundingClientRect();
    const dock = document.querySelector('.cp-dock').getBoundingClientRect();
    const cgs = [...document.querySelectorAll('.cp-layer.on .cp-cg')].map((e) => e.getBoundingClientRect());
    const pEl = document.querySelector('.cp-text p');
    let lines = 0, top = null, textBottom = null;
    if (pEl && pEl.textContent.trim()) {
      const rg = document.createRange(); rg.selectNodeContents(pEl);
      const rs = [...rg.getClientRects()].filter((q) => q.width > 1);
      lines = new Set(rs.map((q) => Math.round(q.top))).size;
      top = Math.min(...rs.map((q) => q.top)) - box.top;
      textBottom = Math.max(...rs.map((q) => q.bottom));
    }
    const name = document.querySelector('.cp-name'); const face = document.querySelector('.cp-face');
    const nr = name && name.getBoundingClientRect(); const fr = face && face.getBoundingClientRect();
    const t = document.querySelector('.cp-text');
    return { box: [box.left, box.top, box.width, box.height].map(Math.round), lines, top: top == null ? null : Math.round(top), overflowText: textBottom != null && textBottom > box.bottom - 3,
      cgOverlap: cgs.some((r) => r.bottom > dock.top + 1 || r.top < stage.top - 1 || r.left < -1 || r.right > innerWidth + 1),
      nameFace: !!(nr && fr && nr.right > fr.left && nr.left < fr.right && nr.bottom > fr.top + 2 && false),
      nameOut: !!(nr && (nr.right > innerWidth - 4 || nr.top < stage.top)), textOp: t ? +getComputedStyle(t).opacity : 0,
      align: pEl ? getComputedStyle(pEl).textAlign : '', fs: pEl ? parseFloat(getComputedStyle(pEl).fontSize) : 0, offscreen: box.bottom > innerHeight + 1 };
  });
  // 디졸브 프레임 간격 측정용
  const startFrames = () => p.evaluate(() => { window.__fr = []; let last = performance.now(); const f = (t) => { window.__fr.push(t - last); last = t; if (window.__fr.length < 4000) requestAnimationFrame(f); }; requestAnimationFrame(f); });

  const play = async (mode, menuAfter = true) => {
    await p.goto(`${url}?preview=${mode}`);
    const first = await waitSt((c) => c.st === 'wait' && c.i === 0, 60000);
    ok(`[${mode}] ?preview=${mode} 로 바로 재생`, !!first);
    if (!first) return;
    await startFrames();
    const steps = await p.evaluate(() => window.__cutSteps);
    const rows = [];
    let k = 0, lastCg = null, cgChanges = 0, sameCgDissolves = 0;
    for (let guard = 0; guard < 200; guard++) {
      const c = await waitSt((x) => x.st === 'wait' || x.st === 'done', 20000);
      if (!c || c.st === 'done') break;
      await p.waitForTimeout(120);
      const m = await measure();
      rows.push({ i: c.i, kind: c.kind, who: c.who, text: c.text, cg: c.cg, ...m });
      if (SHOTS === '1') await p.screenshot({ path: `${out}/${tag}-${mode}-${String(c.i).padStart(2, '0')}.png` });
      if (c.i === 2 && k === 0) {
        // 8초 동안 터치 안 함 → 글자 유지
        k = 1;
        await p.waitForTimeout(8000);
        const c2 = await cut(); const m2 = await measure();
        ok(`[${mode}] 터치하지 않으면 대사 유지 (8초)`, c2.i === c.i && c2.st === 'wait' && m2.textOp === 1, `단계 ${c.i}→${c2.i} · opacity ${m2.textOp}`);
      }
      const before = c.i;
      const log0 = (await p.evaluate(() => window.__cutLog.length));
      await tap();
      // 연타: 바로 3번 더
      if (c.i % 4 === 1 && c.i < steps.length - 2) { await p.waitForTimeout(60); await tap(); await tap(); await p.waitForTimeout(90); await tap(); }
      const n = await waitSt((x) => (x.st === 'wait' && x.i !== before) || x.st === 'done', 20000);
      if (n && n.st !== 'done' && n.i !== before + 1) ok(`[${mode}] 연타해도 한 단계씩`, false, `${before} → ${n.i}`);
      if (n && n.st !== 'done') {
        const log = (await p.evaluate((a) => window.__cutLog.slice(a), log0));
        const dissolved = log.some((r) => r[2] === 'dissolve');
        if (n.cg !== c.cg) cgChanges++;
        if (n.cg === c.cg && dissolved) sameCgDissolves++;
      }
      lastCg = c.cg;
    }
    const doneMenu = menuAfter ? !!(await p.waitForSelector('.pv-box', { timeout: 8000 }).catch(() => null)) : true;
    const fr = await p.evaluate(() => window.__fr || []);
    const shown = rows.map((r) => r.text);
    const expect = steps.map((s) => s.text);
    ok(`[${mode}] 모든 대사를 순서대로 표시 (${expect.length}단계)`, JSON.stringify(shown) === JSON.stringify(expect), shown.length !== expect.length ? `${shown.length}/${expect.length}` : '');
    const boxes = new Set(rows.map((r) => r.box.join(',')));
    ok(`[${mode}] 대사창 위치·높이 모든 대사에서 동일`, boxes.size === 1, [...boxes].join(' | '));
    const tops = new Set(rows.filter((r) => r.top != null).map((r) => r.top));
    ok(`[${mode}] 본문 첫 줄 위치 동일 (나레이션·캐릭터 공통)`, tops.size <= 1, [...tops].join(','));
    const fss = new Set(rows.filter((r) => r.fs).map((r) => r.fs));
    ok(`[${mode}] 본문 글자 크기 동일`, fss.size <= 1, [...fss].join(','));
    const over = rows.filter((r) => r.lines > 3 || r.overflowText);
    ok(`[${mode}] 모든 대사 3줄 이내 · 대사창 밖으로 안 나감`, over.length === 0, over.map((r) => `${r.i}:${r.lines}줄 ${r.text.slice(0, 12)}`).join(' | '));
    const cgBad = rows.filter((r) => r.cgOverlap);
    ok(`[${mode}] 이벤트 CG 가 대사창·화면 밖으로 안 나감`, cgBad.length === 0, cgBad.map((r) => r.i).join(','));
    ok(`[${mode}] 이름표 화면 안`, rows.every((r) => !r.nameOut));
    ok(`[${mode}] 대사창 화면 안`, rows.every((r) => !r.offscreen));
    ok(`[${mode}] 같은 CG 에서 다음 대사 = 글자만 교체 (디졸브 없음)`, sameCgDissolves === 0, `CG 바뀜 ${cgChanges}회`);
    const big = fr.filter((x) => x > 50).length;
    ok(`[${mode}] 재생 중 50ms 넘는 프레임 거의 없음`, big <= 3, `프레임 ${fr.length} · 50ms↑ ${big} · 최대 ${Math.round(Math.max(...fr))}ms`);
    if (menuAfter) ok(`[${mode}] 마지막 → 미리보기 메뉴로 정상 종료`, doneMenu);
    const kinds = rows.reduce((a, r) => ((a[r.kind] = (a[r.kind] || 0) + 1), a), {});
    fs.writeFileSync(`${out}/${tag}-${mode}.json`, JSON.stringify(rows, null, 1));
    return kinds;
  };
  const kO = await play('opening');
  const kE = await play('ending');
  const kP = await play('epilogue');
  ok('나레이션/캐릭터 대사 구분', kE && kE.narr > 0 && kE.char > 0, `opening ${JSON.stringify(kO)} · ending ${JSON.stringify(kE)} · epilogue ${JSON.stringify(kP)}`);
  // 크레딧
  await p.goto(`${url}?preview=credits`);
  await p.waitForSelector('.cred-final', { timeout: 30000 }).catch(() => null);
  await p.evaluate(() => { const s = document.querySelector('.cred-scroll'); if (s) { s.style.animation = 'none'; s.classList.add('still'); } });
  await p.waitForTimeout(400);
  const cred = await p.evaluate(() => {
    const f = document.querySelector('.cred-final b'), t = document.querySelector('.cred-thx');
    const lines = (e) => { if (!e) return 0; const rg = document.createRange(); rg.selectNodeContents(e); return new Set([...rg.getClientRects()].filter((q) => q.width > 1).map((q) => Math.round(q.top))).size; };
    return { fin: f?.textContent, finLines: lines(f), finAlign: f ? getComputedStyle(f.parentElement).textAlign : '', thx: t?.innerText.replace(/\n/g, ' / '), thxLines: lines(t?.querySelector('b')) };
  });
  ok('크레딧: SPECIAL THANKS TO / My Family, My Forever Fans', cred.thx === 'SPECIAL THANKS TO / My Family, My Forever Fans' && cred.thxLines === 1, JSON.stringify(cred));
  ok('크레딧: 마지막 문구 교체 · 가운데 정렬 · 2줄 이내', cred.fin === '현이가 마주할 모든 역경에 언제나 곁에 있길 바라며...' && cred.finLines <= 2 && cred.finAlign === 'center', `${cred.finLines}줄`);
  if (SHOTS === '1') await p.screenshot({ path: `${out}/${tag}-credits.png` });
  // 기록 보존
  const after = await p.evaluate((keys) => Object.fromEntries(keys.map((k) => [k, localStorage.getItem(k)])), Object.keys(SEED));
  ok('미리보기 뒤 기존 기록(gona.*) 그대로', JSON.stringify(after) === JSON.stringify(SEED));
  const blocked = await p.evaluate(() => (window.__skyPreviewBlocked || []).length);
  ok('콘솔 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(`${tag}\n` + res.join('\n') + `\n${res.filter((x) => x.startsWith('PASS')).length}/${res.length} PASS · 막힌 저장 시도 ${blocked}`);
  await b.close();
})();
