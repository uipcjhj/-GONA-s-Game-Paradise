import { useState } from 'react';
import Challenge from './modes/Challenge';
import FreePlay from './modes/FreePlay';
import Home, { type Screen } from './ui/Home';
import Records from './ui/Records';
import { audio } from './services';

/** 화면 상태기계: Home → FreePlay | Challenge | Records. 한 번에 하나의 모드만 마운트(전환 시 언마운트 → 정리). */
export default function Shell() {
  const [screen, setScreen] = useState<Screen>('home');
  const home = () => setScreen('home');
  return (
    <div className="mgl-frame" onPointerDown={() => audio.unlock()} data-screen={screen}>
      {screen === 'home' && <Home go={setScreen} />}
      {screen === 'free' && <FreePlay exit={home} />}
      {screen === 'challenge' && <Challenge exit={home} />}
      {screen === 'records' && <Records back={home} />}
    </div>
  );
}
