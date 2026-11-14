#!/usr/bin/env node
/**
 * 홈탭 전 화면 UI 감사 (393×636 · 390×844): 프로필·랭킹·업적·도감·미션·출석·상점·설정·게임 결과 화면
 * 자동 점검: 가로 스크롤 · 화면 밖 요소 · 작은 터치 영역(<40px) · 잘린 글자 · 글자 겹침 · 스크롤 가능 여부 / 스크린샷(상단·하단)
 *   NODE_PATH=$(npm root -g) node tools/ui-audit.cjs <paradise-url> <backup.json> <out-dir>
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const [url = 'http://localhost:8090/-GONA-s-Game-Paradise/?dev', backup = 'shots-rc/backup_393x636.json', out = 'shots-ui'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const report = [];
const metrics = () => {
  const vw = innerWidth;
  const issues = [];
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'; };
  const lab = (e) => (e.innerText || e.getAttribute('aria-label') || e.className || e.tagName).toString().replace(/\s+/g, ' ').slice(0, 24);
  if (document.documentElement.scrollWidth > vw || document.body.scrollWidth > vw) issues.push({ k: 'h-scroll', sw: document.documentElement.scrollWidth, vw });
  document.querySelectorAll('button,a,[role=tab],[role=switch],[role=radio],input:not([type=file]),select').forEach((e) => {
    if (!vis(e)) return;
    const r = e.getBoundingClientRect();
    const scp = e.closest('.p-scroll');
    const sr = scp && scp.getBoundingClientRect();
    const strp = e.closest('.p-tabs');
    const strr = strp && strp.getBoundingClientRect();
    const partial = (sr && (r.top < sr.top - 0.5 || r.bottom > sr.bottom + 0.5)) || (strr && (r.left < strr.left - 0.5 || r.right > strr.right + 0.5)); // 스크롤 영역 가장자리에 걸려 일부만 보이는 컨트롤은 판정 제외
    const ccx = r.left + r.width / 2, ccy = r.top + r.height / 2;
    const ct = (ccx >= 0 && ccy >= 0 && ccx <= innerWidth && ccy <= innerHeight) ? document.elementFromPoint(ccx, ccy) : null;
    const covered = !ct || !(ct === e || e.contains(ct)); // 화면 밖(가로 스크롤 줄)이거나 다른 층(결과 화면 등)에 덮인 컨트롤은 판정 제외
    if (!partial && !covered && Math.min(r.width, r.height) < 44) {
      // 실제 눌림 영역: 중심 기준 ±40px 를 2px 간격으로 훑어 같은 버튼으로 해석되는 길이(투명 확장 영역 포함)가 44px 이상인지
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const mine = (x, y) => { x = Math.min(Math.max(x, 0), innerWidth - 1); y = Math.min(Math.max(y, 0), innerHeight - 1); const t = document.elementFromPoint(x, y); return !!t && (t === e || e.contains(t)); };
      let nx = 0, ny = 0;
      for (let d = -40; d <= 40; d += 2) { if (mine(cx + d, cy)) nx += 2; if (mine(cx, cy + d)) ny += 2; }
      const hit = nx >= 42 && ny >= 42;
      if (!hit) issues.push({ k: 'small-target', t: lab(e), w: Math.round(r.width), h: Math.round(r.height), nx, ny });
    }
    const st = e.closest('[role=tablist], .p-tabs');
    if ((r.right > vw + 1 || r.left < -1) && !(st && getComputedStyle(st).overflowX !== 'visible')) issues.push({ k: 'offscreen-x', t: lab(e), l: Math.round(r.left), r: Math.round(r.right) });
  });
  const leaves = [];
  document.querySelectorAll('body *').forEach((e) => {
    if (!vis(e) || e.closest('.p-ntoast, .p-lvup')) return; // 일시적 알림은 겹침 판정 제외
    const own = [...e.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join('');
    if (!own) return;
    const cs = getComputedStyle(e);
    if (e.scrollWidth > e.clientWidth + 1 && cs.overflowX !== 'visible' && e.clientWidth > 0) issues.push({ k: 'text-clipped', t: lab(e), sw: e.scrollWidth, cw: e.clientWidth });
    const r = e.getBoundingClientRect();
    // 스크롤 영역 안의 글자는 스크롤 영역에 잘린 보이는 부분만 비교(가려진 글자는 겹침으로 보지 않음)
    const sc0 = e.closest('.p-scroll');
    let rr = r;
    if (sc0) {
      const s0 = sc0.getBoundingClientRect();
      rr = { left: Math.max(r.left, s0.left), right: Math.min(r.right, s0.right), top: Math.max(r.top, s0.top), bottom: Math.min(r.bottom, s0.bottom) };
      rr.width = rr.right - rr.left; rr.height = rr.bottom - rr.top;
      if (rr.width <= 0 || rr.height <= 0) return;
    }
    // 가로로 넘기는 탭 줄(overflow-x 스크롤) 안에서 화면 밖에 있는 항목은 정상
    const strip = e.closest('[role=tablist], .p-tabs');
    if (strip && getComputedStyle(strip).overflowX !== 'visible' && (r.right > vw + 1 || r.left < -1)) { leaves.push({ e, r: rr, own, strip: true }); return; }
    const lc = document.elementFromPoint(Math.min(Math.max(rr.left + rr.width / 2, 0), innerWidth - 1), Math.min(Math.max(rr.top + rr.height / 2, 0), innerHeight - 1));
    if (lc && !(lc === e || e.contains(lc) || lc.contains(e))) return; // 다른 층(결과 화면 등)에 덮여 보이지 않는 글자는 제외
    leaves.push({ e, r: rr, own });
  });
  // 글자 겹침: 서로 포함 관계가 아닌 글자 요소끼리 겹치는 면적이 작은 쪽의 35% 이상
  const scroller = document.querySelector('.p-scroll');
  const vh = innerHeight;
  const inView = leaves.filter((l) => l.r.bottom > 0 && l.r.top < vh);
  for (let i = 0; i < inView.length; i++) for (let j = i + 1; j < inView.length; j++) {
    const a = inView[i], b = inView[j];
    if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
    const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
    const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (ox > 2 && oy > 2) {
      const small = Math.min(a.r.width * a.r.height, b.r.width * b.r.height);
      if (ox * oy > small * 0.35) issues.push({ k: 'text-overlap', a: a.own.slice(0, 14), b: b.own.slice(0, 14) });
    }
  }
  const sc = scroller ? { scrollable: scroller.scrollHeight > scroller.clientHeight + 2, sh: scroller.scrollHeight, ch: scroller.clientHeight } : null;
  return { issues, sc };
};
async function audit(page, tag, name) {
  await page.waitForTimeout(450);
  const m = await page.evaluate(metrics);
  await page.screenshot({ path: path.join(out, `${name}_${tag}.png`) });
  let bottom = false;
  if (m.sc && m.sc.scrollable) {
    await page.evaluate(() => { const s = document.querySelector('.p-scroll'); s.scrollTop = s.scrollHeight; });
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(out, `${name}_${tag}_bottom.png`) });
    const m2 = await page.evaluate(metrics);
    for (const i of m2.issues) if (!m.issues.some((x) => JSON.stringify(x) === JSON.stringify(i))) m.issues.push(i);
    await page.evaluate(() => { const s = document.querySelector('.p-scroll'); s.scrollTop = 0; });
    bottom = true;
  }
  const uniq = [...new Map(m.issues.map((i) => [JSON.stringify(i), i])).values()];
  report.push({ tag, name, scrollable: !!(m.sc && m.sc.scrollable), issues: uniq });
  console.log(`${uniq.length ? 'WARN' : 'OK  '} [${tag}] ${name}${m.sc ? (m.sc.scrollable ? ' (스크롤 ' + m.sc.sh + '/' + m.sc.ch + ')' : '') : ''}${uniq.length ? '\n   ' + uniq.map((i) => JSON.stringify(i)).join('\n   ') : ''}`);
}
(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of [[393, 636], [390, 844]]) {
    const tag = `${w}x${h}`;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await ctx.addInitScript(() => { try { localStorage.setItem('gona.openingSeen', '1'); } catch (e) {} });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
    await page.goto(url);
    await page.waitForSelector('.title');
    await page.touchscreen.tap(w / 2, h / 2);
    if (process.env.SEED_FROM_BACKUP) {
      // 복원 버튼이 없는 이전 빌드(비교용): 백업의 플레이어를 저장소에 직접 넣고 새로고침
      const pl = JSON.parse(fs.readFileSync(backup, 'utf8')).player;
      await page.evaluate((pl) => localStorage.setItem('gp.v1.player', JSON.stringify(pl)), pl);
      await page.reload(); await page.waitForSelector('.title, .hit'); if (await page.locator('.title').count()) await page.touchscreen.tap(w / 2, h / 2);
    } else {
      await audit(page, tag, '00-register');
      await page.locator('input[type=file]').setInputFiles(backup);
    }
    await page.waitForSelector('.hit');
    for (let i = 0; i < 20 && (await page.locator('.p-lvup, .p-ntoast').count()); i++) { await page.locator('.p-lvup, .p-ntoast').first().click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(100); }
    await audit(page, tag, '01-map');
    await page.getByRole('button', { name: /PROFILE/ }).tap(); await page.waitForSelector('.p-pcard');
    await audit(page, tag, '02-profile');
    await page.getByRole('button', { name: /RANKING/ }).tap(); await page.waitForSelector('.p-tabs');
    await audit(page, tag, '03-ranking-food');
    await page.getByRole('tab', { name: /역대/ }).tap();
    await page.getByRole('tab', { name: '종합' }).tap();
    await audit(page, tag, '04-ranking-overall');
    for (const [i, label] of [['05', '업적'], ['06', '도감'], ['07', '미션'], ['08', '출석'], ['09', '상점'], ['10', '설정']]) {
      await page.getByRole('button', { name: /MORE/ }).tap();
      await page.getByRole('button', { name: new RegExp(label) }).first().tap();
      await audit(page, tag, `${i}-${label}`);
    }
    // 게임 결과 화면 (클리어 · 신기록 · 레벨업 · 업적)
    await page.getByRole('button', { name: /WORLD/ }).tap().catch(() => {});
    await page.waitForSelector('.hit');
    await page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('gp.v1.player')); const now = Date.now(); const sid = 'sess-ui-audit-001'; const rid = 'rid-ui-audit-0001';
      localStorage.setItem('gp.v1.session.' + sid, JSON.stringify({ version: 1, sessionId: sid, gameId: 'food-island', playerId: p.playerId, startedAt: new Date(now - 900000).toISOString(), expiresAt: new Date(now + 43200000).toISOString(), returnUrl: location.href }));
      localStorage.setItem('gp.v1.inbox.' + rid, JSON.stringify({ kind: 'gp-result', v: 1, result: { resultId: rid, sessionId: sid, gameId: 'food-island', gameVersion: '1.0.0', scoreSchemaVersion: 1, outcome: 'cleared', score: 21000, stage: 4, stageLabel: '자이언트 곤룡 고나', startedAt: new Date(now - 700000).toISOString(), endedAt: new Date(now - 1000).toISOString(), durationMs: 690000, extra: { snacks: 90 } } }));
      window.dispatchEvent(new Event('pageshow'));
    });
    await page.waitForSelector('text=ADVENTURE CLEAR', { timeout: 8000 });
    await audit(page, tag, '11-result-clear');
    ok = errors.length === 0;
    console.log(`${ok ? 'OK  ' : 'WARN'} [${tag}] 콘솔 오류 ${errors.length}건 ${errors.slice(0, 2).join(' / ')}`);
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(out, 'ui-audit.json'), JSON.stringify(report, null, 1));
  const total = report.reduce((n, r) => n + r.issues.length, 0);
  console.log(`\n화면 ${report.length}개 · 경고 ${total}건`);
})().catch((e) => { console.error('FATAL', e.message); process.exit(2); });
