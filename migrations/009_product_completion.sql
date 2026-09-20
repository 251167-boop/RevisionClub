ALTER TABLE rc_sessions ADD COLUMN series_id TEXT;
ALTER TABLE rc_sessions ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC';

CREATE TABLE rc_exams (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE rc_notification_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  study_reminders INTEGER NOT NULL DEFAULT 1 CHECK(study_reminders IN (0,1)),
  social_updates INTEGER NOT NULL DEFAULT 1 CHECK(social_updates IN (0,1)),
  achievement_updates INTEGER NOT NULL DEFAULT 1 CHECK(achievement_updates IN (0,1))
);

CREATE TABLE rc_battle_xp_receipts (
  battle_id TEXT NOT NULL REFERENCES rc_battles(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(battle_id, user_id)
);

CREATE INDEX rc_exams_user_date ON rc_exams(user_id, starts_at);
CREATE INDEX rc_papers_public_updated ON rc_papers(public, updated_at DESC);
CREATE INDEX rc_sessions_user_series ON rc_sessions(user_id, series_id);
