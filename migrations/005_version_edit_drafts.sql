ALTER TABLE rc_version_context ADD COLUMN generation_settings TEXT NOT NULL DEFAULT '{}';
CREATE TABLE rc_version_drafts (
 version_id TEXT PRIMARY KEY REFERENCES rc_versions(id),
 user_id INTEGER NOT NULL REFERENCES users(id),
 content TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
