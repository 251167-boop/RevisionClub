CREATE TABLE rc_paper_drafts (
 user_id INTEGER NOT NULL REFERENCES users(id),
 scope TEXT NOT NULL DEFAULT '',
 content TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(user_id,scope)
);
