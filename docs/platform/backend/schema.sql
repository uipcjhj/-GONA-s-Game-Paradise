-- Cloudflare D1 (SQLite) 스키마 초안 — 실제 DB 생성하지 않음
CREATE TABLE players (
  player_id   TEXT PRIMARY KEY,
  token_hash  TEXT NOT NULL,            -- 토큰 원문은 저장하지 않음
  nickname    TEXT NOT NULL,
  public_code TEXT NOT NULL,
  avatar_id   TEXT NOT NULL,
  title_id    TEXT,
  created_at  INTEGER NOT NULL,
  last_seen   INTEGER NOT NULL,
  flagged     INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE sessions (
  session_id  TEXT PRIMARY KEY,
  player_id   TEXT NOT NULL REFERENCES players(player_id),
  game_id     TEXT NOT NULL,
  started_at  INTEGER NOT NULL,         -- 서버 시각
  finished    INTEGER NOT NULL DEFAULT 0,
  submissions INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE scores (
  result_id   TEXT PRIMARY KEY,         -- 멱등 키
  session_id  TEXT NOT NULL,
  player_id   TEXT NOT NULL,
  game_id     TEXT NOT NULL,
  sub_game_id TEXT,
  score       INTEGER NOT NULL,
  stage       INTEGER,
  outcome     TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  server_elapsed_ms INTEGER NOT NULL,
  week_id     TEXT NOT NULL,            -- 서버가 KST 월요일로 계산
  achieved_at INTEGER NOT NULL,
  game_version TEXT NOT NULL,
  score_schema INTEGER NOT NULL,
  flagged     INTEGER NOT NULL DEFAULT 0
);
-- 랭킹 조회용 비정규화(읽기 행 수 절감): 플레이어×게임 최고
CREATE TABLE best_all  (player_id TEXT, game_id TEXT, score INTEGER, achieved_at INTEGER, PRIMARY KEY (player_id, game_id));
CREATE TABLE best_week (player_id TEXT, game_id TEXT, week_id TEXT, score INTEGER, achieved_at INTEGER, PRIMARY KEY (player_id, game_id, week_id));
CREATE INDEX idx_best_all  ON best_all  (game_id, score DESC, achieved_at ASC);   -- 동점: 먼저 달성 우선
CREATE INDEX idx_best_week ON best_week (game_id, week_id, score DESC, achieved_at ASC);
CREATE INDEX idx_scores_player ON scores (player_id, game_id, achieved_at);
CREATE TABLE rate_limits (player_id TEXT, minute INTEGER, n INTEGER, PRIMARY KEY (player_id, minute));
