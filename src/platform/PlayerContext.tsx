import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { achievementsLoop } from './achievementsLoop';
import { getAchievement } from './achievements';
import { buildBackup } from './backup';
import { CODEX } from './codex';
import type { ResultOutcome } from './engine';
import { consumeInbox } from './inbox';
import { INBOX_PREFIX, KEYS } from './keys';
import { claimAttendance, claimMission, ensureMissions, type ClaimResult } from './missions';
import { importBest } from './records';
import { createSession, pruneSessions } from './session';
import { buyItem, equipItem, getItem, type BuyResult, type ItemKind } from './shop';
import { browserStorage, createMemoryStorage, createPlayer, listKeys, loadPlayer, resetPlatformData, savePlayer, withProfile, type LoadStatus } from './store';
import type { KV, PlayerData, PlayerSettings } from './types';

export interface News {
  kind: 'achievement' | 'codex' | 'item';
  text: string;
}
interface Ctx {
  player: PlayerData | null;
  /** 시작 시 읽은 상태 (corrupt 면 복구 안내 화면) */
  loadStatus: LoadStatus;
  /** false 면 이 브라우저에서 저장이 안 됨(사생활 보호 모드 등) */
  persistent: boolean;
  /** 아직 보여 주지 않은 게임 결과(오래된 것 → 최신) */
  results: ResultOutcome[];
  dismissResults(): void;
  /** inbox 에 반영하지 못한 결과가 남아 있음(저장 실패) */
  saveFailed: boolean;
  /** 이번 세션에서 걸러진(의심·형식 오류) 결과 수 */
  rejectedCount: number;
  retryConsume(): void;
  /** 업적·도감 등 새로 생긴 소식(토스트용) */
  news: News[];
  clearNews(): void;
  register(nickname: string, avatarId: string): PlayerData | null;
  updateProfile(patch: { nickname?: string; avatarId?: string }): boolean;
  updateSettings(patch: Partial<PlayerSettings>): void;
  restore(p: PlayerData): void;
  reset(): void;
  touch(): void;
  /** 손상 안내에서 '새로 시작' */
  discardCorrupt(): void;
  exportText(): { text: string; filename: string } | null;
  /** PLAY: 실행 세션을 만들고 게임 주소(gp=세션)를 돌려줌. 실패하면 원래 주소 */
  launch(gameId: string, url: string): string;
  claimMission(id: string): ClaimResult;
  claimAttendance(): ClaimResult;
  buy(id: string): BuyResult;
  equip(id: string | null, kind: ItemKind): boolean;
  /** 이전 Food 최고 기록 가져오기(읽기 전용 값만 전달) */
  importPrevious(gameId: string, score: number, stage?: number): boolean;
  /** 연동 대기 중인 inbox 키 수 */
  pendingInbox(): number;
  storage: KV;
}

const PlayerCtx = createContext<Ctx | null>(null);
export const usePlayer = (): Ctx => {
  const c = useContext(PlayerCtx);
  if (!c) throw new Error('PlayerProvider 밖에서 usePlayer 를 사용했어요');
  return c;
};

export function PlayerProvider({ children, storage }: { children: ReactNode; storage?: KV }) {
  const kvRef = useRef<KV | null>(null);
  if (kvRef.current === null) kvRef.current = storage ?? browserStorage() ?? createMemoryStorage();
  const kv = kvRef.current;
  const persistentRef = useRef(storage !== undefined || browserStorage() !== null);
  const [init] = useState(() => loadPlayer(kv));
  const [player, setPlayerState] = useState<PlayerData | null>(init.player);
  const playerRef = useRef<PlayerData | null>(init.player);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>(init.status);
  const [persistent, setPersistent] = useState(persistentRef.current);
  const [results, setResults] = useState<ResultOutcome[]>([]);
  const [saveFailed, setSaveFailed] = useState(false);
  const [rejectedCount, setRejected] = useState(0);
  const [news, setNews] = useState<News[]>([]);

  const setPlayer = useCallback((p: PlayerData | null) => {
    playerRef.current = p;
    setPlayerState(p);
  }, []);

  /** 저장 + 업적/도감 확인(보상 알림 생성) */
  const commit = useCallback(
    (p0: PlayerData, opts: { silent?: boolean } = {}) => {
      const now = new Date();
      const loop = achievementsLoop(p0, now);
      const p = loop.player;
      if (!opts.silent && (loop.achievements.length || loop.codex.length)) {
        const items: News[] = [
          ...loop.achievements.map((id) => ({ kind: 'achievement' as const, text: `업적 달성! ${getAchievement(id)?.name ?? id}` })),
          ...loop.codex.map((id) => ({ kind: 'codex' as const, text: `도감 등록: ${CODEX.find((c) => c.id === id)?.name ?? id}` })),
        ];
        const titles = loop.achievements.map((id) => getAchievement(id)?.rewardTitle).filter((x): x is string => !!x);
        for (const t of titles) items.push({ kind: 'item', text: `칭호 획득: ${getItem(t)?.name ?? t}` });
        setNews((n) => [...n, ...items]);
      }
      const ok = savePlayer(kv, p);
      if (!ok) setPersistent(false);
      setPlayer(p);
      return p;
    },
    [kv, setPlayer],
  );

  const consume = useCallback(() => {
    const cur = playerRef.current;
    if (!cur) return;
    if (listKeys(kv, INBOX_PREFIX).length === 0) return;
    const run = () => {
      const latest = playerRef.current; // 잠금을 기다리는 동안 바뀌었을 수 있음
      if (!latest) return;
      const rep = consumeInbox(kv, loadPlayer(kv).player ?? latest);
      setSaveFailed(rep.saveFailed);
      if (rep.rejected.length) setRejected((n) => n + rep.rejected.length);
      if (rep.applied.length) {
        setPlayer(rep.player);
        setResults((r) => [...r, ...rep.applied]);
        const items: News[] = [];
        for (const o of rep.applied) {
          for (const id of o.achievements) items.push({ kind: 'achievement', text: `업적 달성! ${getAchievement(id)?.name ?? id}` });
          for (const id of o.codex) items.push({ kind: 'codex', text: `도감 등록: ${CODEX.find((c) => c.id === id)?.name ?? id}` });
        }
        if (items.length) setNews((n) => [...n, ...items]);
      } else if (rep.duplicates && rep.player !== latest) setPlayer(rep.player);
    };
    const locks = (navigator as Navigator & { locks?: { request(name: string, cb: () => void): Promise<void> } }).locks;
    if (locks) void locks.request('gp-consume', run).catch(run);
    else run();
  }, [kv, setPlayer]);

  // 돌아오는 모든 경로(시작·bfcache 복귀·탭 복귀·다른 탭 기록)에서 같은 함수로 수신
  useEffect(() => {
    consume();
    pruneSessions(kv);
    const onVis = () => document.visibilityState === 'visible' && consume();
    const onShow = () => consume();
    const onStorage = (e: StorageEvent) => (e.key === null || e.key.startsWith(INBOX_PREFIX)) && consume();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pageshow', onShow);
    window.addEventListener('storage', onStorage);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pageshow', onShow);
      window.removeEventListener('storage', onStorage);
    };
  }, [consume, kv]);

  const value = useMemo<Ctx>(
    () => ({
      player,
      loadStatus,
      persistent,
      results,
      dismissResults: () => setResults([]),
      saveFailed,
      rejectedCount,
      retryConsume: consume,
      news,
      clearNews: () => setNews([]),
      register(nickname, avatarId) {
        const r = createPlayer(nickname, avatarId);
        if (!r.ok) return null;
        commit(ensureMissions(r.player, new Date()), { silent: true });
        setLoadStatus('ok');
        try {
          sessionStorage.removeItem(KEYS.draft);
        } catch {
          /* 무시 */
        }
        return r.player;
      },
      updateProfile(patch) {
        const cur = playerRef.current;
        if (!cur) return false;
        const next = withProfile(cur, patch);
        if (!next) return false;
        commit(next);
        return true;
      },
      updateSettings(patch) {
        const cur = playerRef.current;
        if (cur) commit({ ...cur, settings: { ...cur.settings, ...patch } });
      },
      restore(p) {
        commit({ ...p, lastPlayedAt: new Date().toISOString() }, { silent: true });
        setLoadStatus('ok');
      },
      reset() {
        resetPlatformData(kv);
        try {
          sessionStorage.removeItem(KEYS.draft);
        } catch {
          /* 무시 */
        }
        setPlayer(null);
        setResults([]);
        setLoadStatus('none');
      },
      touch() {
        const cur = playerRef.current;
        if (cur) commit(ensureMissions({ ...cur, lastPlayedAt: new Date().toISOString() }, new Date()));
      },
      discardCorrupt() {
        try {
          kv.removeItem(KEYS.player);
        } catch {
          /* 무시 */
        }
        setLoadStatus('none');
      },
      exportText: () => (playerRef.current ? buildBackup(playerRef.current) : null),
      launch(gameId, url) {
        const cur = playerRef.current;
        if (!cur) return url;
        const returnUrl = `${window.location.origin}${window.location.pathname}`;
        const s = createSession(kv, cur, gameId, returnUrl);
        if (!s) return url;
        return `${url}${url.includes('?') ? '&' : '?'}gp=${encodeURIComponent(s.sessionId)}`;
      },
      claimMission(id) {
        const cur = playerRef.current;
        if (!cur) return { ok: false, error: 'none' };
        const r = claimMission(cur, id, new Date());
        if (r.ok) commit(r.player);
        return r;
      },
      claimAttendance() {
        const cur = playerRef.current;
        if (!cur) return { ok: false, error: 'none' };
        const r = claimAttendance(cur, new Date());
        if (r.ok) commit(r.player);
        return r;
      },
      buy(id) {
        const cur = playerRef.current;
        if (!cur) return { ok: false, error: 'unknown' };
        const r = buyItem(cur, id, new Date());
        if (r.ok) commit(r.player);
        return r;
      },
      equip(id, kind) {
        const cur = playerRef.current;
        const next = cur ? equipItem(cur, id, kind) : null;
        if (next) commit(next);
        return !!next;
      },
      importPrevious(gameId, score, stage) {
        const cur = playerRef.current;
        const next = cur ? importBest(cur, gameId, score, stage, new Date()) : null;
        if (next) commit(next);
        return !!next;
      },
      pendingInbox: () => listKeys(kv, INBOX_PREFIX).length,
      storage: kv,
    }),
    [player, loadStatus, persistent, results, saveFailed, rejectedCount, news, commit, consume, kv, setPlayer],
  );
  return <PlayerCtx.Provider value={value}>{children}</PlayerCtx.Provider>;
}
