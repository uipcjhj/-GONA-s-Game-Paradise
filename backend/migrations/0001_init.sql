-- GONA 게임천국 온라인 랭킹 — D1(SQLite) 스키마 v1
-- 적용(미래, 승인 후): wrangler d1 migrations apply gona-paradise --remote   (지금은 로컬 SQLite 로만 검증)
PRAGMA foreign_keys = ON;

CREATE TABLE players (
  player_id    TEXT PRIMARY KEY,                 -- 서버 발급 UUID (공개 가능, 인증 수단 아님)
  token_hash   TEXT NOT NULL UNIQUE,             -- sha256(token ':' pepper) — 토큰 원문은 저장하지 않음
  nickname     TEXT NOT NULL,                    -- 중복 허용
  public_code  TEXT NOT NULL,                    -- 공개 식별코드(닉네임 구분용, 인증 수단 아님)
  avatar_id    TEXT NOT NULL,
  title_id     TEXT,
  created_at   INTEGER NOT NULL,
  last_seen    INTEGER NOT NULL,
  flagged      INTEGER NOT NULL DEFAULT 0        -- 1 이면 랭킹에서 숨김
);

CREATE TABLE sessions (
  session_id   TEXT PRIMARY KEY,
  player_id    TEXT NOT NULL REFERENCES players(player_id),
  game_id      TEXT NOT NULL,
  started_at   INTEGER NOT NULL,                 -- 서버 시각(클라이언트 값 무시)
  expires_at   INTEGER NOT NULL,
  submissions  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_sessions_player ON sessions (player_id, started_at);

CREATE TABLE scores (
  result_id         TEXT PRIMARY KEY,            -- 멱등 키(같은 판 재전송 방지)
  session_id        TEXT NOT NULL REFERENCES sessions(session_id),
  player_id         TEXT NOT NULL REFERENCES players(player_id),
  game_id           TEXT NOT NULL,
  sub_game_id       TEXT NOT NULL DEFAULT '',
  score             INTEGER NOT NULL,
  stage             INTEGER,
  outcome           TEXT NOT NULL,
  duration_ms       INTEGER NOT NULL,
  server_elapsed_ms INTEGER NOT NULL,
  week_id           TEXT NOT NULL,               -- 서버가 한국 시간(KST) 월요일 기준으로 계산
  achieved_at       INTEGER NOT NULL,
  game_version      TEXT NOT NULL,
  score_schema      INTEGER NOT NULL,
  flagged           INTEGER NOT NULL DEFAULT 0,
  reason            TEXT
);
CREATE INDEX idx_scores_player ON scores (player_id, game_id, achieved_at);

-- 랭킹 조회용 비정규화(읽기 행 수 절감). 의심(flagged) 점수는 여기에 들어가지 않는다.
CREATE TABLE best_all (
  player_id   TEXT NOT NULL REFERENCES players(player_id),
  game_id     TEXT NOT NULL,
  sub_game_id TEXT NOT NULL DEFAULT '',
  score       INTEGER NOT NULL,
  achieved_at INTEGER NOT NULL,
  PRIMARY KEY (player_id, game_id, sub_game_id)
);
CREATE INDEX idx_best_all ON best_all (game_id, sub_game_id, score DESC, achieved_at ASC);   -- 동점은 먼저 달성한 기록 우선

CREATE TABLE best_week (
  player_id   TEXT NOT NULL REFERENCES players(player_id),
  game_id     TEXT NOT NULL,
  sub_game_id TEXT NOT NULL DEFAULT '',
  week_id     TEXT NOT NULL,
  score       INTEGER NOT NULL,
  achieved_at INTEGER NOT NULL,
  PRIMARY KEY (player_id, game_id, sub_game_id, week_id)
);
CREATE INDEX idx_best_week ON best_week (game_id, sub_game_id, week_id, score DESC, achieved_at ASC);

-- 요청 횟수 제한(고정 윈도우)
CREATE TABLE rate_limits (
  bucket TEXT NOT NULL,
  window INTEGER NOT NULL,
  n      INTEGER NOT NULL,
  PRIMARY KEY (bucket, window)
);
