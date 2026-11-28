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
import { buzz } from './settings';

export type BgmName = 'title' | 'select' | 'stage1' | 'stage2' | 'stage3' | 'stage4' | 'stage5' | 'final' | 'boss' | 'lastboss' | 'ending' | 'clear' | 'over' | 'opening' | 'openingHold';

/** file: 다른 이름의 음원 파일을 씀 · from0: 반복 곡이어도 처음(0초)부터 재생 · bake: 반복 이음매를 이 초만큼 미리 섞은 사본으로 (딸깍·뚝 끊김 방지) */
const BGM: Record<BgmName, { vol: number; loop?: number[]; file?: string; from0?: boolean; bake?: number }> = {
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
  /** 오프닝 시네마틱 (약 34초 · 반복 없음 · tools/sky-audio/opening.py) */
  opening: { vol: 0.9 },
  /**
   * 오프닝 스토리북용: 같은 오프닝 곡을 처음부터 재생하다가, 타이틀 화면에 닿기 전이면
   * '여섯 수호자' 악절(33.0~37.8초 · Dm→B♭→C→D 화음 4개 × 1.2초)을 이어서 반복 — D 화음이 자연스럽게 Dm 으로 돌아감.
   * 그 뒤의 출격 고조(37.8~41.4초)와 타이틀 '쿵'은 반복하면 어색하므로 쓰지 않고, 타이틀 화면에서 타이틀 곡으로 교차 페이드.
   */
  openingHold: { vol: 0.9, file: 'opening', loop: [33.0, 37.8], from0: true, bake: 0.25 },
};
const baked = new Map<string, AudioBuffer>();
/** 반복 이음매 굽기: 반복 끝 직전 bake 초를 '반복 시작 직전' 소리와 교차로 섞은 사본 → 끝에서 시작으로 건너뛰어도 소리가 이어짐 */
function bakeLoop(c: AudioContext, buf: AudioBuffer, key: string, a: number, b: number, x: number): AudioBuffer {
  const hit = baked.get(key);
  if (hit) return hit;
  const sr = buf.sampleRate;
  const out = c.createBuffer(buf.numberOfChannels, buf.length, sr);
  const n = Math.round(x * sr), ia = Math.round(a * sr), ib = Math.round(b * sr);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const src = buf.getChannelData(ch);
    const dst = out.getChannelData(ch);
    dst.set(src);
    for (let i = 0; i < n; i++) {
      const k = i / n; // 0 → 1
      const j = ib - n + i;
      const pre = ia - n + i;
      if (j < 0 || pre < 0 || j >= dst.length) continue;
      // 같은 힘(제곱 합 1) 교차: 끝부분은 줄이고, 반복 시작 직전 소리는 키움
      dst[j] = src[j] * Math.cos((k * Math.PI) / 2) + src[pre] * Math.sin((k * Math.PI) / 2);
    }
  }
  baked.set(key, out);
  return out;
}
let htmlHold: (() => void) | null = null;

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

// ───────── 음원 데이터: 따로 된 파일(브라우저 캐시)로 필요할 때만 받음 ─────────
// (예전엔 JS 청크 안의 base64 문자열 → 한 번 불러온 곡은 문자열·바이트가 끝까지 메모리에 남아 iPhone 메모리 압박)
const SOURCES = import.meta.glob('./sound/*.{mp3,wav}', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const srcKey = (file: string): string | undefined => Object.keys(SOURCES).find((k) => k.endsWith(`/${file}.mp3`) || k.endsWith(`/${file}.wav`));
const MIME = (url: string): string => (/\.wav(\?|$)|audio\/wav/.test(url) ? 'audio/wav' : 'audio/mpeg');
const FETCH_RETRY = [500, 1500, 3000];

const bytesCache = new Map<string, Promise<{ bytes: Uint8Array; mime: string } | null>>();
async function fetchBytes(url: string): Promise<Uint8Array> {
  let err: unknown = null;
  for (let i = 0; i <= FETCH_RETRY.length; i++) {
    try {
      // GitHub Pages 가 가끔 잠깐 503 → 주소를 살짝 바꿔 다시
      const r = await fetch(i === 0 || url.startsWith('data:') ? url : `${url}${url.includes('?') ? '&' : '?'}retry=${i}`);
      if (r.ok) return new Uint8Array(await r.arrayBuffer());
      err = `HTTP ${r.status}`;
    } catch (e) {
      err = e;
    }
    if (i < FETCH_RETRY.length) await new Promise((res) => setTimeout(res, FETCH_RETRY[i]));
  }
  throw new Error(String(err));
}
function getBytes(file: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  let p = bytesCache.get(file);
  if (!p) {
    const k = srcKey(file);
    const url = k ? SOURCES[k] : '';
    p = !url
      ? Promise.resolve(null)
      : fetchBytes(url)
          .then((bytes) => ({ bytes, mime: MIME(url) }))
          .catch((e: unknown) => {
            note(`음원 로드 실패 ${file}: ${String(e)}`);
            bytesCache.delete(file);
            return null;
          });
    bytesCache.set(file, p);
    // 배경음은 디코딩·재생 준비가 끝나면 원본 바이트를 놓아 줌 (다시 필요하면 브라우저 캐시에서 다시 받음)
    if (file.startsWith('bgm-')) void p.then(() => window.setTimeout(() => bytesCache.delete(file), 0));
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
/** 다 쓴 배경음의 디코딩 사본을 놓아 줌 (오프닝 곡 ≈18MB 등 · 지금 재생 중이면 그대로) */
export function releaseBgm(name: BgmName): void {
  if (curName === name) return;
  baked.delete(name);
  buffers.delete(`bgm-${name}`);
  decoding.delete(`bgm-${name}`);
  const u = blobUrls.get(`bgm-${name}`);
  if (u) { URL.revokeObjectURL(u); blobUrls.delete(`bgm-${name}`); }
}
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
  /** 곡 0초가 컨텍스트 시간으로 언제였는지 · 곡 길이 (재생 위치 계산용) */
  t0: number;
  dur: number;
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
export function playBgm(name: BgmName, fadeOut = 0.6, fadeIn = 0.05, at = 0): void {
  if (wanted === name && curName === name) return;
  wanted = name;
  const info = BGM[name];
  if (mode === 'html') {
    curName = name;
    void blobUrl(`bgm-${info.file ?? name}`).then(async (url) => {
      if (!url || wanted !== name) return;
      htmlBgm ??= new Audio();
      const a = htmlBgm;
      // HTML5 대체 경로는 요소가 하나 → 이전 곡을 줄인 뒤(최대 1.2초) 새 곡을 서서히 키움 (뚝 끊김 없게)
      if (!a.paused && fadeOut > 0.1) await htmlRamp(a, 0, Math.min(1.2, fadeOut));
      if (wanted !== name) return;
      a.pause();
      a.src = url;
      a.loop = !!info.loop && !info.from0;
      a.currentTime = info.loop && !info.from0 ? info.loop[0] : at;
      // 구간 반복(처음부터 재생 후 일부 구간만 반복): HTML5 는 재생 위치를 보다가 되돌림
      if (htmlHold) { a.removeEventListener('timeupdate', htmlHold); htmlHold = null; }
      if (info.loop && info.from0) {
        const [l0, l1] = info.loop;
        htmlHold = () => { if (a.currentTime >= l1 - 0.03) a.currentTime = l0 + (a.currentTime - l1 + 0.03); };
        a.addEventListener('timeupdate', htmlHold);
      }
      a.volume = fadeIn > 0.06 ? 0 : info.vol;
      if (!muted) void a.play().catch((e: unknown) => note(`BGM 재생 거부(HTML5): ${String(e)}`));
      if (fadeIn > 0.06) void htmlRamp(a, info.vol, fadeIn);
    });
    return;
  }
  const c = makeCtx();
  if (!c || !musicBus) return;
  // 교차 페이드: 새 곡은 이전 곡이 절반쯤 줄어든 뒤부터 커짐 (두 곡이 겹쳐 음량이 튀지 않게)
  const xfade = !!cur && fadeIn > 0.06 && fadeOut > 0.3;
  const outEnd = c.currentTime + fadeOut;
  if (cur) {
    fadeOutAndStop(cur, fadeOut);
    cur = null;
  }
  curName = name;
  void decode(`bgm-${info.file ?? name}`).then((raw) => {
    if (!raw || wanted !== name || !musicBus || mode !== 'webaudio' || (cur && cur.name === name)) return;
    const buf = info.bake && info.loop ? bakeLoop(c, raw, name, info.loop[0], info.loop[1], info.bake) : raw;
    if (buf !== raw) buffers.delete(`bgm-${info.file ?? name}`); // 원본 디코딩 사본은 놓아 줌 (구운 사본 하나만 메모리에)
    const g = c.createGain();
    const t = c.currentTime;
    const rise = xfade ? Math.max(t, outEnd - fadeOut * 0.8) : t;
    g.gain.setValueAtTime(fadeIn > 0.06 ? 0 : info.vol, t);
    if (fadeIn > 0.06) { g.gain.setValueAtTime(0, rise); g.gain.linearRampToValueAtTime(info.vol, rise + fadeIn); }
    g.connect(musicBus);
    const s = c.createBufferSource();
    s.buffer = buf;
    if (info.loop) {
      s.loop = true;
      s.loopStart = info.loop[0];
      s.loopEnd = Math.min(info.loop[1], buf.duration);
    }
    s.connect(g);
    const off = info.loop && !info.from0 ? info.loop[0] : Math.min(at, Math.max(0, buf.duration - 0.1));
    s.start(t, off);
    const me: Playing = { name, src: s, gain: g, t0: t - off, dur: buf.duration };
    s.onended = () => {
      if (cur === me) cur = null;
    };
    cur = me;
  });
}
let rampId = 0;
/** HTML5 <audio> 음량을 sec 초 동안 목표값으로 (iOS 는 volume 이 무시될 수 있음 → 그 경우 바로 넘어감) */
function htmlRamp(a: HTMLAudioElement, to: number, sec: number): Promise<void> {
  const id = ++rampId;
  const from = a.volume;
  const t0 = performance.now();
  return new Promise((res) => {
    const step = (): void => {
      if (id !== rampId) { res(); return; }
      const k = Math.min(1, (performance.now() - t0) / (sec * 1000));
      try { a.volume = from + (to - from) * k; } catch { /* 무시 */ }
      if (k >= 1) res(); else window.setTimeout(step, 40);
    };
    step();
  });
}
// ───────── 오프닝 곡 플레이어 (음악 재생 위치 = 연출 시계) ─────────
/**
 * 오프닝 스토리북 전용: 오프닝 곡 하나를 '재생 위치' 기준으로 다룸
 *  - songPos(): 오디오 시계(AudioContext.currentTime)로 계산한 지금 곡 위치(초) → 화면 연출이 이 값을 보고 움직임 (따로 도는 타이머 없음)
 *  - songHold(a, b): 곡이 b 에 닿으면 [a, b) 구간을 이음매 없이 반복 (구간 끝 0.25초를 a 직전 소리와 미리 섞은 사본으로 전환 → 딸깍 없음)
 *  - songJump(p, fade): 곡의 p 초 지점으로 짧은 교차 페이드 (장면이 실제로 바뀌는 곳에서만)
 *  - 소리는 하나의 곡에서만 나옴: 새 재생을 시작하면 이전 재생은 페이드 후 정지 (중복 재생 없음)
 */
interface SongVoice { src: AudioBufferSourceNode; gain: GainNode; t0: number; a: number; L: number }
let song: { name: BgmName; raw: AudioBuffer; vol: number; v: SongVoice | null; pend: SongVoice | null; hold: [number, number] | null; olds: SongVoice[] } | null = null;
const segCache = new Map<string, AudioBuffer>();
const SEG_X = 0.25;
function segOf(c: AudioContext, raw: AudioBuffer, a: number, b: number): AudioBuffer {
  const key = `${a}-${b}`;
  const hit = segCache.get(key);
  if (hit) return hit;
  const sr = raw.sampleRate;
  const ia = Math.round(a * sr), ib = Math.round(b * sr), n = Math.round(SEG_X * sr);
  const out = c.createBuffer(raw.numberOfChannels, ib - ia, sr);
  for (let ch = 0; ch < raw.numberOfChannels; ch++) {
    const s0 = raw.getChannelData(ch), d = out.getChannelData(ch);
    d.set(s0.subarray(ia, ib));
    for (let i = 0; i < n; i++) {
      const k = i / n, j = d.length - n + i, pre = ia - n + i;
      if (pre >= 0) d[j] = s0[ia + j] * Math.cos((k * Math.PI) / 2) + s0[pre] * Math.sin((k * Math.PI) / 2);
    }
  }
  segCache.set(key, out);
  return out;
}
function voiceAt(c: AudioContext, buf: AudioBuffer, when: number, off: number, a: number, L: number, loop: boolean, gain0: number): SongVoice {
  const g = c.createGain();
  g.gain.setValueAtTime(gain0, c.currentTime);
  g.connect(musicBus!);
  const s = c.createBufferSource();
  s.buffer = buf;
  if (loop) { s.loop = true; s.loopStart = 0; s.loopEnd = buf.duration; }
  s.connect(g);
  s.start(when, off);
  return { src: s, gain: g, t0: when - off, a, L };
}
function retire(v: SongVoice | null, fade: number): void {
  if (!v || !ctx) return;
  const t = ctx.currentTime;
  try {
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setValueAtTime(v.gain.gain.value, t);
    v.gain.gain.linearRampToValueAtTime(0, t + Math.max(0.03, fade));
    v.src.stop(t + Math.max(0.03, fade) + 0.05);
  } catch { /* 이미 멈춤 */ }
  window.setTimeout(() => { try { v.gain.disconnect(); } catch { /* 무시 */ } }, (fade + 0.4) * 1000);
}
let htmlSongHold: (() => void) | null = null;
/** 오프닝 곡 시작 (p 초부터) — 다른 BGM 은 페이드아웃 */
export function songStart(name: BgmName, p = 0, fade = 0.6): Promise<void> {
  const info = BGM[name];
  stopBgm(fade);
  if (mode === 'html') {
    curName = name; wanted = name;
    return blobUrl(`bgm-${info.file ?? name}`).then((url) => {
      if (!url) return;
      htmlBgm ??= new Audio();
      const a = htmlBgm;
      a.src = url; a.loop = false; a.currentTime = p; a.volume = info.vol;
      if (!muted) void a.play().catch(() => undefined);
      song = { name, raw: null as unknown as AudioBuffer, vol: info.vol, v: null, pend: null, hold: null, olds: [] };
    });
  }
  const c = makeCtx();
  if (!c || !musicBus) return Promise.resolve();
  return decode(`bgm-${info.file ?? name}`).then((raw) => {
    if (!raw || !musicBus) return;
    songStopNow();
    const t = c.currentTime + 0.02;
    const v = voiceAt(c, raw, t, p, 0, raw.duration, false, 0);
    v.gain.gain.setValueAtTime(0, t);
    v.gain.gain.linearRampToValueAtTime(info.vol, t + Math.max(0.03, fade));
    song = { name, raw, vol: info.vol, v, pend: null, hold: null, olds: [] };
    curName = name; wanted = name;
  });
}
function songStopNow(): void {
  if (!song) return;
  retire(song.v, 0.05); retire(song.pend, 0.05);
  song = null;
}
/** 곡을 p 초 지점으로 (교차 페이드 fade 초) · 예약된 반복은 취소 */
export function songJump(p: number, fade = 0.6): void {
  if (!song) return;
  song.hold = null;
  if (mode === 'html') { if (htmlBgm) { if (htmlSongHold) { htmlBgm.removeEventListener('timeupdate', htmlSongHold); htmlSongHold = null; } htmlBgm.currentTime = p; } return; }
  const c = ctx!;
  const t = c.currentTime + 0.02;
  retire(song.v, fade); retire(song.pend, Math.min(fade, 0.1)); song.pend = null;
  const v = voiceAt(c, song.raw, t, p, 0, song.raw.duration, false, 0);
  v.gain.gain.setValueAtTime(0, t);
  v.gain.gain.linearRampToValueAtTime(song.vol, t + Math.max(0.03, fade));
  song.v = v;
}
/** 곡이 b 초에 닿으면 [a, b) 를 반복 (이미 지나갔으면 그 구간으로 바로 교차) */
export function songHold(a: number, b: number): void {
  if (!song) return;
  if (song.hold && song.hold[0] === a && song.hold[1] === b) return;
  song.hold = [a, b];
  if (mode === 'html') {
    const el = htmlBgm;
    if (!el) return;
    if (htmlSongHold) el.removeEventListener('timeupdate', htmlSongHold);
    htmlSongHold = () => { if (el.currentTime >= b - 0.05) el.currentTime = a; };
    el.addEventListener('timeupdate', htmlSongHold);
    return;
  }
  const c = ctx!, v = song.v;
  if (!v) return;
  retire(song.pend, 0.03); song.pend = null;
  const seg = segOf(c, song.raw, a, b);
  const L = seg.duration;
  const now = c.currentTime;
  const pos = songPos();
  if (v.L === L && v.a === a) return; // 이미 그 구간을 반복 중
  const ts = v.t0 + (b - SEG_X); // 원곡이 (b - 0.25초)에 닿는 순간 = 반복 사본과 소리가 같은 지점 → 끊김 없이 바꿔 탐
  if (v.L >= song.raw.duration - 0.01 && ts > now + 0.03 && pos < b - SEG_X) {
    const nv = voiceAt(c, seg, ts, L - SEG_X, a, L, true, 0);
    nv.t0 = ts - (L - SEG_X); // 반복 시계: (now - t0) mod L
    nv.gain.gain.setValueAtTime(0, now);
    nv.gain.gain.setValueAtTime(song.vol, ts);
    v.gain.gain.setValueAtTime(song.vol, ts - 0.005);
    v.gain.gain.setValueAtTime(0, ts);
    song.pend = nv;
    const cur = v;
    window.setTimeout(() => { if (song && song.pend === nv) { try { cur.src.stop(); } catch { /* 무시 */ } song.v = nv; song.pend = null; } }, (ts - now) * 1000 + 60);
  } else {
    // 이미 b 근처를 지났거나 다른 구간 반복 중 → 0.5초 교차로 반복 구간에 합류
    const off = pos >= a && pos < b ? pos - a : 0;
    const nv = voiceAt(c, seg, now + 0.02, off, a, L, true, 0);
    nv.gain.gain.setValueAtTime(0, now + 0.02);
    nv.gain.gain.linearRampToValueAtTime(song.vol, now + 0.52);
    retire(v, 0.5);
    song.v = nv;
  }
}
/** 반복 예약 취소 (아직 반복에 들어가지 않았을 때만 — 원곡 그대로 계속) */
export function songUnhold(): void {
  if (!song) return;
  song.hold = null;
  if (mode === 'html') { if (htmlBgm && htmlSongHold) { htmlBgm.removeEventListener('timeupdate', htmlSongHold); htmlSongHold = null; } return; }
  if (song.pend && song.v && ctx) {
    const t = ctx.currentTime;
    song.v.gain.gain.cancelScheduledValues(t);
    song.v.gain.gain.setValueAtTime(song.vol, t);
    retire(song.pend, 0.02);
    song.pend = null;
  }
}
/** 지금 곡 위치(초) — 오디오 시계 기준 · 반복 중이면 반복 구간 안의 위치 */
export function songPos(): number {
  if (!song) return -1;
  if (mode === 'html') return htmlBgm ? htmlBgm.currentTime : -1;
  if (!ctx || !song.v) return -1;
  // 실제로 스피커에서 들리는 위치 = 컨텍스트 시각 - 출력 지연 (화면이 소리보다 먼저 나오지 않게)
  const c2 = ctx as AudioContext & { outputLatency?: number };
  const now = ctx.currentTime - Math.min(0.2, (c2.outputLatency || 0) + (ctx.baseLatency || 0));
  const v = song.pend && now >= song.pend.t0 + song.pend.L - SEG_X ? song.pend : song.v;
  const e = now - v.t0;
  if (v.L < song.raw.duration - 0.01) return v.a + (((e % v.L) + v.L) % v.L);
  return e;
}
export function songRunning(): boolean {
  if (mode === 'html') return !!htmlBgm && !htmlBgm.paused;
  return !!song && !!ctx && ctx.state === 'running';
}
export function songStop(fade = 1.5): void {
  if (!song) return;
  retire(song.v, fade); retire(song.pend, fade);
  if (mode === 'html') htmlBgm?.pause();
  song = null;
  if (curName === 'opening' || curName === 'openingHold') { curName = null; wanted = null; }
}

/** 지금 BGM 이름 · 재생 위치(초) · 곡 길이 — 반복 없는 곡이 끝나기 전에 다음 곡으로 자연스럽게 넘기려고 */
export function bgmInfo(): { name: BgmName | null; pos: number; dur: number; running: boolean } {
  if (mode === 'html') {
    const a = htmlBgm;
    return { name: curName, pos: a ? a.currentTime : 0, dur: a && isFinite(a.duration) ? a.duration : 0, running: !!a && !a.paused };
  }
  if (song && ctx) return { name: song.name, pos: songPos(), dur: song.raw.duration, running: ctx.state === 'running' };
  if (!cur || !ctx) return { name: curName, pos: 0, dur: 0, running: false };
  return { name: cur.name, pos: ctx.currentTime - cur.t0, dur: cur.dur, running: ctx.state === 'running' };
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
  // 메뉴 버튼: 짧은 햅틱 (지원 기기에서만 · iPhone 은 iOS 18+ 톡)
  if (name === 'menuOk') buzz(12, 120);
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
