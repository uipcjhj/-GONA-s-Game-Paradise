import { parsePlayerObject } from './schema';
import { SCHEMA_VERSION, type PlayerData } from './types';

export const BACKUP_KIND = 'gona-game-paradise/player-backup';
export const BACKUP_MAX_BYTES = 100 * 1024;

export interface BackupFile {
  kind: typeof BACKUP_KIND;
  schemaVersion: number;
  exportedAt: string;
  player: PlayerData;
}

/** 백업에는 플레이어 데이터만 담음 (gona.openingSeen · gona.mute 등 기기 설정은 포함하지 않음) */
export function buildBackup(player: PlayerData, now: Date = new Date()): { text: string; filename: string } {
  const file: BackupFile = { kind: BACKUP_KIND, schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), player };
  const d = now.toISOString().slice(0, 10).replace(/-/g, '');
  return { text: JSON.stringify(file, null, 2), filename: `gona-paradise-backup-${d}.json` };
}

export type BackupError = 'too-large' | 'not-json' | 'wrong-format' | 'newer' | 'invalid';
export type RestoreResult = { ok: true; player: PlayerData } | { ok: false; error: BackupError };

export const BACKUP_ERROR_MESSAGES: Record<BackupError, string> = {
  'too-large': '파일이 너무 커요. 게임천국에서 내보낸 백업 파일이 아니에요.',
  'not-json': '백업 파일을 읽을 수 없어요. (JSON 형식이 아니에요)',
  'wrong-format': '게임천국 백업 파일이 아니에요.',
  newer: '더 새로운 버전에서 만든 백업이라 지금은 불러올 수 없어요.',
  invalid: '백업 파일의 내용이 올바르지 않아요.',
};

export function parseBackup(text: string): RestoreResult {
  if (new TextEncoder().encode(text).length > BACKUP_MAX_BYTES) return { ok: false, error: 'too-large' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'not-json' };
  }
  if (typeof raw !== 'object' || raw === null || (raw as { kind?: unknown }).kind !== BACKUP_KIND) return { ok: false, error: 'wrong-format' };
  const res = parsePlayerObject({ ...(raw as { player?: object }).player, schemaVersion: (raw as { player?: { schemaVersion?: unknown } }).player?.schemaVersion });
  if (res.ok) return { ok: true, player: res.player };
  return { ok: false, error: res.reason === 'newer' ? 'newer' : 'invalid' };
}
