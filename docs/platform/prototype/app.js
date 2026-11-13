/* GONA GONE WILD! 플랫폼 UI 시안 — 정적 프로토타입. 화면의 이름·점수·순위는 모두 '시안용 샘플'이며 실제 기록이 아닙니다.
   승인된 에셋(월드맵 이미지·고나 스프라이트)은 그대로 사용하고, 신규 이미지는 만들지 않았습니다. 빨간 점선 아바타(알·별)와 아이콘은 임시 도트입니다. */
const $ = (s, el = document) => el.querySelector(s);
const params = new URLSearchParams(location.search);
const CLEAN = params.has('clean');
if (CLEAN) $('#proto').remove();

/* ───────── 도트 아이콘 (임시 · 코드 도트) ───────── */
const PAL = { k: '#3b5ea8', i: '#3b1b5e', y: '#ffc21a', o: '#ff9a1c', g: '#5aa938', b: '#4aa3f0', p: '#ff8fb0', r: '#ec5048', w: '#ffffff', c: '#fff3d6', s: '#8c97b5' };
const ICON = {
  map: ['..........', '.kkkkkkkk.', '.kggkbbyk.', '.kgggkbbk.', '.kkgkkbkk.', '.kbbkkgggk', '.kbbbkggk.', '.kkkkkkkk.'],
  user: ['...kkkk...', '..kppppk..', '..kpkpkk..', '..kppppk..', '...kkkk...', '.kkgggggk.', '.kgggggggk', '.kkkkkkkk.'],
  trophy: ['.kkkkkkkk.', 'kykyyyyoky', 'kykyyyyoky', '.kkyyyokk.', '...kyok...', '....kk....', '...kyyk...', '..kkkkkk..'],
  more: ['..........', '..........', '.kk.kk.kk.', '.kk.kk.kk.', '..........', '..........'],
  coin: ['..kkkk..', '.kyyyyk.', 'kyyokyyk', 'kyyokyyk', 'kyyokyyk', 'kyyyyyyk', '.kyyyyk.', '..kkkk..'],
  star: ['....ii....', '...iyyi...', '.iiiyyiii.', 'iyyyyyyyyi', '.iyyyyyyi.', '..iyyyyi..', '.iyyiiyyi.', '.iii..iii.'],
  lock: ['...iiii...', '..i....i..', '..i....i..', '.iiiiiiii.', '.issssssi.', '.isssissi.', '.isssissi.', '.iiiiiiii.'],
  bell: ['....ii....', '..iiyyii..', '.iyyyyyyi.', '.iyyyyyyi.', '.iyyyyyyi.', 'iyyyyyyyyi', 'iiiiiiiiii', '....ii....'],
  gear: ['..k.kk.k..', '.kkkkkkkk.', 'kkyyyyyykk', '.kyykkyyk.', '.kyykkyyk.', 'kkyyyyyykk', '.kkkkkkkk.', '..k.kk.k..'],
  book: ['.kkkkkkkk.', 'kbbbkbbbk.', 'kbbbkbbbk.', 'kbbbkbbbk.', 'kbbbkbbbk.', 'kkkkkkkkk.'],
  shop: ['...kkkk...', '..k....k..', '.kkkkkkkk.', 'kpppppppk.', 'kpppyyppk.', 'kpppyyppk.', 'kpppppppk.', '.kkkkkkkk.'],
  list: ['.kkkkkkkk.', 'kccccccccK', 'kcgcckkkck', 'kcccccccck', 'kcgcckkkck', 'kcccccccck', 'kcgcckkkck', '.kkkkkkkk.'],
  egg: ['..iiii..', '.iwwwwi.', 'iwwwwwwi', 'iwgwwgwi', 'iwwwwwwi', 'iwwgwwwi', '.iwwwwi.', '..iiii..'],
  check: ['.........', '........g', '.......gg', 'g.....gg.', 'gg...gg..', '.gg.gg...', '..ggg....', '...g.....'],
  heart: ['.ii.ii.', 'irriirri'.slice(0, 7), 'irrrrri', 'irrrrri', '.irrri.', '..iri..', '...i...'],
};
function icon(name, px = 2) {
  const m = ICON[name]; const w = Math.max(...m.map((r) => r.length));
  const rects = m.flatMap((row, j) => [...row].map((ch, i) => (PAL[ch.toLowerCase()] && ch !== '.' ? `<rect x="${i}" y="${j}" width="1" height="1" fill="${PAL[ch === 'K' ? 'k' : ch]}"/>` : '')));
  return `<svg width="${w * px}" height="${m.length * px}" viewBox="0 0 ${w} ${m.length}" shape-rendering="crispEdges" aria-hidden="true">${rects.join('')}</svg>`;
}

/* ───────── 샘플 상태 ───────── */
const AV = {
  gona: { n: '고나', img: 'assets/gona.png' }, strawberry: { n: '딸기', img: 'assets/strawberry.png' }, cookie: { n: '쿠키', img: 'assets/cookie.png' },
  egg: { n: '알', ph: 'egg' }, star: { n: '별', ph: 'star' },
};
const S = {
  p: { nick: '고나짱', code: 'K7Q2', av: 'gona', lv: 7, xp: 340, next: 500, coins: 1280, title: '고나의 첫걸음', joined: '2026.11.13', frame: 'basic' },
  hud: 'B', net: false, demo: false, toast: '', modal: null, rankGame: 'food', rankPeriod: 'weekly', achTab: 'common', cxTab: '캐릭터', cxSel: null, shopTab: '아바타',
  set: { bgm: true, sfx: true, vib: true, reduce: false, vol: 70 },
  reg: { step: 1, nick: '', av: 'gona' },
  owned: { cookie: true, f_basic: true, f_leaf: false },
  claimed: {},
};
const GAMES = {
  food: { id: 'food', name: "GONA's Food Adventure", island: '푸드 아일랜드', tag: '간식을 먹으며 달리는 고나의 대모험!', open: true, hit: { x: 20, y: 225, w: 465, h: 435 }, crop: { x: 20, y: 225, s: 450 }, best: '12,400', stage: '3 / 4', clear: '미클리어', plays: 12, ach: 2 },
  sky: { id: 'sky', name: 'GONA Sky Battle', island: '스카이 배틀', tag: '세로 스크롤 슈팅 · 점수·스테이지·보스 기록 연동 예정', open: false, hit: { x: 520, y: 150, w: 545, h: 410 }, crop: { x: 560, y: 140, s: 460 } },
  mini: { id: 'mini', name: 'GONA Mini Game Land', island: '미니게임천국', tag: '미니게임별 최고 점수와 랭킹 · 종합 도전 기록 예정', open: false, hit: { x: 565, y: 800, w: 505, h: 480, clip: 'polygon(46% 0,100% 0,100% 100%,0 100%,0 40%,46% 29%)' }, crop: { x: 590, y: 800, s: 480 } },
};

/* ───────── 공통 조각 ───────── */
function av(id, px = 32, extra = '') {
  const a = AV[id];
  const inner = a.img ? `<img src="${a.img}" alt="">` : icon(a.ph === 'egg' ? 'egg' : 'star', 3);
  return `<span class="av ${a.img ? '' : 'ph'}" style="width:${px}px;height:${px}px" ${extra}>${inner}</span>`;
}
const xpPct = () => Math.round((S.p.xp / S.p.next) * 100);
const tab = (id, label, ic, on, pip) => `<button data-nav="${id}" class="${on ? 'on' : ''}">${icon(ic, 2)}<span>${label}</span>${pip ? '<i class="pip"></i>' : ''}</button>`;
function nav(cur) {
  return `<nav class="nav" aria-label="메뉴">${tab('world', 'WORLD', 'map', cur === 'world')}${S.hud === 'C' ? `<button data-nav="profile" class="${cur === 'profile' ? 'on' : ''}"><span class="navav">${av(S.p.av, 22)}<b>${S.p.lv}</b></span><span>PROFILE</span></button>` : tab('profile', 'PROFILE', 'user', cur === 'profile')}${tab('ranking', 'RANKING', 'trophy', cur === 'ranking')}${tab('more', 'MORE', 'more', ['achievements', 'codex', 'missions', 'shop', 'settings'].includes(cur), true)}</nav>`;
}
const STAR = `<svg class="star" viewBox="0 0 7 7" shape-rendering="crispEdges"><g fill="#ffd84a"><rect x="3" y="0" width="1" height="3"/><rect x="0" y="3" width="7" height="1"/><rect x="2" y="2" width="3" height="3"/></g></svg>`;
const pbtn = (full) => `<button class="pbtn" data-nav="profile" aria-label="프로필 열기">${av(S.p.av, 28)}<span class="meta"><span class="nm">${S.p.nick}</span><span class="lv">LV${S.p.lv}<span class="bar"><i style="width:${xpPct()}%"></i></span></span></span></button>`;
const pmini = () => `<button class="pbtn mini" data-nav="profile" aria-label="프로필 열기">${av(S.p.av, 28)}<span class="lvtag">LV${S.p.lv}</span></button>`;
const coinchip = () => `<div class="coinchip"><i class="c"></i>${S.p.coins.toLocaleString()}</div>`;
const header = () => S.hud === 'B' ? `<header class="top hudb">${pbtn()}<div class="logo"><h1>GONA GONE WILD!</h1><span class="ko">고나가 떴고나!</span></div>${coinchip()}</header>` : `<header class="top"><svg class="star" viewBox="0 0 7 7" shape-rendering="crispEdges"><g fill="#ffd84a"><rect x="3" y="0" width="1" height="3"/><rect x="0" y="3" width="7" height="1"/><rect x="2" y="2" width="3" height="3"/></g></svg><div class="logo"><h1>GONA GONE WILD!</h1><span class="ko">고나가 떴고나!</span></div><svg class="star" viewBox="0 0 7 7" shape-rendering="crispEdges"><g fill="#ffd84a"><rect x="3" y="0" width="1" height="3"/><rect x="0" y="3" width="7" height="1"/><rect x="2" y="2" width="3" height="3"/></g></svg></header>`;
const titlebar = (t, back = 'world') => `<div class="bar-title"><button class="back" data-nav="${back}" aria-label="뒤로">‹</button><h2>${t}</h2></div>`;
const wrapScreen = (cur, t, body, back) => `${titlebar(t, back)}<div class="screen"><div class="scroll">${body}</div></div>${nav(cur)}`;

/* ───────── 화면 ───────── */
function validNick(n) {
  const len = [...n].length;
  const okChars = /^[가-힣A-Za-z0-9]*$/.test(n);
  const okLen = len >= 2 && len <= 10;
  const okBad = !/(바보|멍청|씨발|fuck|shit)/i.test(n);
  return { okLen, okChars, okBad, ok: okLen && okChars && okBad && n.length > 0, len };
}
function screenRegister() {
  const r = S.reg; const v = validNick(r.nick);
  const slots = (n) => { const ch = [...n]; return `<div class="slots" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<i class="${i === ch.length ? 'cur' : ''}">${ch[i] || ''}</i>`).join('')}</div>`; };
  const steps = (k) => `<div class="steps"><i class="${k >= 1 ? 'on' : ''}">1</i><i class="${k >= 2 ? 'on' : ''}">2</i><i class="${k >= 3 ? 'on' : ''}">3</i></div>`;
  if (r.step === 3) {
    return `<div class="reg center">${steps(3)}<div class="ribbon2">WELCOME!</div>
      <div class="stagebox"><img class="hero-s hop" src="assets/gona.png" alt=""><i class="plat"></i></div>
      <div class="bubble">어서 와, <b>${r.nick || '고나짱'}</b>!<br>고나 게임천국에 온 걸 환영해!</div>
      <div class="idcard">${av(r.av, 44)}<div><b>${r.nick || '고나짱'}</b> <span class="chip blue">#K7Q2</span><div class="muted">LV 1 · 코인 0 · 기록 0</div></div></div>
      <button class="btn block big" data-nav="world">▶ START!</button><p class="muted">이 기기에 저장돼요. 기기를 바꾸거나 Safari 데이터를 지우면 기록이 사라질 수 있어요. 설정 &gt; 백업에서 보관하세요.</p></div>`;
  }
  const body = r.step === 1
    ? `<div class="ribbon2">NEW PLAYER</div><div class="hero2"><div class="stagebox sm"><img class="hero-s" src="assets/gona.png" alt=""><i class="plat"></i></div><div class="bubble">처음 왔구나!<br>이름을 알려줄래?</div></div>
       <div class="field"><label class="muted" for="nick">닉네임 · 한글·영문·숫자 2~10자</label><input id="nick" class="plate" value="${r.nick}" maxlength="12" autocomplete="off" placeholder="이름 입력">${slots(r.nick)}
       <div class="hint"><i class="${v.okLen ? 'ok' : r.nick ? 'bad' : ''}">${v.len}/10 · 2자 이상</i><i class="${v.okChars ? 'ok' : 'bad'}">공백·특수문자 없음</i><i class="${v.okBad ? 'ok' : 'bad'}">부적절한 표현 없음</i></div></div>
       <div class="panel"><div class="muted">같은 닉네임도 괜찮아요. 내 기록은 <b>내부 ID</b>로 구분하고, 랭킹엔 <b>#식별코드</b>가 함께 보여요. 이메일·비밀번호는 필요 없어요.</div></div>
       <button class="btn block big ${v.ok ? '' : 'off'}" data-act="regnext" ${v.ok ? '' : 'disabled'}>다음 ▶</button>`
    : `<div class="ribbon2">CHARACTER SELECT</div>
       <div class="pick"><div class="big-av">${av(r.av, 84)}<b>${r.nick}</b><span class="chip blue">#K7Q2</span></div>
       <div class="avs">${Object.keys(AV).map((k) => `<button data-act="regav" data-id="${k}" class="${r.av === k ? 'on' : ''}">${r.av === k ? '<em>▶</em>' : ''}${av(k, 40)}<span>${AV[k].n}</span>${AV[k].ph ? '<u>임시</u>' : ''}</button>`).join('')}</div></div>
       <p class="muted">알·별은 <b>임시 도트</b>(점선 표시)이며 정식 픽셀 에셋으로 교체 예정이에요. 아바타·닉네임은 나중에 바꿀 수 있어요.</p>
       <div class="row"><button class="btn sub" data-act="regback">◀ 이전</button><button class="btn big" style="flex:1" data-act="regdone">이걸로 결정!</button></div>`;
  return `<div class="reg">${steps(r.step)}${body}</div>`;
}

const hudHtml = () => `<div class="hud"><button class="badge" data-nav="profile" aria-label="프로필 열기">${av(S.p.av, 30)}<span class="meta"><span class="nm">${S.p.nick}</span><span class="lv">LV ${S.p.lv}<span class="bar"><i style="width:${xpPct()}%"></i></span></span></span></button>
  <div class="right"><div class="coin"><i class="c"></i>${S.p.coins.toLocaleString()}</div><button class="bell" data-nav="missions" aria-label="알림">${icon('bell', 2)}<i class="dot"></i></button></div></div>`;
function popupHtml(g) {
  const c = g.crop; const sz = 76; const k = sz / c.s;
  const thumb = `background-image:url(assets/gona-world-map.png);background-size:${1086 * k}px ${1448 * k}px;background-position:${-c.x * k}px ${-c.y * k}px`;
  const stats = g.open
    ? `<div class="stat"><b>${g.best}</b><span>내 최고점</span></div><div class="stat"><b>${g.stage}</b><span>최고 단계</span></div><div class="stat"><b>${g.plays}회</b><span>플레이</span></div><div class="stat"><b>${S.net ? '—' : '미연결'}</b><span>내 순위</span></div>`
    : `<div class="stat"><b>—</b><span>내 최고점</span></div><div class="stat"><b>—</b><span>최고 단계</span></div><div class="stat"><b>—</b><span>플레이</span></div><div class="stat"><b>—</b><span>내 순위</span></div>`;
  return `<section class="popup" aria-live="polite"><div class="thumb" style="${thumb}"></div><div><span class="chip ${g.open ? 'ok' : 'soon'}">${g.open ? '플레이 가능' : 'COMING SOON'}</span><h2 style="margin-top:4px">${g.name}</h2><div class="tag">${g.tag}</div>
    ${g.open ? `<div class="badges">${icon('star', 2)}${icon('star', 2)}<span class="muted" style="font-size:9px">업적 ${g.ach}개</span></div>` : ''}</div>
    <button class="x" data-act="closepop" aria-label="닫기">×</button><div class="stats">${stats}</div>
    <div class="acts">${g.open ? `<button class="btn" data-act="play">▶ PLAY</button>` : `<button class="btn off" disabled>${icon('lock', 2)} COMING SOON</button>`}<button class="btn sub" data-nav="ranking?g=${g.id}">랭킹</button></div></section>`;
}
function moreHtml() {
  const it = (id, ic, l, pip) => `<button data-nav="${id}">${icon(ic, 3)}<span>${l}</span>${pip ? '<i class="pip" style="right:6px;top:3px"></i>' : ''}</button>`;
  return `<div class="more panel"><h3>MORE <span class="sp"></span><button class="btn sm sub" data-act="closemore">닫기</button></h3><div class="grid">${it('achievements', 'star', '업적', 1)}${it('codex', 'book', '도감')}${it('missions', 'list', '미션', 1)}${it('shop', 'shop', '상점')}${it('settings', 'gear', '설정')}</div></div>`;
}
function screenWorld(q) {
  const isl = q.get('island');
  if (q.get('hud')) S.hud = q.get('hud');
  const ov = S.hud === 'A' ? `<div class="ovl l">${pmini()}</div><div class="ovl r">${coinchip()}</div>` : S.hud === 'C' ? `<div class="ovl r">${coinchip()}</div>` : '';
  return `${header()}<div class="stage">${ov}<div class="mapbox" id="mapbox"><div class="fit" id="fit"><div class="world" id="world"><img class="bg" src="assets/gona-world-map.png" alt="월드맵"><img class="gona" id="gona" src="assets/gona.png" alt="고나">
    ${Object.values(GAMES).map((g) => `<button class="hit ${isl === g.id ? 'sel' : ''}" data-act="island" data-id="${g.id}" aria-label="${g.island}" style="left:${g.hit.x}px;top:${g.hit.y}px;width:${g.hit.w}px;height:${g.hit.h}px;${g.hit.clip ? 'clip-path:' + g.hit.clip : ''}"></button>`).join('')}</div></div></div>
    ${isl ? popupHtml(GAMES[isl]) : ''}${q.get('more') ? moreHtml() : ''}</div>${nav(q.get('more') ? 'more' : 'world')}`;
}
function layoutWorld(q) {
  const box = $('#mapbox'); const fit = $('#fit'); const w = $('#world'); if (!box) return;
  const VIEW = { x: 10, y: 30, w: 1064, h: 1305 }; const W = box.clientWidth, H = box.clientHeight;
  const k = Math.min(W / VIEW.w, H / VIEW.h); const mw = VIEW.w * k, mh = VIEW.h * k;
  let top = Math.max(0, (H - mh) / 2);
  fit.style.cssText += `;width:${mw}px;height:${mh}px;left:${(W - mw) / 2}px;top:${top}px`;
  w.style.transform = `translate(${-VIEW.x * k}px, ${-VIEW.y * k}px) scale(${k})`;
  $('#gona').style.cssText += `;left:${545 - 54}px;top:${835 - 136}px`;
  const isl = q.get('island');
  if (isl) { // 팝업이 섬을 가리지 않도록 지도를 위로 밀어 올림
    const pop = $('.popup'); const g = GAMES[isl]; const cy = top + (g.hit.y + g.hit.h * 0.45 - VIEW.y) * k;
    const allow = H - (pop ? pop.offsetHeight : 180) - 30; const shift = Math.max(0, cy - allow);
    fit.style.transform = `translateY(${-Math.min(shift, 150)}px)`;
  }
}

function screenProfile() {
  const p = S.p;
  return wrapScreen('profile', 'PROFILE', `<div class="pcard"><div class="portrait">${av(p.av, 76)}<span class="lvbadge">LV<b>${p.lv}</b></span></div>
    <div class="info"><div class="nameplate"><b>${p.nick}</b><span class="chip blue">#${p.code}</span></div><div class="titleplate">${p.title}</div>
    <div class="xp"><span class="bar"><i style="width:${xpPct()}%"></i></span><small>${p.xp} / ${p.next} XP</small></div><div class="coinline"><i class="c"></i>${p.coins.toLocaleString()} <small>· ${p.joined} 시작</small></div></div></div>
    <div class="row cust"><button class="btn sm sub" data-act="edit" data-what="avatar">아바타</button><button class="btn sm sub" data-act="edit" data-what="nick">닉네임</button><button class="btn sm sub" data-act="edit" data-what="title">칭호</button><button class="btn sm sub" data-act="edit" data-what="frame">테두리</button></div>
    <div class="panel"><h3>플레이 통계 <span class="sp"></span><span class="chip">샘플</span></h3><div class="grid" style="grid-template-columns:repeat(3,1fr)"><div class="stat"><b>12</b><span>총 플레이</span></div><div class="stat"><b>1시간 8분</b><span>플레이 시간</span></div><div class="stat"><b>1 / 3</b><span>플레이한 게임</span></div></div></div>
    <div class="panel"><h3>게임별 기록</h3><div class="grid">${Object.values(GAMES).map((g) => `<div class="grow"><b>${g.island}</b>${g.open ? `<span class="chip gold">최고 ${g.best}</span><span class="chip">${g.stage}</span>` : '<span class="chip soon">COMING SOON</span>'}</div>`).join('')}</div></div>
    <div class="panel"><h3>업적 4 / 30 <span class="sp"></span><button class="btn sm sub" data-nav="achievements">보기</button></h3><div class="row">${icon('star', 3)}${icon('star', 3)}${icon('star', 3)}${icon('star', 3)}<span class="muted">· 이 기기에 저장됨 (온라인 미연결)</span></div></div>
    <div class="panel"><div class="row"><button class="btn sm off" disabled>이미지로 공유 (예정)</button><button class="btn sm sub" data-nav="settings">백업·복구</button></div></div>`);
}

const SAMPLE = [['예시닉 A', 'A1B2', 12400], ['예시닉 B', 'C3D4', 11800], ['예시닉 C', 'E5F6', 10950], ['예시닉 D', 'G7H8', 9300], ['예시닉 E', 'J9K1', 8800], ['예시닉 F', 'L2M3', 7100], ['예시닉 G', 'N4P5', 6600]];
function screenRanking(q) {
  const g = q.get('g'); if (g) S.rankGame = g; if (q.has('demo')) S.demo = q.get('demo') === '1';
  const tabs = [['food', 'Food'], ['sky', 'Sky'], ['mini', 'Mini'], ['all', '종합']];
  const open = S.rankGame === 'food';
  let body = `<div class="tabs">${tabs.map(([id, l]) => `<button data-act="rgame" data-id="${id}" class="${S.rankGame === id ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  if (S.rankGame !== 'all') body += `<div class="tabs"><button data-act="rper" data-id="weekly" class="${S.rankPeriod === 'weekly' ? 'on' : ''}">주간</button><button data-act="rper" data-id="all" class="${S.rankPeriod === 'all' ? 'on' : ''}">역대</button></div>`;
  body += `<div class="muted">${S.rankGame === 'all' ? '게임별 순위를 백분위 점수로 환산해 합산 (원점수 합산 아님 · 참가자 20명 미만 게임은 반영 보류)' : S.rankPeriod === 'weekly' ? '이번 주 11.09(월) 00:00 ~ 11.15(일) 23:59:59 (KST) · 종료까지 3일 4시간' : '게임 시작 이후 개인 최고 점수 · 같은 점수는 먼저 달성한 기록 우선'}</div>`;
  if (!open && S.rankGame !== 'all') body += `<div class="panel empty">${icon('lock', 4)}<b>COMING SOON</b><div class="muted">${S.rankGame === 'mini' ? '미니게임이 출시되면 미니게임별 세부 랭킹이 열려요.' : 'Sky Battle이 출시되면 랭킹이 열려요.'}</div></div>`;
  else if (!S.net && !S.demo) body += `<div class="panel empty">${icon('trophy', 5)}<b>온라인 랭킹 미연결</b><div class="muted">아직 온라인 랭킹 서버가 연결되지 않았어요. 연결되면 여기서 다른 플레이어와 겨룰 수 있어요.<br><b>가짜 순위는 보여주지 않아요.</b></div></div>
    <div class="panel"><h3>내 로컬 기록 (이 기기)</h3><div class="row">${av(S.p.av, 30)}<b style="flex:1">${S.p.nick} <span class="chip blue">#${S.p.code}</span></b><b>12,400</b></div></div><button class="btn block sub" data-act="demo">연결 후 화면 예시 보기 (시안)</button>`;
  else {
    body += `<div class="ribbon">시안 예시 화면 — 실제 순위·닉네임이 아닙니다</div><div class="lb-top3">${[1, 0, 2].map((i) => `<div class="p r${i + 1}"><span class="medal">${['1st', '2nd', '3rd'][i]}</span>${av(['strawberry', 'gona', 'cookie'][i], 36)}<b>${SAMPLE[i][0]}</b><span>#${SAMPLE[i][1]}</span><b>${SAMPLE[i][2].toLocaleString()}</b></div>`).join('')}</div>
      <div class="grid" style="gap:5px">${SAMPLE.slice(3).map((r, i) => `<div class="lbrow"><span class="rk">${i + 4}</span>${av(['egg', 'star', 'strawberry', 'cookie'][i], 28)}<span class="nm">${r[0]}<small>#${r[1]} · 11.1${i}</small></span><span class="sc">${r[2].toLocaleString()}</span></div>`).join('')}</div>`;
    body += `<div class="lbrow me" style="position:sticky;bottom:0"><span class="rk">42</span>${av(S.p.av, 28)}<span class="nm">${S.p.nick} (나)<small>#${S.p.code} · 오늘</small></span><span class="sc">12,400</span></div>`;
    body += `<div class="row"><button class="btn sm sub" style="flex:1" data-act="demo0">‹ 미연결 화면으로</button><button class="btn sm sub">↻ 새로고침</button></div>`;
  }
  return wrapScreen('ranking', 'RANKING', body);
}
const ACH = {
  common: [['고나의 첫걸음', '첫 게임 플레이', 1, 1, 30, '11.13'], ['모험의 시작', '첫 게임 클리어', 0, 1, 80], ['단골 공룡', '누적 10회 플레이', 12, 10, 50, '11.13'], ['게임 마스터', '여러 게임에서 최고 기록 달성', 1, 3, 150], ['전설의 고나', '고난도 업적 달성', 0, 1, 300]],
  food: [['첫 간식', '간식을 처음 먹기', 1, 1, 20, '11.13'], ['성장 단계 달성', '성장 3단계 달성', 3, 4, 60, '11.13'], ['보스 클리어', '뽀뽀괴물을 쓰러뜨리기', 0, 1, 100], ['엔딩 감상', '가족 엔딩 보기', 0, 1, 200]],
  sky: [['첫 보스 격파', 'COMING SOON', 0, 1, 100], ['노미스 클리어', 'COMING SOON', 0, 1, 200]],
  mini: [['첫 미니게임 승리', 'COMING SOON', 0, 1, 50], ['전체 미니게임 플레이', 'COMING SOON', 0, 1, 150]],
};
function screenAch() {
  const tabs = [['common', '공통'], ['food', 'Food'], ['sky', 'Sky'], ['mini', 'Mini']];
  const rows = ACH[S.achTab].map(([n, d, v, m, rw, dt]) => { const done = v >= m; return `<div class="ach ${done ? '' : 'lock'}"><div class="ic">${icon(done ? 'star' : 'lock', 3)}</div><div><b>${n}</b><p>${d}</p>${done ? `<span class="chip ok">달성 ${dt}</span>` : `<span class="row"><span class="bar"><i style="width:${Math.min(100, (v / m) * 100)}%"></i></span><span style="font-size:9px">${v}/${m}</span></span>`}</div><div class="rw">🪙 ${rw}${done ? `<br><button class="btn sm sub" style="margin-top:4px;min-height:28px" data-act="title" data-t="${n}">칭호</button>` : ''}</div></div>`; }).join('');
  return wrapScreen('achievements', 'ACHIEVEMENTS', `<div class="panel row"><b style="flex:1">달성 4 / 30</b><span class="bar" style="flex:2"><i style="width:13%"></i></span></div><div class="tabs">${tabs.map(([id, l]) => `<button data-act="atab" data-id="${id}" class="${S.achTab === id ? 'on' : ''}">${l}</button>`).join('')}</div>${rows}`);
}
const CX = { 캐릭터: [['고나', 'assets/gona.png', 1, '아기 공룡. 연두색 공룡 옷과 머리카락 한 가닥이 트레이드마크!'], ['???', null, 0]], 가족: [['???', null, 0], ['???', null, 0], ['???', null, 0]], 보스: [['뽀뽀괴물', null, 1, '쪽쪽! 뽀뽀로 괴롭히는 장난꾸러기'], ['킁카괴물', null, 0]], 몬스터: [['화학과안경잽이', null, 0], ['방구할배', null, 0]], 간식: [['딸기', 'assets/strawberry.png', 1, '10점. 달콤한 기본 간식'], ['바나나', 'assets/banana.png', 1, '20점'], ['쿠키', 'assets/cookie.png', 1, '30점'], ['별 젤리', null, 0]], 아이템: [['???', null, 0]], 특별: [['???', null, 0]] };
function screenCodex() {
  const list = CX[S.cxTab]; const sel = S.cxSel !== null ? list[S.cxSel] : null;
  const total = Object.values(CX).flat(); const got = total.filter((c) => c[2]).length;
  return wrapScreen('codex', 'CODEX 도감', `<div class="panel row"><b style="flex:1">수집률 ${got} / ${total.length}</b><span class="bar" style="flex:2"><i style="width:${(got / total.length) * 100}%"></i></span></div>
    <div class="tabs">${Object.keys(CX).map((t) => `<button data-act="ctab" data-id="${t}" class="${S.cxTab === t ? 'on' : ''}">${t}</button>`).join('')}</div>
    <div class="cx">${list.map((c, i) => c[2] ? `<button data-act="csel" data-i="${i}" class="${S.cxSel === i ? 'sel' : ''}">${c[1] ? `<img src="${c[1]}" alt="">` : icon('star', 5)}<span>${c[0]}</span></button>` : `<button class="lock" data-act="csel" data-i="${i}"><span class="q">?</span><span>미발견</span></button>`).join('')}</div>
    <div class="panel">${sel && sel[2] ? `<h3>${sel[0]} <span class="sp"></span><span class="chip ok">해금</span></h3><div class="muted">${sel[3] || ''}</div>` : `<div class="muted">${sel ? '게임 플레이 중 조건을 충족하면 해금돼요. 해금 시 작은 알림이 떠요.' : '카드를 눌러 설명을 확인하세요. 대표 이미지가 없는 항목은 게임 개발 시 실제 에셋으로 채웁니다.'}</div>`}</div>`);
}
const MSN = [['오늘 게임 1회 플레이', 1, 1, 20], ['게임 3회 플레이', 1, 3, 30], ['최고 점수 갱신', 0, 1, 40], ['서로 다른 게임 2종 플레이', 1, 2, 50]];
function screenMissions() {
  const days = [10, 15, 20, 25, 30, 40, 100];
  return wrapScreen('missions', 'MISSIONS 미션·출석', `<div class="panel"><h3>일일 미션 <span class="sp"></span><span class="chip blue">KST 00:00 초기화</span></h3><div class="grid" style="gap:6px">${MSN.map(([n, v, m, rw], i) => { const done = v >= m; const cl = S.claimed[i]; return `<div class="msn"><div><b>${n}</b><small>보상 🪙 ${rw} · XP ${rw / 2}</small><span class="row"><span class="bar"><i style="width:${(v / m) * 100}%"></i></span><span style="font-size:9px">${v}/${m}</span></span></div>${cl ? '<span class="chip ok">수령 완료</span>' : `<button class="btn sm ${done ? '' : 'off'}" ${done ? `data-act="claim" data-i="${i}"` : 'disabled'}>${done ? '받기' : '진행중'}</button>`}</div>`; }).join('')}</div></div>
    <div class="panel"><h3>출석 <span class="sp"></span><span class="chip gold">연속 3일</span></h3><div class="days">${days.map((c, i) => `<div class="${i < 2 ? 'done' : i === 2 ? 'today' : i === 6 ? 'big' : ''}">${i + 1}일<br>🪙${c}</div>`).join('')}</div><div class="muted" style="margin-top:6px">하루 첫 접속 보상 · 7일 연속 시 큰 보상. 온라인 미연결 단계에서는 <b>기기 시계 기준</b>이라 조작될 수 있어, 보상은 소액·가치 없는 게임 재화로만 설계해요.</div></div>`);
}
const SHOP = { 아바타: [['쿠키', 'cookie', 300], ['딸기', 'strawberry', 0], ['알', 'egg', 500]], 테두리: [['기본', 'f_basic', 0], ['잎사귀', 'f_leaf', 400], ['별빛', 'f_star', 800]], 칭호: [['단골 공룡', 't1', 200], ['간식 사냥꾼', 't2', 350], ['폴짝 대장', 't3', 500]], 배경: [['하늘', 'b1', 600], ['노을', 'b2', 600], ['밤바다', 'b3', 900]] };
function screenShop() {
  const items = SHOP[S.shopTab].map(([n, id, price]) => { const own = S.owned[id] || price === 0; return `<div class="item ${S.p.av === id ? 'eq' : ''}">${S.shopTab === '아바타' ? av(id, 44) : `<div class="frame-pv">${icon(S.shopTab === '칭호' ? 'star' : 'gear', 4)}</div>`}<span>${n}</span>${own ? `<button class="btn sm sub" style="min-height:28px" data-act="equip" data-id="${id}">${S.p.av === id ? '장착중' : '장착'}</button>` : `<button class="btn sm ${S.p.coins >= price ? '' : 'off'}" style="min-height:28px" ${S.p.coins >= price ? `data-act="buy" data-id="${id}" data-n="${n}" data-p="${price}"` : 'disabled'}>🪙 ${price}</button>`}</div>`; }).join('');
  return wrapScreen('shop', 'SHOP 상점', `<div class="panel row"><div class="coin" style="box-shadow:none"><i class="c"></i>${S.p.coins.toLocaleString()}</div><span class="muted" style="flex:1">무료 게임 코인 전용 · 현금 결제 없음 · 능력치 아이템 없음(꾸미기만)</span></div><div class="tabs">${Object.keys(SHOP).map((t) => `<button data-act="stab" data-id="${t}" class="${S.shopTab === t ? 'on' : ''}">${t}</button>`).join('')}</div><div class="items">${items}</div>`);
}
const tog = (k) => `<button class="toggle ${S.set[k] ? 'on' : ''}" data-act="tog" data-k="${k}" aria-pressed="${S.set[k]}"></button>`;
function screenSettings() {
  return wrapScreen('settings', 'SETTINGS 설정', `<div class="panel"><div class="setrow"><span>BGM</span>${tog('bgm')}</div><div class="setrow"><span>효과음</span>${tog('sfx')}</div><div class="setrow"><span>볼륨</span><input type="range" min="0" max="100" value="${S.set.vol}" data-act="vol"></div><div class="setrow"><span>진동</span>${tog('vib')}</div><div class="setrow"><span>애니메이션 줄이기</span>${tog('reduce')}</div><div class="muted">iPhone Safari는 첫 터치 이후에 소리가 나요.</div></div>
    <div class="panel"><div class="setrow"><span>닉네임</span><button class="btn sm sub" data-act="edit" data-what="nick">변경</button></div><div class="setrow"><span>아바타</span><button class="btn sm sub" data-act="edit" data-what="avatar">변경</button></div></div>
    <div class="panel"><h3>데이터 백업 · 복구</h3><div class="muted">기기를 바꾸거나 Safari 데이터를 지우면 기록이 사라질 수 있어요.</div><div class="row" style="margin-top:6px"><button class="btn sm sub" data-act="toast" data-t="시안: 백업 파일 내보내기">파일로 백업</button><button class="btn sm sub" data-act="toast" data-t="시안: 백업 파일 가져오기">가져오기</button></div><div class="row" style="margin-top:6px"><button class="btn sm off" disabled>비밀 복구 코드 (온라인 연결 후)</button></div></div>
    <div class="panel"><div class="setrow"><span>저장 데이터 초기화</span><button class="btn sm danger" data-act="reset">초기화</button></div><div class="setrow"><span>게임 정보</span><span class="muted">플랫폼 v0 시안 · 스키마 v1</span></div></div>`);
}

/* ───────── 라우터 · 이벤트 ───────── */
function parse() { const h = location.hash.slice(1) || 'world'; const [name, qs] = h.split('?'); return { name, q: new URLSearchParams(qs || '') }; }
const SCREENS = { register: screenRegister, world: screenWorld, profile: screenProfile, ranking: screenRanking, achievements: screenAch, codex: screenCodex, missions: screenMissions, shop: screenShop, settings: screenSettings };
function modalHtml() {
  const m = S.modal; if (!m) return '';
  let body = '';
  if (m.t === 'confirm') body = `<h3>${m.title}</h3><p class="muted">${m.text}</p><div class="row"><button class="btn sub" style="flex:1" data-act="mclose">취소</button><button class="btn ${m.danger ? 'danger' : ''}" style="flex:1" data-act="mok">${m.ok}</button></div>`;
  if (m.t === 'avatar') body = `<h3>아바타 변경</h3><div class="avs">${Object.keys(AV).filter((k) => k === 'gona' || k === 'strawberry' || k === 'egg' || k === 'star' || S.owned[k]).map((k) => `<button data-act="setav" data-id="${k}" class="${S.p.av === k ? 'on' : ''}">${av(k, 36)}<span>${AV[k].n}</span></button>`).join('')}</div><button class="btn sub block" style="margin-top:8px" data-act="mclose">닫기</button>`;
  if (m.t === 'nick') body = `<h3>닉네임 변경</h3><div class="field"><input id="nick2" value="${S.p.nick}" maxlength="12"><div class="hint"><i>기존 기록은 그대로 유지돼요</i></div></div><div class="row" style="margin-top:8px"><button class="btn sub" style="flex:1" data-act="mclose">취소</button><button class="btn" style="flex:1" data-act="savenick">저장</button></div>`;
  if (m.t === 'title') body = `<h3>대표 칭호</h3><div class="grid">${['고나의 첫걸음', '단골 공룡', '첫 간식'].map((t) => `<button class="btn sub block" data-act="title" data-t="${t}">${t}${S.p.title === t ? ' ✔' : ''}</button>`).join('')}</div>`;
  if (m.t === 'frame') body = `<h3>프로필 테두리</h3><p class="muted">상점에서 코인으로 구매한 테두리를 장착할 수 있어요.</p><button class="btn sub block" data-act="mclose">닫기</button>`;
  return `<div class="scrim" data-act="mclose"><div class="panel modal" onclick="event.stopPropagation()">${body}</div></div>`;
}
function render() {
  const { name, q } = parse(); if (q.get('hud')) S.hud = q.get('hud'); const fn = SCREENS[name] || screenWorld;
  $('#app').innerHTML = `${CLEAN ? '' : '<span class="sample">시안 · 샘플 데이터</span>'}${fn(q)}${S.toast ? `<div class="toast">${S.toast}</div>` : ''}${modalHtml()}`;
  if (name === 'world') requestAnimationFrame(() => layoutWorld(q));
  const ni = $('#nick'); if (ni) ni.addEventListener('input', () => { S.reg.nick = ni.value; const pos = ni.selectionStart; render(); const n2 = $('#nick'); n2.focus(); n2.setSelectionRange(pos, pos); });
  const sl = $('input[type=range]'); if (sl) sl.addEventListener('input', () => { S.set.vol = +sl.value; });
}
function go(h) { location.hash = h; }
function toast(t) { S.toast = t; render(); clearTimeout(toast.t); toast.t = setTimeout(() => { S.toast = ''; render(); }, 1600); }
document.addEventListener('click', (e) => {
  const nv = e.target.closest('[data-nav]'); const a = e.target.closest('[data-act]');
  if (nv) { const id = nv.dataset.nav; if (id === 'more') { go('world?more=1'); return; } go(id); return; }
  if (!a) return; const d = a.dataset; const { q } = parse();
  const acts = {
    island: () => go(`world?island=${d.id}`), closepop: () => go('world'), closemore: () => go('world'), play: () => toast('시안: 실제 게임으로 이동합니다'),
    regnext: () => { S.reg.step = 2; render(); }, regback: () => { S.reg.step = 1; render(); }, regav: () => { S.reg.av = d.id; render(); }, regdone: () => { S.reg.step = 3; render(); },
    rgame: () => { S.rankGame = d.id; render(); }, rper: () => { S.rankPeriod = d.id; render(); }, demo: () => { S.demo = true; render(); }, demo0: () => { S.demo = false; render(); },
    atab: () => { S.achTab = d.id; render(); }, ctab: () => { S.cxTab = d.id; S.cxSel = null; render(); }, csel: () => { S.cxSel = +d.i; render(); }, stab: () => { S.shopTab = d.id; render(); },
    claim: () => { S.claimed[d.i] = 1; S.p.coins += [20, 30, 40, 50][d.i]; toast('🪙 코인을 받았어요!'); },
    tog: () => { S.set[d.k] = !S.set[d.k]; render(); }, toast: () => toast(d.t),
    edit: () => { S.modal = { t: d.what }; render(); }, mclose: () => { S.modal = null; render(); }, setav: () => { S.p.av = d.id; S.modal = null; render(); },
    savenick: () => { const v = validNick($('#nick2').value); if (!v.ok) return toast('닉네임 규칙을 확인해주세요'); S.p.nick = $('#nick2').value; S.modal = null; render(); toast('닉네임을 바꿨어요 (기록 유지)'); },
    title: () => { S.p.title = d.t; S.modal = null; render(); toast('대표 칭호: ' + d.t); },
    buy: () => { S.modal = { t: 'confirm', title: `${d.n} 구매`, text: `🪙 ${d.p} 코인을 사용해요. (잔액 ${S.p.coins} → ${S.p.coins - d.p})`, ok: '구매', id: d.id, price: +d.p }; render(); },
    mok: () => { const m = S.modal; if (m.reset) { S.modal = null; toast('시안: 초기화는 실제로 동작하지 않아요'); return; } S.p.coins -= m.price; S.owned[m.id] = true; S.modal = null; render(); toast('구매 완료!'); },
    equip: () => { if (AV[d.id]) { S.p.av = d.id; render(); toast('장착했어요'); } else toast('장착했어요 (시안)'); },
    reset: () => { S.modal = { t: 'confirm', title: '저장 데이터 초기화', text: '이 기기의 닉네임·기록이 모두 삭제돼요. 백업이 없으면 복구할 수 없어요.', ok: '삭제', danger: true, reset: true }; render(); },
  };
  (acts[d.act] || (() => {}))();
});
window.addEventListener('hashchange', () => { S.modal = null; render(); });
window.addEventListener('resize', () => { const { name, q } = parse(); if (name === 'world') layoutWorld(q); });
$('#protoBtn')?.addEventListener('click', () => $('#proto').classList.toggle('open'));
if (location.hash === '' ) location.hash = 'world';
render();
