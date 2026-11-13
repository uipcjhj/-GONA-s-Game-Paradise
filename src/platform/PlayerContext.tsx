import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { buildBackup } from './backup';
import { KEYS } from './keys';
import { createMemoryStorage, browserStorage, createPlayer, loadPlayer, resetPlatformData, savePlayer, withProfile, type LoadStatus } from './store';
import type { KV, PlayerData } from './types';

interface Ctx {
  player: PlayerData | null;
  /** 시작 시 읽은 상태 (corrupt 면 복구 안내 화면) */
  loadStatus: LoadStatus;
  /** false 면 이 브라우저에서 저장이 안 됨(사생활 보호 모드 등) */
  persistent: boolean;
  register(nickname: string, avatarId: string): PlayerData | null;
  updateProfile(patch: { nickname?: string; avatarId?: string }): boolean;
  updateSettings(patch: { bgm?: boolean }): void;
  restore(p: PlayerData): void;
  reset(): void;
  touch(): void;
  /** 손상 안내에서 '새로 시작' */
  discardCorrupt(): void;
  exportText(): { text: string; filename: string } | null;
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
  const [player, setPlayer] = useState<PlayerData | null>(init.player);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>(init.status);
  const [persistent, setPersistent] = useState(persistentRef.current);

  const commit = useCallback(
    (p: PlayerData) => {
      const ok = savePlayer(kv, p);
      if (!ok) setPersistent(false);
      setPlayer(p);
    },
    [kv],
  );

  const value = useMemo<Ctx>(
    () => ({
      player,
      loadStatus,
      persistent,
      register(nickname, avatarId) {
        const r = createPlayer(nickname, avatarId);
        if (!r.ok) return null;
        commit(r.player);
        setLoadStatus('ok');
        try {
          sessionStorage.removeItem(KEYS.draft);
        } catch {
          /* 무시 */
        }
        return r.player;
      },
      updateProfile(patch) {
        if (!player) return false;
        const next = withProfile(player, patch);
        if (!next) return false;
        commit(next);
        return true;
      },
      updateSettings(patch) {
        if (player) commit({ ...player, settings: { ...player.settings, ...patch } });
      },
      restore(p) {
        commit({ ...p, lastPlayedAt: new Date().toISOString() });
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
        setLoadStatus('none');
      },
      touch() {
        if (player) commit({ ...player, lastPlayedAt: new Date().toISOString() });
      },
      discardCorrupt() {
        try {
          kv.removeItem(KEYS.player);
        } catch {
          /* 무시 */
        }
        setLoadStatus('none');
      },
      exportText: () => (player ? buildBackup(player) : null),
    }),
    [player, loadStatus, persistent, commit, kv],
  );
  return <PlayerCtx.Provider value={value}>{children}</PlayerCtx.Provider>;
}
