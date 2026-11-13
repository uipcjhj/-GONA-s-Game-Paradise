export interface InitOptions {
  gameId: string;
  gameVersion?: string;
  scoreSchemaVersion?: number;
  storage?: { getItem(k: string): string | null; setItem(k: string, v: string): void } | null;
  search?: string;
  origin?: string;
  now?: () => number;
  uuid?: () => string;
}
export interface RunResult {
  outcome: 'cleared' | 'failed';
  score: number;
  stage?: number;
  stageLabel?: string;
  extra?: Record<string, number | string | boolean>;
}
export interface GameSdk {
  active: boolean;
  returnUrl: string | null;
  runStart(info?: { subGameId?: string }): void;
  runPause(): void;
  runResume(): void;
  runEnd(r: RunResult): string | null | undefined;
  flush(): void;
}
export function initGame(opts: InitOptions): GameSdk;
