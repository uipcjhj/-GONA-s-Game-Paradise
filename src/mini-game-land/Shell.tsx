import { useEffect, useState } from 'react';
import Challenge from './modes/Challenge';
import FreePlay from './modes/FreePlay';
import { fxCssVars } from './core/fx';
import { Background } from './skin/components';
import { SkinProvider, useSkin } from './skin/context';
import { resolveSkinId } from './skin/skins';
import { bgm } from '../audio/bgm';
import Home, { type Screen } from './ui/Home';
import Records from './ui/Records';
import { audio, store } from './services';

/** 스킨 토큰(CSS 변수)을 문서에 적용 — 바깥 여백(body)까지 스킨이 정할 수 있게 root 에 둠 */
function useSkinTokens() {
  const { tokens } = useSkin();
  useEffect(() => {
    const root = document.documentElement;
    const all = { ...tokens, ...fxCssVars() }; // 효과 시간은 스킨이 덮어쓸 수 없음(JS 타이머와 같은 값)
    const keys = Object.keys(all);
    keys.forEach((k) => root.style.setProperty(k, all[k]));
    return () => keys.forEach((k) => root.style.removeProperty(k));
  }, [tokens]);
}

/** 화면 상태기계: Home → FreePlay | Challenge | Records. 한 번에 하나의 모드만 마운트(전환 시 언마운트 → 정리). */
function Frame() {
  const skin = useSkin();
  useSkinTokens();
  const [screen, setScreen] = useState<Screen>('home');
  const home = () => setScreen('home');
  // 메뉴 곡(게임 중에는 Round 가 'play' 곡으로 바꿈). 소리 끄기 설정을 따름
  useEffect(() => {
    bgm.setEnabled(!store.get().settings.muted);
    bgm.play('mini');
  }, [screen]);
  return (
    <div className="mgl-frame" onPointerDown={() => { audio.unlock(); bgm.unlock(); }} data-screen={screen} data-skin={skin.id}>
      <Background scene={screen === 'home' || screen === 'records' ? 'menu' : 'play'} />
      {screen === 'home' && <Home go={setScreen} />}
      {screen === 'free' && <FreePlay exit={home} />}
      {screen === 'challenge' && <Challenge exit={home} />}
      {screen === 'records' && <Records back={home} />}
    </div>
  );
}

export default function Shell() {
  return (
    <SkinProvider skinId={resolveSkinId(location.search)}>
      <Frame />
    </SkinProvider>
  );
}
