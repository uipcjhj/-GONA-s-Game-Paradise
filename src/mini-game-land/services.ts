import { AudioSystem } from './core/audio';
import { SaveStore } from './core/storage';
import { createGP } from '../platform/sdk/gp-sdk';

/** 페이지당 하나씩만 쓰는 서비스(오디오 · 기록 저장) */
export const store = new SaveStore();
export const audio = new AudioSystem();
audio.setMuted(store.get().settings.muted);

/** 게임천국 연동: 게임천국에서 PLAY 로 들어왔을 때(?gp=세션)만 활성, 아니면 모든 호출이 no-op */
export const gp = createGP({ gameVersion: '1.0.0' });
gp.init('minigame-paradise');
