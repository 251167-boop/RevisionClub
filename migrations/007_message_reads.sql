CREATE TABLE rc_message_reads (
  user_id INTEGER NOT NULL REFERENCES users(id),
  scope TEXT NOT NULL,
  last_row INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id, scope)
);
CREATE INDEX IF NOT EXISTS rc_messages_group ON rc_messages(group_id);
CREATE INDEX IF NOT EXISTS rc_messages_recipient ON rc_messages(recipient_id, sender_id);
