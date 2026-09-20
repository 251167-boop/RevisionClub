CREATE TABLE rc_game_answers (
  game_id TEXT NOT NULL REFERENCES rc_games(id),
  question_id TEXT NOT NULL,
  answer TEXT NOT NULL,
  correct INTEGER NOT NULL CHECK(correct IN (0,1)),
  PRIMARY KEY(game_id, question_id)
);
