/**
 * Mini Game Land 공통 계약. 자유 플레이와 랜덤 챌린지는 이 계약을 통해 '같은 게임 모듈'을 마운트합니다.
 * 게임은 모드를 모르고, 목숨·다음 게임 선택·기록 저장은 Shell/세션이 담당합니다.
 */
import type { ComponentType } from 'react';

export type Mode = 'free' | 'challenge';
export type Outcome = 'clear' | 'fail';
export type FailReason = 'game' | 'timeout' | 'quit';

export interface GameResult {
  outcome: Outcome;
  /** 게임이 남기는 통계(표시용) */
  stats?: Record<string, number>;
}

/** 게임 컴포넌트가 받는 라운드 컨텍스트 */
export interface GameContext {
  /** 지금 입력을 받아도 되는지(READY·일시정지·재개 카운트다운·종료 중이면 false) */
  isPlaying(): boolean;
  /** 점수 추가. 현재 콤보 배수가 자동 적용됨. 실제로 더해진 점수를 반환 */
  addScore(basePoints: number): number;
  /** 연속 성공 횟수 보고(콤보 배수 계산에 사용) */
  setCombo(combo: number): void;
  /** 공통 프레임 루프 구독. 플레이 중에만 호출됨. 해제 함수 반환 */
  onFrame(cb: (dtMs: number) => void): () => void;
  /** 라운드 종료 시(또는 언마운트 시) 자동 해제되는 리스너 등록 */
  listen(target: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions): () => void;
  sfx(name: SfxName): void;
  /** 라운드 종료 보고. 여러 번 호출해도 첫 호출만 유효(멱등) */
  finish(result: GameResult): void;
}

export interface GameViewProps<P> {
  params: P;
  level: number;
  /** 라운드 시드: 같은 시드 → 같은 출제(테스트·추후 '오늘의 도전') */
  seed: number;
  ctx: GameContext;
}

export interface GameMeta {
  title: string;
  /** HUD 처럼 좁은 곳에 쓰는 짧은 이름(없으면 title) */
  shortTitle?: string;
  tagline: string;
  howTo: string[];
  /** 이 레벨까지는 난이도 파라미터가 올라감. 이후는 시간만 압축 */
  maxLevel: number;
  /** 개발용 임시 게임 표시 */
  temporary?: boolean;
}

export interface MiniGameModule<P = unknown> {
  id: string;
  meta: GameMeta;
  /** 순수 함수: 레벨 → 난이도 파라미터 (테스트 가능, 두 모드 공유) */
  difficulty(level: number): P;
  /** 제한시간(초). null 이면 무제한 */
  timeLimitSec(level: number, mode: Mode): number | null;
  load(): Promise<{ default: ComponentType<GameViewProps<P>> }>;
}

export type SfxName = 'tap' | 'good' | 'bad' | 'clear' | 'fail' | 'tick' | 'pause' | 'lifeup' | 'start' | 'drop' | 'thud';
