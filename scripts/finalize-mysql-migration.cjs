#!/usr/bin/env node
const mysql = require("mysql2/promise");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

const REQUIRED_TABLES = [
  "users",
  "sessions",
  "rc_achievements",
  "rc_assignments",
  "rc_attempts",
  "rc_auth_limits",
  "rc_battles",
  "rc_battle_xp_receipts",
  "rc_challenges",
  "rc_decisions",
  "rc_exams",
  "rc_files",
  "rc_friends",
  "rc_games",
  "rc_game_answers",
  "rc_generated_minigames",
  "rc_groups",
  "rc_group_subjects",
  "rc_keys",
  "rc_markings",
  "rc_marking_items",
  "rc_members",
  "rc_member_subjects",
  "rc_messages",
  "rc_message_reads",
  "rc_migrations",
  "rc_minigame_likes",
  "rc_mistakes",
  "rc_notifications",
  "rc_notification_preferences",
  "rc_papers",
  "rc_paper_drafts",
  "rc_paper_files",
  "rc_profiles",
  "rc_ratings",
  "rc_sessions",
  "rc_subject_requests",
  "rc_submissions",
  "rc_topic_progress",
  "rc_upload_chunks",
  "rc_versions",
  "rc_version_context",
  "rc_version_drafts",
  "rc_version_files",
  "rc_xp",
];

async function main() {
  for (const key of [
    "MYSQL_HOST",
    "MYSQL_DATABASE",
    "MYSQL_USER",
    "MYSQL_PASSWORD",
  ])
    if (!process.env[key]) throw new Error(`${key} is required in .env.local`);
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    database: process.env.MYSQL_DATABASE,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    ssl:
      process.env.MYSQL_SSL === "true"
        ? {
            rejectUnauthorized:
              process.env.MYSQL_SSL_REJECT_UNAUTHORIZED !== "false",
          }
        : undefined,
  });
  try {
    const [tables] = await connection.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema=?",
      [process.env.MYSQL_DATABASE],
    );
    const present = new Set(
      tables.map((row) => row.TABLE_NAME || row.table_name),
    );
    const missing = REQUIRED_TABLES.filter((name) => !present.has(name));
    if (missing.length)
      throw new Error(`Missing MySQL tables: ${missing.join(", ")}`);

    const [position] = await connection.query(
      "SHOW COLUMNS FROM rc_messages LIKE 'position'",
    );
    if (!position.length)
      await connection.query(
        "ALTER TABLE rc_messages ADD COLUMN position BIGINT NOT NULL AUTO_INCREMENT UNIQUE",
      );
    await connection.execute(
      `INSERT INTO rc_migrations(name,applied_at) VALUES('010_mysql_runtime.sql',?)
       ON DUPLICATE KEY UPDATE applied_at=VALUES(applied_at)`,
      [new Date().toISOString()],
    );
    console.log(
      `MySQL migration verified: ${REQUIRED_TABLES.length} required tables are ready.`,
    );
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`MySQL finalization failed: ${error.message}`);
  process.exitCode = 1;
});
