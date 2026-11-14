import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_SKIN, loadSkin } from './skins';
import type { ResolvedSkin } from './types';

const Ctx = createContext<ResolvedSkin | null>(null);

export function useSkin(): ResolvedSkin {
  const s = useContext(Ctx);
  if (!s) throw new Error('SkinProvider 안에서만 사용할 수 있어요');
  return s;
}

/** 선택된 스킨을 불러온 뒤 하위 화면을 그림. 실패하면 기본 스킨으로 대체 */
export function SkinProvider({ skinId, children }: { skinId: string; children: ReactNode }) {
  const [skin, setSkin] = useState<ResolvedSkin | null>(null);
  useEffect(() => {
    let alive = true;
    loadSkin(skinId)
      .catch((e) => {
        console.warn(`[mini-game-land] 스킨 '${skinId}' 로드 실패 → '${DEFAULT_SKIN}' 사용`, e);
        return loadSkin(DEFAULT_SKIN);
      })
      .then((s) => alive && setSkin(s));
    return () => {
      alive = false;
    };
  }, [skinId]);
  if (!skin) return null; // 로딩 중에는 body 의 부팅 색(--mgl-boot-bg)만 보임
  return <Ctx.Provider value={skin}>{children}</Ctx.Provider>;
}
