/**
 * GONA's Sky Adventure 오디오 엔진 (Web Audio API)
 *  - 모든 음원은 tools/sky-audio/ 의 합성 스크립트로 만든 오리지널 (public/assets/sky/audio/)
 *  - iPhone Safari: 첫 터치(touchend/pointerdown/click/keydown)에서 AudioContext 를 깨움. 그 전에 예약한 BGM 은 깨어나는 순간 재생
 *  - HTMLAudioElement 를 매번 복제하던 이전 방식(iOS 에서 프레임 끊김 원인)을 버리고, 디코딩된 버퍼를 재사용
 *  - BGM 은 한 번에 하나만: 바꿀 때 이전 곡은 페이드아웃 후 정지 (중복·겹침 방지)
 *  - 효과음: 이름별 동시 재생 수 · 최소 간격 · 볼륨 관리 + 마스터 컴프레서로 찢어짐 방지
 */
import LOOPS from './audioLoops';

const BASE = `${import.meta.env.BASE_URL}assets/sky/audio/`;

export type BgmName = 'title' | 'select' | 'stage1' | 'boss' | 'clear' | 'over';

/** 반복 구간(초): 파일 전체가 주기 신호로 렌더링되어 있어 인코더 지연과 무관하게 이음매 없이 반복됨 */
const BGM: Record<BgmName, { vol: number; loop?: number[] }> = {
  title: { vol: 0.6, ...LOOPS.title },
  select: { vol: 0.5, ...LOOPS.select },
  stage1: { vol: 0.52, ...LOOPS.stage1 },
  boss: { vol: 0.56, ...LOOPS.boss },
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
  boomL: { vol: 0.8, max: 2, gap: 0.1 },
  bossHit: { vol: 0.34, max: 2, gap: 0.09 },
  bossWeak: { vol: 0.32, max: 2, gap: 0.1 },
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
} as const;
export type SfxName = keyof typeof SFX;
export const SFX_NAMES = Object.keys(SFX) as SfxName[];
export const BGM_NAMES = Object.keys(BGM) as BgmName[];

type Ctx = AudioContext;
let ctx: Ctx | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let unlocked = false;
const buffers = new Map<string, AudioBuffer>();
const loading = new Map<string, Promise<AudioBuffer | null>>();

let muted = (() => {
  try {
    return localStorage.getItem('gona.sky.mute') === '1';
  } catch {
    return false;
  }
})();

function makeCtx(): Ctx | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    // iOS 무음 스위치와 무관하게 게임 소리가 나도록 (Audio Session API 지원 브라우저에서만 — 미지원이면 무시)
    const nav = navigator as unknown as { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = 'playback';
  } catch {
    /* 무시 */
  }
  ctx = new AC({ latencyHint: 'interactive' });
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 10;
  comp.ratio.value = 6;
  comp.attack.value = 0.003;
  comp.release.value = 0.18;
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  musicBus = ctx.createGain();
  sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.9;
  // 최종 리미터: BGM + 효과음이 겹쳐도 0dB 를 넘어 찢어지지 않게
  const limit = ctx.createDynamicsCompressor();
  limit.threshold.value = -3;
  limit.knee.value = 0;
  limit.ratio.value = 20;
  limit.attack.value = 0.002;
  limit.release.value = 0.12;
  musicBus.connect(master);
  sfxBus.connect(comp);
  comp.connect(master);
  master.connect(limit);
  limit.connect(ctx.destination);
  return ctx;
}

/** 첫 사용자 동작에서 오디오 잠금 해제 (한 번만 등록) */
let listening = false;
export function initAudio(): void {
  makeCtx();
  if (listening) return;
  listening = true;
  const unlock = (): void => {
    const c = makeCtx();
    if (!c) return;
    if (c.state !== 'running') void c.resume().catch(() => undefined);
    if (!unlocked) {
      // iOS: 사용자 동작 안에서 무음 버퍼를 한 번 재생해야 완전히 열림
      const b = c.createBuffer(1, 1, 22050);
      const s = c.createBufferSource();
      s.buffer = b;
      s.connect(c.destination);
      s.start(0);
    }
    unlocked = true;
  };
  for (const ev of ['touchend', 'pointerdown', 'click', 'keydown']) window.addEventListener(ev, unlock, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend().catch(() => undefined);
    else if (unlocked) void ctx.resume().catch(() => undefined);
  });
}
export function audioUnlocked(): boolean {
  return unlocked && ctx?.state === 'running';
}

function decode(c: Ctx, data: ArrayBuffer): Promise<AudioBuffer> {
  // 구형 Safari 는 콜백형만 지원
  return new Promise((res, rej) => {
    const p = c.decodeAudioData(data, res, rej) as unknown as Promise<AudioBuffer> | undefined;
    if (p && typeof p.then === 'function') p.then(res, rej);
  });
}

function load(file: string): Promise<AudioBuffer | null> {
  const hit = buffers.get(file);
  if (hit) return Promise.resolve(hit);
  let p = loading.get(file);
  if (!p) {
    const c = makeCtx();
    p = !c
      ? Promise.resolve(null)
      : fetch(`${BASE}${file}.${file.startsWith('bgm') ? 'mp3' : 'wav'}`)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
          .then((d) => decode(c, d))
          .then((b) => {
            buffers.set(file, b);
            return b;
          })
          .catch(() => null);
    loading.set(file, p);
  }
  return p;
}

/** 미리 디코딩 (게임 중 첫 재생 지연 방지) */
export function preloadAudio(which: 'menu' | 'game'): Promise<void> {
  const list =
    which === 'menu'
      ? ['bgm-title', 'bgm-select', 'sfx-menuMove', 'sfx-menuOk', 'sfx-start']
      : [...BGM_NAMES.map((b) => `bgm-${b}`), ...SFX_NAMES.map((s) => `sfx-${s}`)];
  return Promise.all(list.map(load)).then(() => undefined);
}

// ───────── BGM ─────────
interface Playing {
  name: BgmName;
  src: AudioBufferSourceNode | null;
  gain: GainNode;
}
let cur: Playing | null = null;
let wanted: BgmName | null = null;

function fadeOutAndStop(p: Playing, sec: number): void {
  if (!ctx) return;
  const t = ctx.currentTime;
  p.gain.gain.cancelScheduledValues(t);
  p.gain.gain.setValueAtTime(p.gain.gain.value, t);
  p.gain.gain.linearRampToValueAtTime(0, t + Math.max(0.02, sec));
  const s = p.src;
  if (s) {
    try {
      s.stop(t + Math.max(0.02, sec) + 0.05);
    } catch {
      /* 이미 멈춤 */
    }
  }
  window.setTimeout(() => p.gain.disconnect(), (sec + 0.3) * 1000);
}

/** BGM 전환: 같은 곡이면 그대로, 다른 곡이면 이전 곡 fadeOut 초 동안 줄이고 새 곡 fadeIn */
export function playBgm(name: BgmName, fadeOut = 0.6, fadeIn = 0.05): void {
  const c = makeCtx();
  if (!c || !musicBus) return;
  if (cur && cur.name === name && wanted === name) return;
  wanted = name;
  if (cur) {
    fadeOutAndStop(cur, fadeOut);
    cur = null;
  }
  void load(`bgm-${name}`).then((buf) => {
    if (!buf || wanted !== name || !musicBus || (cur && cur.name === name)) return;
    const g = c.createGain();
    const info = BGM[name];
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
  if (muted || !ctx || !sfxBus || ctx.state !== 'running') return null;
  const buf = buffers.get(`sfx-${name}`);
  if (!buf) {
    void load(`sfx-${name}`);
    return null;
  }
  const cfg = SFX[name];
  const now = ctx.currentTime;
  if (now - (lastAt.get(name) ?? -9) < cfg.gap) return null;
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
  s.start(now);
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
    /* 저장 불가(사파리 비공개 모드)는 무시 */
  }
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.03);
}

/** 검수용 상태 (자동 테스트에서 BGM 중복·잠금 여부 확인) */
export function audioState(): { ctx: string; unlocked: boolean; bgm: string | null; wanted: string | null; buffers: number; voices: number } {
  let voices = 0;
  for (const l of active.values()) voices += l.length;
  return { ctx: ctx?.state ?? 'none', unlocked, bgm: cur?.name ?? null, wanted, buffers: buffers.size, voices };
}

/** 검수용: 게임 전체 출력(BGM+효과음)을 MediaStream 으로 (플레이 영상 녹음용 · ?skytest 에서만 사용) */
export function audioTap(): MediaStream | null {
  const c = makeCtx();
  if (!c || !master) return null;
  const d = c.createMediaStreamDestination();
  master.connect(d);
  return d.stream;
}
