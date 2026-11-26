/* 한글 부제 '응가 대탈출 대작전' 타이틀 레터링: 폰트 윤곽(path) + SVG 층(입체 그림자 · 굵은 외곽 · 안쪽 테두리 · 그라데이션 · 하이라이트)
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-subtitle/make.cjs <glyphs.json> <outdir> [specimen]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const [gpath, out, mode] = process.argv.slice(2);
const G = JSON.parse(fs.readFileSync(gpath, 'utf8'));
const TEXT = '응가 대탈출 대작전';
/** 글자 배치: 크기 · 자간 · 아치(위로 휜 정도) · 글자별 기울기 · 통통 튀는 높이 */
function layout(font, { size = 120, track = 0, arc = 0, bounce = 0, space = 0.32, tilt = 0, skewX = 0 }) {
  const f = G[font];
  const k = size / f.upm;
  let x = 0;
  const items = [];
  [...TEXT].forEach((ch, i) => {
    if (ch === ' ') { x += size * space; return; }
    const g = f.glyphs[ch];
    items.push({ ch, d: g.d, x, w: g.adv * k, i });
    x += g.adv * k + track;
  });
  const W = x - track;
  return items.map((it) => {
    const cx = it.x + it.w / 2;
    const u = (cx - W / 2) / (W / 2);                     // -1 … 1
    const dy = arc * (u * u) + (bounce ? (it.i % 2 ? bounce : -bounce) : 0);
    const rot = (arc ? (u * arc) / 9 : 0) + (tilt ? [-1, 0.6, -0.4, 1, -0.7, 0.5, -1, 0.8][it.i % 8] * tilt : 0);
    return { ...it, t: `translate(${it.x.toFixed(1)} ${dy.toFixed(1)}) rotate(${rot.toFixed(2)} ${(it.w / 2).toFixed(1)} ${(size * 0.5).toFixed(1)}) scale(${k})${skewX ? ` skewX(${skewX})` : ''}` };
  }).concat([{ W, H: size }]);
}
function svg(name, font, o) {
  const L = layout(font, o);
  const { W, H } = L.pop();
  const pad = (o.outer ?? 10) + (o.depth ?? 6) + 16;
  const glyphs = (attrs) => L.map((g) => `<path transform="${g.t}" d="${g.d}" ${attrs}/>`).join('');
  const grad = o.fill.map((c, i) => `<stop offset="${(i / (o.fill.length - 1)) * 100}%" stop-color="${c}"/>`).join('');
  const ext = [];
  for (let d = o.depth; d >= 1; d -= 1) ext.push(`<g transform="translate(${(o.skew ?? 0) * d} ${d})">${glyphs(`fill="${o.ext}" stroke="${o.ext}" stroke-width="${o.outer * 2}" stroke-linejoin="round"`)}</g>`);
  const orn = o.orn ? `<g fill="${o.orn}" stroke="${o.outerCol}" stroke-width="4" stroke-linejoin="round">
      <path transform="translate(${-pad - 24} ${H * 0.5})" d="M0 0 L14 -8 L28 0 L14 8 Z"/><path transform="translate(${W + pad - 4} ${H * 0.5})" d="M0 0 L14 -8 L28 0 L14 8 Z"/></g>` : '';
  const py = -o.outer - 2, ph = H + o.outer * 2 + (o.depth ?? 0) + 2, n = ph * 0.38, px = -pad + 4, pw = W + pad * 2 - 8;
  const plate = o.plate ? `<g stroke-linejoin="miter">
    <path d="M${px - n} ${py + ph / 2} L${px} ${py} L${px + pw} ${py} L${px + pw + n} ${py + ph / 2} L${px + pw} ${py + ph} L${px} ${py + ph} Z" transform="translate(0 6)" fill="#0a0618"/>
    <path d="M${px - n} ${py + ph / 2} L${px} ${py} L${px + pw} ${py} L${px + pw + n} ${py + ph / 2} L${px + pw} ${py + ph} L${px} ${py + ph} Z" fill="${o.plate[0]}" stroke="${o.plate[1]}" stroke-width="6"/>
    <path d="M${px + 8} ${py + 9} L${px + pw - 8} ${py + 9}" stroke="${o.plate[2]}" stroke-width="3"/>
    <path d="M${px + 8} ${py + ph - 9} L${px + pw - 8} ${py + ph - 9}" stroke="${o.plate[2]}" stroke-width="3" opacity="0.6"/></g>` : '';
  const hw = o.ring ? o.outer + 9 : o.outer + 7;
  const ringSvg = o.ring ? [0, o.depth].map((dy) => `<g transform="translate(0 ${dy})">${glyphs(`fill="${o.ring}" stroke="${o.ring}" stroke-width="${(hw + (o.ringW ?? 4)) * 2}" stroke-linejoin="round"`)}</g>`).join('') : '';
  const halo = o.halo ? [0, o.ring ? o.depth : 0].map((dy) => `<g transform="translate(0 ${dy})">${glyphs(`fill="${o.halo}" stroke="${o.halo}" stroke-width="${hw * 2}" stroke-linejoin="round"${o.ring ? '' : ' opacity="0.85"'}`)}</g>`).join('') : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad - (o.orn || o.plate ? 72 : 0)} ${-pad - Math.abs(o.arc ?? 0)} ${W + pad * 2 + (o.orn || o.plate ? 144 : 0)} ${H + pad * 2 + Math.abs(o.arc ?? 0) * 2 + (o.depth ?? 0)}" data-name="${name}">
  <defs><linearGradient id="f-${name}" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">${grad}</linearGradient>
  <linearGradient id="h-${name}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.75"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
  ${plate}
  ${orn}
  ${ringSvg}
  ${halo}
  ${ext.join('')}
  ${glyphs(`fill="${o.outerCol}" stroke="${o.outerCol}" stroke-width="${o.outer * 2}" stroke-linejoin="round"`)}
  ${o.inner ? glyphs(`fill="${o.innerCol}" stroke="${o.innerCol}" stroke-width="${(o.inner + (o.bold ?? 0)) * 2}" stroke-linejoin="round"`) : ''}
  ${L.map((g) => `<path transform="${g.t}" d="${g.d}" fill="url(#f-${name})"${o.bold ? ` stroke="url(#f-${name})" stroke-width="${o.bold * 2}" stroke-linejoin="round"` : ''}/>`).join('')}
  ${o.gloss ? L.map((g) => `<path transform="${g.t}" d="${g.d}" fill="url(#h-${name})"/>`).join('') : ''}
</svg>`;
}
const DESIGNS = {
  // 1 아케이드 금박: 굵은 고딕 · 금빛 그라데이션 · 붉은 갈색 입체 · 남색 외곽 (현재 영문 로고의 금테와 같은 결)
  K1: ['black-han-sans', { size: 120, track: 4, arc: 10, fill: ['#fffbe0', '#ffe066', '#ffb320', '#e06a10'], inner: 4, innerCol: '#7a2408', outer: 11, outerCol: '#1a1240', depth: 9, ext: '#3a0c18', gloss: true, plate: ['#1c1a5a', '#e8b53c', '#4a48a8'] }],
  // 2 하늘 구름: 통통한 글꼴 · 하늘색 그라데이션 · 흰 안쪽 테두리 · 남색 입체 (영문 SKY ADVENTURE 구름 글자와 짝)
  K2: ['bagel-fat-one', { size: 112, track: 2, arc: 8, fill: ['#ffffff', '#c8f0ff', '#62c0ff', '#2a6ee0'], inner: 5, innerCol: '#ffffff', outer: 12, outerCol: '#14185a', depth: 9, ext: '#0a0c38', gloss: true, halo: '#0a0820' }],
  // 3 말랑 레트로: 둥근 글꼴 · 크림→주황 · 진갈색 외곽 · 글자마다 통통 튀는 리듬 (귀여운 쪽)
  // 3 말랑 레트로 (F 로고 색 맞춤): 크림 → 노랑 → 금 → 호박 → 적갈 · 크림 테 · 진한 적갈 외곽·입체 · 적갈 명판 + 금테
  K3: ['jua', { size: 118, track: 3, bounce: 4, fill: ['#fffbe0', '#fce93f', '#f7b82e', '#df8227', '#a8400a'], inner: 3, innerCol: '#fbf2d2', outer: 10, outerCol: '#2f0601', depth: 8, ext: '#8a2106', gloss: true, plate: ['#5a0e04', '#f7b82e', '#8a2106'] }],
  // 4 판타지 명판체: 명조 계열 · 금빛 · 짙은 적갈색 외곽 · 양쪽 마름모 장식 (B/F 날개·왕관 문장과 짝)
  K4: ['song-myung', { size: 118, track: 6, arc: 0, fill: ['#fff8d8', '#ffd870', '#d08a28'], inner: 4, innerCol: '#3a0c10', outer: 10, outerCol: '#fff0b8', depth: 7, ext: '#2a0610', gloss: true, orn: '#ffd870', plate: ['#a01828', '#ffd870', '#d04050'] }],
  // 캘리그라피 시안 (명판 없음 · F 로고 색): 붓글씨 폰트 + 글자별 기울기 흔들림 · 두꺼운 적갈 외곽 · 입체
  // C1 붓글씨 (F + C1 확정 후 가독성 보강): 획 굵게(bold) · 밝은 노랑 위주 · 두꺼운 적갈 외곽 · 큰 입체 그림자 · 금색 테
  C1: ['east-sea-dokdo', { size: 150, track: 4, tilt: 3, bounce: 3, bold: 3, fill: ['#fffef2', '#fff27a', '#ffd23a', '#f7a62a', '#d8741a'], inner: 3, innerCol: '#fff6d0', outerCol: '#2f0601', ext: '#5a0e04', gloss: true, outer: 15, depth: 12, halo: '#2f0601', ring: '#f0b43a', ringW: 8 }],
  C2: ['dokdo', { size: 140, track: 0, tilt: 2.5, bounce: 3, fill: ['#fffbe0', '#fce93f', '#f7b82e', '#df8227', '#a8400a'], inner: 3, innerCol: '#fbf2d2', outerCol: '#2f0601', ext: '#8a2106', gloss: true, outer: 11, depth: 8, halo: '#2f0601', ring: '#e8a830' }],
  C3: ['nanum-brush-script', { size: 150, track: -4, tilt: 3, bounce: 4, fill: ['#fffbe0', '#fce93f', '#f7b82e', '#df8227', '#a8400a'], inner: 3, innerCol: '#fbf2d2', outerCol: '#2f0601', ext: '#8a2106', gloss: true, outer: 11, depth: 8, halo: '#2f0601', ring: '#e8a830' }],
  C4: ['yeon-sung', { size: 130, track: 2, tilt: 2, bounce: 3, fill: ['#fffbe0', '#fce93f', '#f7b82e', '#df8227', '#a8400a'], inner: 3, innerCol: '#fbf2d2', outerCol: '#2f0601', ext: '#8a2106', gloss: true, outer: 11, depth: 8, halo: '#2f0601', ring: '#e8a830' }],
  C5: ['black-and-white-picture', { size: 140, track: 0, tilt: 2.5, bounce: 3, fill: ['#fffbe0', '#fce93f', '#f7b82e', '#df8227', '#a8400a'], inner: 3, innerCol: '#fbf2d2', outerCol: '#2f0601', ext: '#8a2106', gloss: true, outer: 11, depth: 8, halo: '#2f0601', ring: '#e8a830' }],
  K5: ['do-hyeon', { size: 120, track: 4, arc: 8, fill: ['#ffffff', '#ffd6e6', '#ff6fa0'], inner: 4, innerCol: '#ffffff', outer: 11, outerCol: '#3a0a30', depth: 8, ext: '#1a0418', gloss: true }],
  K6: ['gugi', { size: 116, track: 4, arc: 8, fill: ['#fffbe0', '#9ff07a', '#3aa83a'], inner: 4, innerCol: '#ffffff', outer: 11, outerCol: '#0a2a10', depth: 8, ext: '#06180a', gloss: true }],
};
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ deviceScaleFactor: 1 });
  const only = process.argv[5] ? process.argv[5].split(',') : null;
  for (const [name, [font, o]] of Object.entries(DESIGNS)) {
    if (only && !only.includes(name)) continue;
    const s = svg(name, font, o);
    fs.writeFileSync(`${out}/${name}.svg`, s);
    await p.setContent(`<html><body style="margin:0;background:transparent">${s.replace('<svg ', '<svg width="1200" ')}</body></html>`);
    const el = await p.$('svg');
    await el.screenshot({ path: `${out}/${name}.png`, omitBackground: true });
  }
  await b.close();
})();
