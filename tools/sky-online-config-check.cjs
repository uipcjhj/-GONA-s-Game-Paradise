/* online-config.js 런타임 설정 검수: 비움 → 꺼짐 · 공개 키 → 켜짐 · 비밀 키(service_role · sb_secret_) → 꺼짐
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-online-config-check.cjs <url(끝 /)>
 */
const { chromium } = require('playwright');
const [url] = process.argv.slice(2);
const jwt = (role) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role, iss: 'supabase' })).toString('base64url')}.sig`;
(async () => {
  const b = await chromium.launch();
  const cases = [['비움', '', '', false], ['anon JWT', 'https://abc.supabase.co', jwt('anon'), true], ['sb_publishable', 'https://abc.supabase.co', 'sb_publishable_xyz', true], ['service_role JWT', 'https://abc.supabase.co', jwt('service_role'), false], ['sb_secret', 'https://abc.supabase.co', 'sb_secret_xyz', false]];
  for (const [n, u, k, want] of cases) {
    const ctx = await b.newContext({ viewport: { width: 393, height: 636 }, isMobile: true, hasTouch: true });
    await ctx.addInitScript(() => { localStorage.setItem('gona.skyadv.opened', '1'); localStorage.setItem('gona.skyadv.profiles', JSON.stringify({ v: 1, active: 'p1', list: [{ id: 'p1', nick: 'QA', created: '2026-11-26' }] })); });
    await ctx.route('**/online-config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: `window.SKY_ONLINE = ${JSON.stringify({ url: u, anonKey: k })};` }));
    await ctx.route('https://abc.supabase.co/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    const p = await ctx.newPage();
    await p.goto(url + '?skytest');
    await p.waitForSelector('.ttl-start', { timeout: 60000 });
    if (await p.waitForSelector('.nick-box', { timeout: 3000 }).catch(() => null)) { await p.fill('.nick-box input', 'QA'); await p.tap('.nick-box .sky-btn-go'); await p.waitForTimeout(300); }
    await p.tap('.ttl2-nick');
    await p.waitForSelector('.prof-box');
    const on = !!(await p.$('.prof-in[type=email]'));
    console.log(`${on === want ? 'PASS' : 'FAIL'} · ${n} → 온라인 ${on ? '켜짐' : '꺼짐'}`);
    await ctx.close();
  }
  await b.close();
})();
