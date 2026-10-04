const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  { mysqlSql } = require("../lib/club/mysql-sync.cjs");

test("MySQL translation preserves each text column's compatible collation", () => {
  const translated = mysqlSql(
    "SELECT id FROM users ORDER BY username COLLATE NOCASE,id",
  );

  assert.equal(translated, "SELECT id FROM users ORDER BY username,id");
  assert.doesNotMatch(translated, /utf8mb4_unicode_ci/i);
});
