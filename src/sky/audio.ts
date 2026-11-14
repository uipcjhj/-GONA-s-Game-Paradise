/**
 * GONA's Sky Adventure 오디오 엔진
 *
 * 음원: tools/sky-audio/ 합성 스크립트로 만든 오리지널 (src/sky/sound/).
 *   ※ 4차 수정: 음원을 별도 파일 요청(fetch)으로 받지 않고 JS 청크 안에 데이터로 넣어 둠(import.meta.glob ?inline).
 *     claude.ai 테스트판처럼 보안 정책(CSP)·샌드박스 iframe 에서 fetch 가 막혀도 음원을 확실히 얻을 수 있게.
 *
 * 재생 방식 (자동 선택)
 *   1) Web Audio (기본): 디코딩한 버퍼 재사용 → 연사·폭발이 많아도 가벼움
 *   2) HTML5 <audio> (대체): Web Audio 가 첫 터치 후에도 켜지지 않거나 디코딩이 실패하면 자동 전환.
 *      BGM 은 하나의 <audio> 요소를 계속 재사용(첫 터치 때 재생 권한을 얻은 요소라 이후 곡 교체도 허용됨)
 *
 * iPhone Safari: START 버튼 등 첫 터치 안에서 unlockAudio() 를 직접 호출 → resume + 무음 재생으로 잠금 해제.
 * 진단: audioDiag() — 일시정지 메뉴에 상태 표시, '사운드 다시 활성화'(reviveAudio) · '테스트음'(testBeep) 제공.
 */
import LOOPS from './audioLoops';

export type BgmName = 'title' | 'select' | 'stage1' | 'stage2' | 'stage3' | 'stage4' | 'stage5' | 'final' | 'boss' | 'lastboss' | 'ending' | 'clear' | 'over';

const BGM: Record<BgmName, { vol: number; loop?: number[] }> = {
  title: { vol: 0.6, ...LOOPS.title },
  select: { vol: 0.5, ...LOOPS.select },
  stage1: { vol: 0.52, ...LOOPS.stage1 },
  stage2: { vol: 0.52, ...LOOPS.stage2 },
  stage3: { vol: 0.52, ...LOOPS.stage3 },
  stage4: { vol: 0.52, ...LOOPS.stage4 },
  stage5: { vol: 0.52, ...LOOPS.stage5 },
  final: { vol: 0.54, ...LOOPS.final },
  boss: { vol: 0.56, ...LOOPS.boss },
  lastboss: { vol: 0.58, ...LOOPS.lastboss },
  ending: { vol: 0.6, ...LOOPS.ending },
  clear: { vol: 0.66 },
  over: { vol: 0.66 },
};

/** 효과음 표: 볼륨 · 동시 재생 최대 수 · 같은 소리 최소 간격(초) */
const SFX = {
  shot: { vol: 0.22, max: 2, gap: 0.07 },
  shotHeavy: { vol: 0.26, max: 2, gap: 0.07 },
  compShot: { vol: 0.18, max: 2, gap: 0.09 },
  beam: { vol: 0.42, max: 1, gap: 0.3 },
  chargeUp: { vol: 0.4, max: 1, gap: 0.05 },
  chargeShot: { vol: 0.75, max: 2, gap: 0.05 },
  enemyHit: { vol: 0.2, max: 3, gap: 0.045 },
  boomS: { vol: 0.42, max: 4, gap: 0.04 },
  boomM: { vol: 0.6, max: 3, gap: 0.06 },
  boomL: { vol: 0.85, max: 2, gap: 0.1 },
  bossHit: { vol: 0.5, max: 3, gap: 0.06 },
  bossWeak: { vol: 0.5, max: 2, gap: 0.07 },
  bossBreak: { vol: 0.95, max: 1, gap: 0.5 },
  bomb: { vol: 0.9, max: 1, gap: 0.3 },
  spMom: { vol: 0.8, max: 1, gap: 0.3 },
  spDad: { vol: 0.8, max: 1, gap: 0.3 },
  spImo: { vol: 0.8, max: 1, gap: 0.3 },
  spHalmeoni: { vol: 0.8, max: 1, gap: 0.3 },
  spHalabeoji: { vol: 0.8, max: 1, gap: 0.3 },
  spSamchon: { vol: 0.8, max: 1, gap: 0.3 },
  cutin: { vol: 0.7, max: 1, gap: 0.3 },
  warn: { vol: 0.62, max: 1, gap: 0.5 },
  item: { vol: 0.42, max: 3, gap: 0.05 },
  powerUp: { vol: 0.6, max: 1, gap: 0.2 },
  heal: { vol: 0.55, max: 1, gap: 0.2 },
  shield: { vol: 0.55, max: 2, gap: 0.1 },
  playerHit: { vol: 0.75, max: 1, gap: 0.2 },
  gaugeFull: { vol: 0.55, max: 1, gap: 0.5 },
  menuMove: { vol: 0.4, max: 2, gap: 0.04 },
  menuOk: { vol: 0.6, max: 1, gap: 0.1 },
  start: { vol: 0.7, max: 1, gap: 0.5 },
  armorBreak: { vol: 0.8, max: 1, gap: 0.3 },
} as const;
export type SfxName = keyof typeof SFX;
export const SFX_NAMES = Object.keys(SFX) as SfxName[];
export const BGM_NAMES = Object.keys(BGM) as BgmName[];

// ───────── 음원 데이터 (JS 청크에 data: URL 로 포함 · 필요할 때 불러옴) ─────────
const SOURCES = import.meta.glob('./sound/*.{mp3,wav}', { query: '?inline', import: 'default' }) as Record<string, () => Promise<string>>;
const srcKey = (file: string): string | undefined => Object.keys(SOURCES).find((k) => k.endsWith(`/${file}.mp3`) || k.endsWith(`/${file}.wav`));

const bytesCache = new Map<string, Promise<{ bytes: Uint8Array; mime: string } | null>>();
function getBytes(file: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  let p = bytesCache.get(file);
  if (!p) {
    const k = srcKey(file);
    p = !k
      ? Promise.resolve(null)
      : SOURCES[k]()
          .then((url) => {
            const comma = url.indexOf(',');
            const mime = url.slice(5, url.indexOf(';'));
            const bin = atob(url.slice(comma + 1));
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            return { bytes, mime };
          })
          .catch((e: unknown) => {
            note(`음원 로드 실패 ${file}: ${String(e)}`);
            return null;
          });
    bytesCache.set(file, p);
  }
  return p;
}

// ───────── 상태 ─────────
type Mode = 'webaudio' | 'html';
let mode: Mode = 'webaudio';
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let unlocked = false;
let unlockTries = 0;
const errors: string[] = [];
const buffers = new Map<string, AudioBuffer>();
const decoding = new Map<string, Promise<AudioBuffer | null>>();
let decodeFails = 0;

function note(msg: string): void {
  if (errors.length > 8) errors.shift();
  errors.push(msg);
}

let muted = (() => {
  try {
    return localStorage.getItem('gona.sky.mute') === '1';
  } catch {
    return false;
  }
})();

function makeCtx(): AudioContext | null {
  if (ctx && ctx.state !== 'closed') return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) {
    note('이 브라우저는 Web Audio 미지원');
    return null;
  }
  try {
    const nav = navigator as unknown as { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = 'playback';
  } catch {
    /* 무시 */
  }
  try {
    ctx = new AC();
  } catch (e) {
    note(`AudioContext 생성 실패: ${String(e)}`);
    return null;
  }
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 10;
  comp.ratio.value = 6;
  comp.attack.value = 0.003;
  comp.release.value = 0.18;
  const limit = ctx.createDynamicsCompressor();
  limit.threshold.value = -3;
  limit.knee.value = 0;
  limit.ratio.value = 20;
  limit.attack.value = 0.002;
  limit.release.value = 0.12;
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  musicBus = ctx.createGain();
  sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.9;
  musicBus.connect(master);
  sfxBus.connect(comp);
  comp.connect(master);
  master.connect(limit);
  limit.connect(ctx.destination);
  buffers.clear();
  decoding.clear();
  return ctx;
}

// ───────── 잠금 해제 ─────────
/** 사용자 터치 핸들러 안에서 직접 호출 (iOS 는 제스처 안에서만 소리를 열어 줌) */
export function unlockAudio(): void {
  unlockTries++;
  if (mode === 'html') {
    htmlUnlock();
    unlocked = true;
    return;
  }
  const c = makeCtx();
  if (!c) {
    switchToHtml('Web Audio 없음');
    htmlUnlock();
    return;
  }
  try {
    if (c.state !== 'running') void c.resume().catch((e: unknown) => note(`resume 실패: ${String(e)}`));
    const b = c.createBuffer(1, 1, 22050);
    const s = c.createBufferSource();
    s.buffer = b;
    s.connect(c.destination);
    s.start(0);
  } catch (e) {
    note(`잠금 해제 오류: ${String(e)}`);
  }
  htmlUnlock(); // 대체 경로용 <audio> 요소도 같은 제스처에서 미리 권한 확보
  unlocked = true;
  // 제스처 후에도 실행 상태가 안 되면 HTML5 방식으로 전환
  window.setTimeout(() => {
    if (mode === 'webaudio' && ctx && ctx.state !== 'running' && !document.hidden) {
      note(`AudioContext 상태 ${ctx.state} → HTML5 오디오로 전환`);
      switchToHtml('context 미실행');
    }
  }, 700);
}

let listening = false;
export function initAudio(): void {
  if (listening) return;
  listening = true;
  makeCtx();
  const h = (): void => {
    if (!unlocked || (mode === 'webaudio' && ctx && ctx.state !== 'running')) unlockAudio();
  };
  for (const ev of ['touchend', 'pointerup', 'click', 'keydown']) window.addEventListener(ev, h, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (mode === 'webaudio' && ctx) {
      if (document.hidden) void ctx.suspend().catch(() => undefined);
      else if (unlocked) void ctx.resume().catch(() => undefined);
    } else if (mode === 'html' && htmlBgm) {
      if (document.hidden) htmlBgm.pause();
      else if (curName && !muted) void htmlBgm.play().catch(() => undefined);
    }
  });
}
export function audioUnlocked(): boolean {
  return unlocked && (mode === 'html' || ctx?.state === 'running');
}

/** '사운드 다시 활성화': 컨텍스트를 새로 만들고 지금 곡을 다시 시작 (제스처 안에서 호출) */
export function reviveAudio(): void {
  const want = wanted;
  try {
    stopBgm(0);
    if (ctx) void ctx.close().catch(() => undefined);
  } catch {
    /* 무시 */
  }
  ctx = null;
  mode = 'webaudio';
  unlocked = false;
  makeCtx();
  unlockAudio();
  if (want) playBgm(want, 0, 0.3);
  void preloadAudio('game');
}

/** 테스트음: 음원 없이 발진기로 '삐' 소리 → 스피커·잠금 해제 확인용 */
export function testBeep(): void {
  if (mode === 'webaudio' && ctx) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.26);
  }
  sfx('menuOk');
}

// ───────── 디코딩 ─────────
function decode(file: string): Promise<AudioBuffer | null> {
  const c = ctx;
  if (!c) return Promise.resolve(null);
  const hit = buffers.get(file);
  if (hit) return Promise.resolve(hit);
  let p = decoding.get(file);
  if (!p) {
    p = getBytes(file).then(
      (d) =>
        !d
          ? null
          : new Promise<AudioBuffer | null>((res) => {
              const copy = d.bytes.slice().buffer as ArrayBuffer; // decodeAudioData 는 버퍼를 소모하므로 사본
              const ok = (b: AudioBuffer): void => {
                buffers.set(file, b);
                res(b);
              };
              const fail = (e: unknown): void => {
                decodeFails++;
                note(`디코딩 실패 ${file}: ${String(e)}`);
                res(null);
              };
              try {
                const r = c.decodeAudioData(copy, ok, fail) as unknown as Promise<AudioBuffer> | undefined;
                if (r && typeof r.then === 'function') r.then(ok, fail);
              } catch (e) {
                fail(e);
              }
            }),
    );
    decoding.set(file, p);
  }
  return p;
}

/** 미리 불러 두기 (BGM 은 디코딩하면 곡당 수십 MB → 필요한 곡만: prepareBgm) */
export function preloadAudio(which: 'menu' | 'game'): Promise<void> {
  const list =
    which === 'menu'
      ? ['bgm-title', 'bgm-select', 'sfx-menuMove', 'sfx-menuOk', 'sfx-start']
      : ['bgm-clear', 'bgm-over', ...SFX_NAMES.map((s) => `sfx-${s}`)];
  return Promise.all(list.map((f) => (mode === 'webaudio' ? decode(f) : getBytes(f)))).then(() => {
    if (mode === 'webaudio' && decodeFails >= 3 && buffers.size === 0) switchToHtml('디코딩 실패');
  });
}

/** 이번 화면에 필요한 BGM 만 디코딩해 두고, 나머지 BGM 버퍼는 메모리에서 해제 (iPhone 메모리 보호) */
export function prepareBgm(names: BgmName[]): Promise<void> {
  const keep = new Set<string>([...names, 'clear', 'over'].map((n) => `bgm-${n}`));
  if (curName) keep.add(`bgm-${curName}`);
  for (const k of [...buffers.keys()]) if (k.startsWith('bgm-') && !keep.has(k)) { buffers.delete(k); decoding.delete(k); }
  for (const k of [...blobUrls.keys()]) if (k.startsWith('bgm-') && !keep.has(k)) { URL.revokeObjectURL(blobUrls.get(k)!); blobUrls.delete(k); }
  return Promise.all(names.map((n) => (mode === 'webaudio' ? decode(`bgm-${n}`) : blobUrl(`bgm-${n}`)))).then(() => undefined);
}

// ───────── HTML5 대체 경로 ─────────
let htmlBgm: HTMLAudioElement | null = null;
const htmlPool: HTMLAudioElement[] = [];
let poolIdx = 0;
const blobUrls = new Map<string, string>();
function blobUrl(file: string): Promise<string | null> {
  const u = blobUrls.get(file);
  if (u) return Promise.resolve(u);
  return getBytes(file).then((d) => {
    if (!d) return null;
    const url = URL.createObjectURL(new Blob([d.bytes.slice().buffer as ArrayBuffer], { type: d.mime }));
    blobUrls.set(file, url);
    return url;
  });
}
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=';
function htmlUnlock(): void {
  try {
    htmlBgm ??= new Audio();
    if (!htmlBgm.src) {
      htmlBgm.src = SILENT;
      void htmlBgm.play().catch(() => undefined);
    }
    while (htmlPool.length < 6) {
      const a = new Audio(SILENT);
      void a.play().catch(() => undefined);
      htmlPool.push(a);
    }
  } catch (e) {
    note(`HTML5 오디오 준비 실패: ${String(e)}`);
  }
}
function switchToHtml(why: string): void {
  if (mode === 'html') return;
  mode = 'html';
  note(`HTML5 오디오 사용 (${why})`);
  const w = wanted;
  cur = null;
  for (const n of SFX_NAMES.map((x) => `sfx-${x}`)) void blobUrl(n);
  if (w) {
    wanted = null;
    playBgm(w);
  }
}

// ───────── BGM ─────────
interface Playing {
  name: BgmName;
  src: AudioBufferSourceNode;
  gain: GainNode;
}
let cur: Playing | null = null;
let curName: BgmName | null = null;
let wanted: BgmName | null = null;

function fadeOutAndStop(p: Playing, sec: number): void {
  if (!ctx) return;
  const t = ctx.currentTime;
  try {
    p.gain.gain.cancelScheduledValues(t);
    p.gain.gain.setValueAtTime(p.gain.gain.value, t);
    p.gain.gain.linearRampToValueAtTime(0, t + Math.max(0.02, sec));
    p.src.stop(t + Math.max(0.02, sec) + 0.05);
  } catch {
    /* 이미 멈춤 */
  }
  window.setTimeout(() => p.gain.disconnect(), (sec + 0.3) * 1000);
}

/** BGM 전환: 같은 곡이면 그대로, 다른 곡이면 이전 곡 fadeOut 초 동안 줄이고 새 곡 fadeIn (항상 1곡만) */
export function playBgm(name: BgmName, fadeOut = 0.6, fadeIn = 0.05): void {
  if (wanted === name && curName === name) return;
  wanted = name;
  const info = BGM[name];
  if (mode === 'html') {
    curName = name;
    void blobUrl(`bgm-${name}`).then((url) => {
      if (!url || wanted !== name) return;
      htmlBgm ??= new Audio();
      const a = htmlBgm;
      a.pause();
      a.src = url;
      a.loop = !!info.loop;
      a.volume = info.vol;
      a.currentTime = info.loop ? info.loop[0] : 0;
      if (!muted) void a.play().catch((e: unknown) => note(`BGM 재생 거부(HTML5): ${String(e)}`));
    });
    return;
  }
  const c = makeCtx();
  if (!c || !musicBus) return;
  if (cur) {
    fadeOutAndStop(cur, fadeOut);
    cur = null;
  }
  curName = name;
  void decode(`bgm-${name}`).then((buf) => {
    if (!buf || wanted !== name || !musicBus || mode !== 'webaudio' || (cur && cur.name === name)) return;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(fadeIn > 0.06 ? 0 : info.vol, t);
    if (fadeIn > 0.06) g.gain.linearRampToValueAtTime(info.vol, t + fadeIn);
    g.connect(musicBus);
    const s = c.createBufferSource();
    s.buffer = buf;
    if (info.loop) {
      s.loop = true;
      s.loopStart = info.loop[0];
      s.loopEnd = Math.min(info.loop[1], buf.duration);
    }
    s.connect(g);
    s.start(t, info.loop ? info.loop[0] : 0);
    const me: Playing = { name, src: s, gain: g };
    s.onended = () => {
      if (cur === me) cur = null;
    };
    cur = me;
  });
}
export function stopBgm(fade = 0.4): void {
  wanted = null;
  curName = null;
  if (mode === 'html') {
    htmlBgm?.pause();
    return;
  }
  if (cur) {
    fadeOutAndStop(cur, fade);
    cur = null;
  }
}

// ───────── 효과음 ─────────
const active = new Map<SfxName, AudioBufferSourceNode[]>();
const lastAt = new Map<SfxName, number>();

/** 효과음 재생. 반환값으로 나중에 멈출 수 있음(차지 충전음 등) */
export function sfx(name: SfxName, vol = 1, rate = 1): AudioBufferSourceNode | null {
  if (muted) return null;
  const cfg = SFX[name];
  const now = performance.now() / 1000;
  if (now - (lastAt.get(name) ?? -9) < cfg.gap) return null;
  if (mode === 'html') {
    const url = blobUrls.get(`sfx-${name}`);
    if (!url) {
      void blobUrl(`sfx-${name}`);
      return null;
    }
    if (!htmlPool.length) return null;
    lastAt.set(name, now);
    const a = htmlPool[poolIdx++ % htmlPool.length];
    try {
      a.pause();
      a.src = url;
      a.volume = Math.min(1, cfg.vol * vol);
      void a.play().catch(() => undefined);
    } catch {
      /* 무시 */
    }
    return null;
  }
  if (!ctx || !sfxBus || ctx.state !== 'running') return null;
  const buf = buffers.get(`sfx-${name}`);
  if (!buf) {
    void decode(`sfx-${name}`);
    return null;
  }
  lastAt.set(name, now);
  let list = active.get(name);
  if (!list) active.set(name, (list = []));
  while (list.length >= cfg.max) {
    const old = list.shift()!;
    try {
      old.stop();
    } catch {
      /* 무시 */
    }
  }
  const s = ctx.createBufferSource();
  s.buffer = buf;
  s.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = cfg.vol * vol;
  s.connect(g);
  g.connect(sfxBus);
  list.push(s);
  s.onended = () => {
    const l = active.get(name);
    if (l) {
      const i = l.indexOf(s);
      if (i >= 0) l.splice(i, 1);
    }
    g.disconnect();
  };
  s.start(ctx.currentTime);
  return s;
}
export function stopSfx(s: AudioBufferSourceNode | null): void {
  if (!s || !ctx) return;
  try {
    s.stop(ctx.currentTime + 0.02);
  } catch {
    /* 무시 */
  }
}

export function isMuted(): boolean {
  return muted;
}
export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem('gona.sky.mute', m ? '1' : '0');
  } catch {
    /* 저장 불가는 무시 */
  }
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.03);
  if (htmlBgm) {
    if (m) htmlBgm.pause();
    else if (mode === 'html' && curName) void htmlBgm.play().catch(() => undefined);
  }
}

// ───────── 진단 ─────────
export interface AudioDiag {
  mode: Mode;
  ctx: string;
  unlocked: boolean;
  tries: number;
  bgm: string | null;
  playing: boolean;
  decoded: number;
  total: number;
  sampleRate: number;
  muted: boolean;
  errors: string[];
}
export function audioDiag(): AudioDiag {
  return {
    mode,
    ctx: ctx?.state ?? 'none',
    unlocked,
    tries: unlockTries,
    bgm: curName,
    playing: mode === 'html' ? !!htmlBgm && !htmlBgm.paused : !!cur,
    decoded: mode === 'html' ? blobUrls.size : buffers.size,
    total: Object.keys(SOURCES).length,
    sampleRate: ctx?.sampleRate ?? 0,
    muted,
    errors: errors.slice(),
  };
}
/** 검수용 (자동 테스트) */
export function audioState(): { ctx: string; unlocked: boolean; bgm: string | null; wanted: string | null; buffers: number; voices: number; mode: Mode } {
  let voices = 0;
  for (const l of active.values()) voices += l.length;
  return { ctx: ctx?.state ?? 'none', unlocked, bgm: cur?.name ?? (mode === 'html' ? curName : null), wanted, buffers: buffers.size, voices, mode };
}
/** 검수용: 게임 전체 출력을 MediaStream 으로 (플레이 영상 녹음용) */
export function audioTap(): MediaStream | null {
  const c = makeCtx();
  if (!c || !master) return null;
  const d = c.createMediaStreamDestination();
  master.connect(d);
  return d.stream;
}
/** 검수용: HTML5 대체 경로 강제 */
export function forceHtmlAudio(): void {
  switchToHtml('검수용 강제');
}
