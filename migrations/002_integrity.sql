CREATE TRIGGER IF NOT EXISTS rc_unique_username_insert BEFORE INSERT ON users
WHEN EXISTS(SELECT 1 FROM users WHERE lower(username)=lower(NEW.username))
BEGIN SELECT RAISE(ABORT,'username already exists'); END;
CREATE TABLE IF NOT EXISTS rc_auth_limits(key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, window_start INTEGER NOT NULL);
ALTER TABLE rc_groups ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS rc_topic_progress(user_id INTEGER REFERENCES users(id),subject TEXT NOT NULL,topic TEXT NOT NULL,successful_papers INTEGER NOT NULL DEFAULT 0,questions INTEGER NOT NULL DEFAULT 0,average REAL NOT NULL DEFAULT 0,state TEXT NOT NULL DEFAULT 'Learning',updated_at TEXT NOT NULL,PRIMARY KEY(user_id,subject,topic));
