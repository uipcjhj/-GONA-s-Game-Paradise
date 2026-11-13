import { useState } from 'react';
import { gonaUrl } from '../assets';
import { audio, store } from '../services';

export type Screen = 'home' | 'free' | 'challenge' | 'records';

export default function Home({ go }: { go: (s: Screen) => void }) {
  const [muted, setMuted] = useState(store.get().settings.muted);
  const toggle = () => {
    const next = !muted;
    setMuted(next);
    audio.setMuted(next);
    store.set({ ...store.get(), settings: { ...store.get().settings, muted: next } });
  };
  return (
    <div className="mgl-screen mgl-home" data-testid="home">
      <div className="mgl-title">
        <h1>
          <span>GONA's</span>
          <span>Mini Game Land</span>
        </h1>
        <p>고나의 미니게임천국</p>
      </div>
      <img src={gonaUrl} alt="고나" className="mgl-hero" draggable={false} />
      <div className="mgl-menu">
        <button type="button" className="mgl-btn mgl-btn-primary mgl-btn-lg" data-testid="go-free" onClick={() => go('free')}>
          자유 플레이
        </button>
        <button type="button" className="mgl-btn mgl-btn-lg" data-testid="go-challenge" onClick={() => go('challenge')}>
          랜덤 챌린지
        </button>
        <button type="button" className="mgl-btn" data-testid="go-records" onClick={() => go('records')}>
          내 기록
        </button>
      </div>
      <div className="mgl-foot">
        <a className="mgl-btn mgl-btn-sm" href="../" data-testid="back-hub">
          ← 게임천국
        </a>
        <button type="button" className="mgl-btn mgl-btn-sm" data-testid="sound" aria-pressed={!muted} onClick={toggle}>
          소리 {muted ? '꺼짐' : '켜짐'}
        </button>
      </div>
      {!store.persistent && <p className="mgl-note">이 브라우저에서는 기록이 저장되지 않아요.</p>}
    </div>
  );
}
