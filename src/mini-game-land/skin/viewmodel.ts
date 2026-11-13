import type { EngineSnapshot } from '../core/engine';
import type { ScoreboardView } from './types';

export interface HudInfo {
  /** 왼쪽 아래 작은 글씨(예: ROUND 3 · 편가르기 대소동) */
  label: string;
  lives?: number;
  maxLives?: number;
  /** 라운드 시작 전까지의 누적 점수(챌린지 누적/자유 플레이 런 점수) */
  baseScore?: number;
  level?: number;
}

/** 엔진 상태 → 점수판 표시값. 스킨은 이 값만 그림 */
export function scoreboardView(snap: EngineSnapshot, info: HudInfo): ScoreboardView {
  const unlimited = snap.limitMs == null;
  const timeSec = unlimited ? null : Math.ceil((snap.remainingMs ?? 0) / 1000);
  const timePct = unlimited ? 100 : Math.max(0, Math.min(100, ((snap.remainingMs ?? 0) / (snap.limitMs ?? 1)) * 100));
  return {
    score: (info.baseScore ?? 0) + snap.score,
    combo: snap.combo,
    timeSec,
    timePct,
    timeWarn: timeSec != null && timeSec <= 5,
    label: info.label,
    lives: info.lives,
    maxLives: info.maxLives,
    level: info.level,
  };
}
