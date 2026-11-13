import { AudioSystem } from './core/audio';
import { SaveStore } from './core/storage';

/** 페이지당 하나씩만 쓰는 서비스(오디오 · 기록 저장) */
export const store = new SaveStore();
export const audio = new AudioSystem();
audio.setMuted(store.get().settings.muted);
