import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { buildBackup } from './backup';
import * as E from './engine';
import { getGame } from './games';
import { buzz } from './haptics';
import { finishConsume, planConsume } from './inbox';
import { buildLaunchUrl } from './launch';
import { INBOX_PREFIX, KEYS } from './keys';
import { createMemoryStorage, browserStorage, createPlayer, loadPlayer, resetPlatformData, savePlayer, withProfile, type LoadStatus } from './store';
import type { KV, PlayerData, PlayerSettings, ShopSlot } from './types';
import { OnlineClient, ONLINE_API, type OnlineStatus } from '../services/online';
import { HttpRankingProvider } from '../services/rankingHttp';
import { NullRankingProvider, type RankingProvider } from '../services/ranking';

export type { Notice, ResultSummary } from './engine';

export interface ResultView {
  summaries: E.ResultSummary[];
  /** 저장에 실패해 아직 기록에 반영되지 않음(inbox 에 보관 중) */
  saveFailed: boolean;
}

interface Ctx {
  player: PlayerData | null;
  loadStatus: LoadStatus;
  /** false 면 이 브라우저에서 저장이 안 됨 */
  persistent: boolean;
  notices: E.Notice[];
  dismissNotice(count?: number): void;
  result: ResultView | null;
  dismissResult(): void;
  retryConsume(): void;
  register(nickname: string, avatarId: string): PlayerData | null;
  updateProfile(patch: { nickname?: string; avatarId?: string }): boolean;
  updateSettings(patch: Partial<PlayerSettings>): void;
  restore(p: PlayerData): void;
  reset(): void;
  touch(): void;
  discardCorrupt(): void;
  exportText(): { text: string; filename: string } | null;
  launch(gameId: string, baseUrl: string): { url: string; linked: boolean };
  visit(kind: string, islandId?: string): void;
  checkIn(): void;
  claimMission(id: string): void;
  buy(itemId: string): E.BuyResult;
  equip(itemId: string): void;
  unequip(slot: ShopSlot): void;
  setTitle(id: string): boolean;
  pinAchievement(id: string | undefined): void;
  /** 온라인 랭킹: 서버 주소가 설정된 빌드에서만 enabled. 아니면 로컬 모드 */
  online: { enabled: boolean; status: OnlineStatus; pending: number };
  /** 랭킹 조회 제공자(서버 미연결이면 NullRankingProvider) */
  rankingProvider: RankingProvider;
  /** 섬 팝업을 열 때 서버 세션을 미리 만들어 둔다(PLAY 클릭은 동기라서) */
  prepareLaunch(gameId: string): void;
  /** 개발용: 저장소 직접 접근(시뮬레이터) */
  storage: KV;
  consume(): Promise<void>;
}

const PlayerCtx = createContext<Ctx | null>(null);
export const usePlayer = (): Ctx => {
  const c = useContext(PlayerCtx);
  if (!c) throw new Error('PlayerProvider 밖에서 usePlayer 를 사용했어요');
  return c;
};

/** 여러 탭이 동시에 결과를 처리하지 않도록 Web Locks 로 직렬화 (미지원이면 그냥 실행 — 원장이 중복을 막음) */
async function withLock<T>(fn: () => T): Promise<T> {
  const locks = (typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockManager }).locks : undefined);
  if (locks?.request) {
    try {
      return await locks.request('gp-consume', async () => fn());
    } catch {
      /* 락 실패 → 그냥 실행 */
    }
  }
  return fn();
}

export function PlayerProvider({ children, storage }: { children: ReactNode; storage?: KV }) {
  const kvRef = useRef<KV | null>(null);
  if (kvRef.current === null) kvRef.current = storage ?? browserStorage() ?? createMemoryStorage();
  const kv = kvRef.current;
  const durable = useRef(storage !== undefined || browserStorage() !== null);
  const [init] = useState(() => loadPlayer(kv));
  const [player, setPlayer] = useState<PlayerData | null>(init.player);
  const playerRef = useRef<PlayerData | null>(init.player);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>(init.status);
  const [persistent, setPersistent] = useState(durable.current);
  const [notices, setNotices] = useState<E.Notice[]>([]);
  const [result, setResult] = useState<ResultView | null>(null);
  const [onlineStatus, setOnlineStatus] = useState<OnlineStatus>(ONLINE_API ? 'connecting' : 'off');
  const [pending, setPending] = useState(0);
  const clientRef = useRef<OnlineClient | null>(null);
  if (ONLINE_API && clientRef.current === null) clientRef.current = new OnlineClient(kv, ONLINE_API);
  const prepared = useRef<Record<string, { id: string; at: number }>>({});

  /** 온라인: 등록(최초 1회) → 프로필 동기화 → 대기열 전송. 실패해도 로컬 기능에는 영향 없음 */
  const syncOnline = useCallback(async () => {
    const c = clientRef.current;
    const p = playerRef.current;
    if (!c || !p) return;
    const id = await c.ensureRegistered(p);
    if (id) {
      await c.syncProfile(p);
      const r = await c.flush();
      setPending(r.pending);
    }
    setOnlineStatus(c.status);
  }, []);

  /** 최신 저장본을 기준으로 변경 → 한 번 저장 → 상태 갱신. (다른 탭이 바꿨어도 덮어쓰지 않게 매번 저장소에서 다시 읽음) */
  const mutate = useCallback(
    <T,>(fn: (p: PlayerData) => { player: PlayerData; notices?: E.Notice[]; data?: T; changed?: boolean }): T | undefined => {
      const fresh = durable.current ? loadPlayer(kv).player : null;
      const base = fresh ?? playerRef.current;
      if (!base) return undefined;
      const out = fn(base);
      if (out.changed === false && !out.notices?.length) {
        if (fresh && fresh !== playerRef.current) {
          playerRef.current = fresh;
          setPlayer(fresh);
        }
        return out.data;
      }
      const ok = savePlayer(kv, out.player);
      if (!ok) {
        durable.current = false;
        setPersistent(false);
      }
      playerRef.current = out.player;
      setPlayer(out.player);
      if (out.notices?.length) {
        setNotices((n) => [...n, ...out.notices!]);
        if (out.notices.some((x) => x.kind === 'levelup' || x.kind === 'achievement')) buzz(out.player.settings.vibration, 30);
      }
      return out.data;
    },
    [kv],
  );

  const consume = useCallback(async () => {
    if (!playerRef.current) return;
    await withLock(() => {
      const fresh = durable.current ? loadPlayer(kv).player : playerRef.current;
      if (!fresh) return;
      const now = Date.now();
      const plan = planConsume(kv, fresh, now);
      if (!plan.changed && !plan.deleteKeys.length) {
        if (fresh !== playerRef.current) {
          playerRef.current = fresh;
          setPlayer(fresh);
        }
        return;
      }
      let ok = true;
      if (plan.changed) {
        ok = savePlayer(kv, plan.player);
        if (!ok) {
          durable.current = false;
          setPersistent(false);
        }
      }
      if (ok) finishConsume(kv, plan, now); // 저장 성공 후에만 inbox 정리 (실패하면 남겨 재시도)
      playerRef.current = ok ? plan.player : fresh;
      setPlayer(ok ? plan.player : fresh);
      const real = plan.summaries.filter((s) => !s.duplicate);
      if (real.length) setResult({ summaries: real, saveFailed: !ok });
      if (ok && clientRef.current) {
        // 서버가 시작 시각을 잰 세션(serverSessionId)이 있는 판만 온라인 제출 — 이전 로컬 기록은 올리지 않음
        for (const a of plan.accepted) {
          if (!a.serverSessionId) continue;
          const r = a.result;
          clientRef.current.enqueue({ resultId: r.resultId, serverSessionId: a.serverSessionId, body: { resultId: r.resultId, outcome: r.outcome, score: r.score, stage: r.stage, durationMs: r.durationMs, gameVersion: r.gameVersion, scoreSchemaVersion: r.scoreSchemaVersion, ...(r.subGameId ? { subGameId: r.subGameId } : {}) } });
        }
        if (plan.accepted.length) void syncOnline();
      }
      if (ok && plan.notices.length) {
        setNotices((n) => [...n, ...plan.notices]);
        buzz(plan.player.settings.vibration, 30);
      }
    });
  }, [kv, syncOnline]);

  // 돌아왔을 때(앱 시작 · 탭 복귀 · bfcache 복귀 · 다른 탭에서 기록) 같은 함수로 처리
  useEffect(() => {
    const run = () => void consume();
    run();
    const onVis = () => document.visibilityState === 'visible' && run();
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEYS.player) {
        const l = loadPlayer(kv);
        if (l.player) {
          playerRef.current = l.player;
          setPlayer(l.player);
        }
      } else if (e.key && e.key.startsWith(INBOX_PREFIX)) run();
    };
    window.addEventListener('pageshow', run);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('pageshow', run);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('storage', onStorage);
    };
  }, [consume, kv]);

  // 온라인: 플레이어가 있으면 연결 시도(주기적으로 재시도 — 서버 복구 후 대기열 동기화)
  useEffect(() => {
    if (!clientRef.current || !player) return;
    void syncOnline();
    const t = window.setInterval(() => void syncOnline(), 60_000);
    const onVis = () => document.visibilityState === 'visible' && void syncOnline();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [!!player, syncOnline]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    void clientRef.current?.syncProfile(player as PlayerData);
  }, [player?.nickname, player?.avatarId, player?.titleId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 접근성: 모션 줄이기 설정을 문서에 반영
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = player?.settings.reduceMotion ? '1' : '0';
  }, [player?.settings.reduceMotion]);

  const value = useMemo<Ctx>(
    () => ({
      player,
      loadStatus,
      persistent,
      notices,
      dismissNotice: (count = 1) => setNotices((n) => n.slice(count)),
      result,
      dismissResult: () => setResult(null),
      retryConsume: () => {
        setResult(null);
        void consume();
      },
      register(nickname, avatarId) {
        const r = createPlayer(nickname, avatarId);
        if (!r.ok) return null;
        const first = E.checkIn(r.player, Date.now());
        const p = first.player;
        const ok = savePlayer(kv, p);
        if (!ok) {
          durable.current = false;
          setPersistent(false);
        }
        playerRef.current = p;
        setPlayer(p);
        setLoadStatus('ok');
        setNotices(first.notices);
        try {
          sessionStorage.removeItem(KEYS.draft);
        } catch {
          /* 무시 */
        }
        return p;
      },
      updateProfile(patch) {
        return !!mutate((p) => {
          const n = withProfile(p, patch);
          return n ? { player: n, data: true } : { player: p, data: false, changed: false };
        });
      },
      updateSettings(patch) {
        mutate((p) => ({ player: E.updateSettingsPure(p, patch) }));
      },
      restore(p) {
        const np = { ...p, lastPlayedAt: new Date().toISOString() };
        savePlayer(kv, np);
        playerRef.current = np;
        setPlayer(np);
        setLoadStatus('ok');
        void consume();
      },
      reset() {
        resetPlatformData(kv);
        try {
          sessionStorage.removeItem(KEYS.draft);
        } catch {
          /* 무시 */
        }
        playerRef.current = null;
        setPlayer(null);
        setLoadStatus('none');
        setNotices([]);
        setResult(null);
      },
      touch() {
        mutate((p) => ({ player: { ...p, lastPlayedAt: new Date().toISOString() } }));
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
      launch(gameId, baseUrl) {
        const p = playerRef.current;
        if (!p) return { url: baseUrl, linked: false };
        mutate((c) => E.recordLaunch(c, gameId, Date.now()));
        const pre = prepared.current[gameId];
        const serverSid = pre && Date.now() - pre.at < 11 * 3600_000 ? pre.id : undefined; // 서버 세션이 준비돼 있을 때만 온라인 제출 대상
        delete prepared.current[gameId];
        const out = buildLaunchUrl(kv, gameId, baseUrl, playerRef.current ?? p, location.href.split('#')[0], Date.now(), serverSid);
        return out;
      },
      visit: (kind, islandId) => void mutate((p) => E.recordVisit(p, kind, Date.now(), islandId)),
      checkIn: () => void mutate((p) => E.checkIn(p, Date.now())),
      claimMission: (id) => void mutate((p) => E.claimMission(p, id, Date.now())),
      buy: (id) => mutate((p) => E.buyItem(p, id, Date.now())) ?? 'unknown',
      equip: (id) => void mutate((p) => E.equipItem(p, id, Date.now())),
      unequip: (slot) => void mutate((p) => E.unequipSlot(p, slot, Date.now())),
      setTitle: (id) => !!mutate((p) => E.setTitle(p, id, Date.now())),
      pinAchievement: (id) => void mutate((p) => E.pinAchievement(p, id, Date.now())),
      online: { enabled: !!ONLINE_API, status: onlineStatus, pending },
      rankingProvider: clientRef.current && clientRef.current.identity() ? new HttpRankingProvider(clientRef.current.base, clientRef.current.identity()!.token) : ONLINE_API ? new HttpRankingProvider(ONLINE_API, null) : NullRankingProvider,
      prepareLaunch(gameId) {
        const c = clientRef.current;
        if (!c) return;
        void c.createSession(gameId).then((id) => {
          if (id) prepared.current[gameId] = { id, at: Date.now() };
          setOnlineStatus(c.status);
        });
      },
      storage: kv,
      consume,
    }),
    [player, loadStatus, persistent, notices, result, kv, mutate, consume, onlineStatus, pending],
  );
  return <PlayerCtx.Provider value={value}>{children}</PlayerCtx.Provider>;
}

export const gameLink = (id: string): 'pending' | 'live' => getGame(id)?.link ?? 'pending';
