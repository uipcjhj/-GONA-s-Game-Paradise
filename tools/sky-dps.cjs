/* 가족별 실제 전투 수치 측정 (사람 플레이 대체 아님 — 고정 조건 비교용)
 *  - 고나는 가만히 있고, 가운데 위에 체력 무한 '가상 표적'을 세움
 *  - 30초 자동 사격(일반 공격 · 동료 공격) 의 DPS · 명중률 측정
 *  - 차지 공격 5회(1.0초 충전) 의 발당 피해 · 발사 간격 측정
 *  사용: NODE_PATH=$(npm root -g) node tools/sky-dps.cjs <url> [family ...]
 *  url 예: http://localhost:8766/?skytest  (npx vite build --outDir dist-test 후 python3 -m http.server 8766 -d dist-test)
 */
const { chromium } = require('playwright');
const [url, ...fams] = process.argv.slice(2);
const FAMS = fams.length ? fams : ['mom', 'dad', 'imo', 'halmeoni', 'halabeoji', 'samchon'];
(async () => {
  const b = await chromium.launch();
  const out = [];
  for (const fam of FAMS) {
    const ctx = await b.newContext({ viewport: { width: 393, height: 636 }, deviceScaleFactor: 1 });
    await ctx.addInitScript(([f, ns]) => { try { localStorage.setItem(ns + '.fam', f); } catch (e) { /* */ } }, [fam, process.env.SKY_NS || 'gona.sky']);
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(url);
    await page.waitForSelector('.ttl-start', { timeout: 60000 });
    await page.evaluate(() => window.__skyFlow.start(1, 'normal'));
    await page.waitForFunction(() => window.__sky && document.querySelector('.sky-canvas'), null, { timeout: 30000 });
    const r = await page.evaluate(() => {
      const s = window.__sky;
      cancelAnimationFrame(s.raf); // 실제 루프 정지 → sim 으로만 진행
      s.cheat('god');
      s.en.length = 0; s.eb.length = 0; s.stepIdx = s.st.script.length; s.spawnQ.length = 0; s.block = 'none';
      s.px = 90; s.py = 260; s.cx = 90; s.cy = 250; s.gauge = 0; // 고나 고정
      // 표적 A: 고나 바로 위 · 표적 B: 동료 위치 (동료는 고나 오른쪽 32px)
      const dmgBy = {}; let dealt = 0; const tg = [];
      const origDamage = s.damage.bind(s);
      s.damage = (e, d, src, hx, hy) => { const k = tg.indexOf(e); if (k >= 0) { dmgBy[src] = (dmgBy[src] || 0) + d; dealt += d; } return origDamage(e, d, src, hx, hy); };
      const shotsBy = {}; const origNew = s.newPB.bind(s);
      s.newPB = (...a) => { shotsBy[a[6]] = (shotsBy[a[6]] || 0) + 1; return origNew(...a); };
      for (const x of [90, 122]) {
        s.spawnEnemy('gunship', x, 'hold', 1, tg.length, 60);
        const e = s.en[s.en.length - 1]; e.hp = 1e9; e.max = 1e9; e.score = 0; tg.push(e);
      }
      const dummyHP0 = tg.map((e) => e.hp);
      // 표적이 화면을 떠나면 같은 자리에 다시 세움 (측정 중 항상 표적 1개씩 살아 있게)
      // 표적은 한 객체로 고정: 매 1/60초마다 자리·체력을 되돌림 (재생성하면 한 탄이 두 번 맞는 측정 오류가 생김)
      const keep = (secs) => { const n = Math.round(secs * 60); for (let i = 0; i < n; i++) { s.sim(1 / 60); tg.forEach((e) => { if (!s.en.includes(e)) s.en.push(e); e.dead = false; e.y = 60; e.hp = 1e9; e.max = 1e9; }); } };
      // 1) 30초 자동 사격 (차지 없음)
      keep(30);
      const passive = { dps: dealt / 30, bySrc: Object.fromEntries(Object.entries(dmgBy).map(([k, v]) => [k, +(v / 30).toFixed(2)])), shots: { ...shotsBy }, dealt };
      // 2) 차지 5회 — 1.0초 충전 후 해제, 해제 후 1.2초 대기
      const before = dealt;
      const chargeHits = [];
      for (let i = 0; i < 5; i++) {
        // 대조 구간(무충전) 과 충전 구간의 차이 = 차지 공격이 준 피해 (동료·기본 사격은 두 구간에 똑같이 들어감)
        const c0 = dealt;
        keep(2.6);
        const control = dealt - c0;
        const d0 = dealt;
        s.setCharging(true); keep(1.0); s.setCharging(false); keep(1.6);
        const withCharge = dealt - d0;
        chargeHits.push(+(withCharge - control).toFixed(1));
        keep(0.4);
      }
      const chargeDmgTotal = dealt - before;
      const chargeMean = chargeHits.reduce((a, c) => a + c, 0) / chargeHits.length;
      // 차지 중에는 기본 사격이 멈추므로(1.0초), 그만큼 빠진 기본 사격 피해를 더해 '차지 1발의 순수 가치'로 환산
      const lostShot = (passive.bySrc.shot || 0) * 1.0;
      const netPerShot = chargeHits.map((v) => +(v + lostShot).toFixed(1));
      const netMean = +(netPerShot.reduce((a, c) => a + c, 0) / netPerShot.length).toFixed(1);
      return { passive, charge: { perShotDealt: chargeHits, mean: netMean, netPerShot, totalDealt: chargeDmgTotal }, fam: s.fam, hp: dummyHP0.map((h, i) => +(h - tg[i].hp).toFixed(1)) };
    });
    out.push({ fam, ...r });
    console.log(JSON.stringify({ fam, passiveDPS: +r.passive.dps.toFixed(2), bySrc: r.passive.bySrc, shots: r.passive.shots, chargeNetMean: r.charge.mean, chargeNetPerShot: r.charge.netPerShot, pageErrors: errs.length }));
    await ctx.close();
  }
  await b.close();
  require('fs').writeFileSync(process.env.DPS_OUT || '/tmp/claude-0/-home-user/16262a03-9c58-5b2c-97a5-6b326bb1ba41/scratchpad/dps.json', JSON.stringify(out, null, 1));
})();
