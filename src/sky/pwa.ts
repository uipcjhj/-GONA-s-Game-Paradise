/**
 * 설치형 웹앱(PWA): Service Worker 등록 · 새 버전 감지 · 홈 화면 설치 안내 · 오프라인용 전체 받기
 *  (manifest · sw.js · 아이콘은 빌드 후 tools/sky-pwa.py 가 정식판 폴더에만 만듦)
 */
type Listener = () => void;
const ls = new Set<Listener>();
const emit = (): void => ls.forEach((f) => f());
export const pwa = {
  update: false,
  progress: null as { done: number; total: number } | null,
  canPrompt: false,
  standalone: typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true),
  ios: typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent),
};
export function onPwa(f: Listener): () => void { ls.add(f); return () => ls.delete(f); }
let waiting: ServiceWorker | null = null;
let promptEv: (Event & { prompt: () => Promise<void> }) | null = null;

export function registerPwa(): void {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); promptEv = e as typeof promptEv; pwa.canPrompt = true; emit(); });
  navigator.serviceWorker.register('./sw.js', { scope: './' }).then((reg) => {
    const mark = (w: ServiceWorker | null): void => { if (w && navigator.serviceWorker.controller) { waiting = w; pwa.update = true; emit(); } };
    if (reg.waiting) mark(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed') mark(w); });
    });
    // 오래 켜 둔 화면에서도 새 버전을 알아챔 (화면 복귀 때 확인)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void reg.update().catch(() => {}); });
  }).catch(() => { /* 지원 안 하는 브라우저 · 사설 모드 → 그냥 웹으로 */ });
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (pwa.update && !reloaded) { reloaded = true; location.reload(); } });
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'precache') { pwa.progress = { done: e.data.done, total: e.data.total }; emit(); }
  });
}
/** 새 버전으로 바꾸기 (게임 중이 아닐 때 사용자가 누름) */
export function applyUpdate(): void { waiting?.postMessage('skip-waiting'); }
/** 안드로이드 크롬 등: 설치 창 띄우기 */
export async function promptInstall(): Promise<void> { if (promptEv) { await promptEv.prompt(); promptEv = null; pwa.canPrompt = false; emit(); } }
/** 오프라인으로도 6스테이지를 할 수 있게 게임 그림·소리 전부 미리 받기 (앨범 원본 사진은 볼 때만) */
export function precacheAll(): void {
  pwa.progress = { done: 0, total: 1 };
  emit();
  navigator.serviceWorker?.controller?.postMessage('precache-core');
}
