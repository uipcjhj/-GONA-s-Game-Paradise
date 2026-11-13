# 데이터 구조 (DATA_MODEL)

로컬 저장 키는 모두 `gp.v1.` 접두사. 최상위 `schemaVersion`으로 마이그레이션한다.

```ts
type ISODate = string; type PlayerId = string; type GameId = 'food' | 'sky' | 'mini' | (string & {});

interface Player {            // 1:1 로컬 스냅샷 (서버 연결 시 players 테이블과 동기화)
  schemaVersion: number; playerId: PlayerId; nickname: string; shortCode: string; // 예 K7Q2
  avatarId: AvatarId; selectedTitle?: string; frameId?: string; backgroundId?: string;
  playerLevel: number; totalXP: number; coinBalance: number;
  createdAt: ISODate; lastPlayedAt?: ISODate; totalPlayCount: number; totalPlayTimeSec: number;
  settings: Settings;
}
type AvatarId = 'gona' | 'strawberry' | 'cookie' | 'egg' | 'star' | string;

interface Game {              // Game Registry (코드/JSON 등록)
  gameId: GameId; name: string; islandId: string; image: string; url: string;
  status: 'live' | 'coming_soon' | 'hidden'; version: string;
  scoreRule: { schemaVersion: number; higherIsBetter: boolean; maxScore?: number; maxScorePerSec?: number; stageField?: string };
  ranking: { enabled: boolean; weekly: boolean; allTime: boolean; overallWeight: number; minParticipants: number };
  achievements: AchievementDef[]; codex?: CodexDef[];
}

interface PlaySession {       // 게임 1판
  sessionId: string; playerId: PlayerId; gameId: GameId; gameVersion: string;
  startedAt: ISODate; endedAt?: ISODate; status: 'running' | 'ended' | 'abandoned' | 'submitted';
}
interface ScoreRecord {       // 제출 단위. sessionId로 멱등
  sessionId: string; playerId: PlayerId; gameId: GameId; score: number; stage?: number;
  clearStatus: 'cleared' | 'failed' | 'quit'; playDurationSec: number; completedAt: ISODate;
  gameVersion: string; scoreSchemaVersion: number; verified: 'local' | 'server' | 'flagged';
}
interface GameRecordSummary { gameId: GameId; bestScore: number; bestStage?: number; cleared: boolean; plays: number; lastScoreAt?: ISODate }

interface RankingEntry { rank: number; playerId: PlayerId; nickname: string; shortCode: string; avatarId: AvatarId; score: number; achievedAt: ISODate }
interface RankingQuery { gameId: GameId | 'overall'; period: 'weekly' | 'all'; weekId?: string /* 2026-W46, 서버가 KST로 계산 */; limit: number }
interface RankingResult { entries: RankingEntry[]; me?: RankingEntry; updatedAt: ISODate; weekEndsAt?: ISODate }

interface XPEvent { eventId: string; playerId: PlayerId; source: 'game' | 'mission' | 'achievement' | 'bonus'; amount: number; at: ISODate; sessionId?: string }
interface CoinTx { txId: string; playerId: PlayerId; delta: number; reason: 'game' | 'mission' | 'attendance' | 'achievement' | 'purchase'; at: ISODate; refId?: string }

interface AchievementDef { id: string; gameId?: GameId; name: string; desc: string; target: number; rewardCoins: number; rewardTitle?: string; hidden?: boolean }
interface AchievementProgress { id: string; value: number; unlockedAt?: ISODate; claimed: boolean }

interface Item { itemId: string; kind: 'avatar' | 'frame' | 'title' | 'background'; name: string; price: number; asset?: string }
interface Inventory { owned: string[]; equipped: { avatar: string; frame?: string; title?: string; background?: string } }

interface CodexDef { id: string; category: '캐릭터'|'가족'|'보스'|'몬스터'|'간식'|'아이템'|'특별'; name: string; desc: string; image?: string; unlockRule: string }
interface CodexProgress { id: string; unlockedAt?: ISODate }

interface MissionState { dateKST: string; missions: { id: string; value: number; target: number; claimed: boolean }[]; attendance: { streak: number; lastDateKST: string; claimedToday: boolean } }
interface Settings { bgm: boolean; sfx: boolean; volume: number; vibration: boolean; reduceMotion: boolean }
```

## 관계
Player 1—N PlaySession 1—1 ScoreRecord; Player 1—N GameRecordSummary(게임당 1); ScoreRecord → RankingEntry(집계); XPEvent/CoinTx는 append-only 원장이며 `totalXP`/`coinBalance`는 파생값; AchievementDef(게임/공통) 1—N AchievementProgress(플레이어별).

## 서버(D1/SQLite) DDL 초안
```sql
CREATE TABLE players(player_id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, nickname TEXT NOT NULL, short_code TEXT NOT NULL, avatar_id TEXT, recovery_hash TEXT, created_at INTEGER, last_seen_at INTEGER, flagged INTEGER DEFAULT 0);
CREATE TABLE sessions(session_id TEXT PRIMARY KEY, player_id TEXT, game_id TEXT, started_at INTEGER, finished_at INTEGER, status TEXT);
CREATE TABLE scores(session_id TEXT PRIMARY KEY, player_id TEXT, game_id TEXT, score INTEGER, stage INTEGER, clear_status TEXT, duration_sec INTEGER, completed_at INTEGER, week_id TEXT, game_version TEXT, flagged INTEGER DEFAULT 0);
CREATE INDEX idx_scores_week ON scores(game_id, week_id, score DESC, completed_at);
CREATE INDEX idx_scores_all  ON scores(game_id, score DESC, completed_at);
CREATE TABLE best_all(player_id TEXT, game_id TEXT, score INTEGER, achieved_at INTEGER, PRIMARY KEY(player_id, game_id));
```
`best_all`로 역대 랭킹 조회 시 읽기 행 수를 줄인다(무료 한도 보호).
