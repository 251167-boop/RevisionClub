ALTER TABLE rc_messages ADD COLUMN paper_id TEXT REFERENCES rc_papers(id);
