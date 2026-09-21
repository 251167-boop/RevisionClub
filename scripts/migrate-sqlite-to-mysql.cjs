#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");
const mysql = require("mysql2/promise");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

const args = new Set(process.argv.slice(2));
const replace = args.has("--replace");
const merge = args.has("--merge");
const schemaOnly = args.has("--schema-only");
const dryRun = args.has("--dry-run");
const sourceArg = process.argv.find((value) => value.startsWith("--source="));
const source = path.resolve(
  sourceArg?.slice("--source=".length) ||
    (fs.existsSync(".data/revision-club.db")
      ? ".data/revision-club.db"
      : "posts.db"),
);

function identifier(value) {
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }
  return `\`${value}\``;
}

function mysqlType(column, indexed) {
  const type = String(column.type || "TEXT").toUpperCase();
  if (type.includes("INT")) {
    return column.name === "window_start" ? "BIGINT" : "INT";
  }
  if (type.includes("REAL") || type.includes("FLOA") || type.includes("DOUB")) {
    return "DOUBLE";
  }
  if (type.includes("BLOB")) return "LONGBLOB";
  return indexed ? "VARCHAR(191)" : "LONGTEXT";
}

function readSchema(sqlite) {
  const tables = sqlite
    .prepare(
      "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all();

  return tables.map((table) => {
    const columns = sqlite
      .prepare(`PRAGMA table_info(${identifier(table.name)})`)
      .all();
    const foreignKeys = sqlite
      .prepare(`PRAGMA foreign_key_list(${identifier(table.name)})`)
      .all();
    const indexes = sqlite
      .prepare(`PRAGMA index_list(${identifier(table.name)})`)
      .all()
      .filter((index) => !index.partial)
      .map((index) => ({
        ...index,
        columns: sqlite
          .prepare(`PRAGMA index_info(${identifier(index.name)})`)
          .all()
          .sort((a, b) => a.seqno - b.seqno)
          .map((entry) => entry.name),
      }));
    return { ...table, columns, foreignKeys, indexes };
  });
}

function createStatements(schema) {
  const statements = [];
  const foreignKeyStatements = [];
  const indexStatements = [];

  for (const table of schema) {
    const primary = table.columns
      .filter((column) => column.pk)
      .sort((a, b) => a.pk - b.pk)
      .map((column) => column.name);
    const indexedColumns = new Set([
      ...primary,
      ...table.foreignKeys.map((key) => key.from),
      ...table.indexes.flatMap((index) => index.columns),
    ]);
    const singleIntegerId =
      primary.length === 1 &&
      primary[0] === "id" &&
      String(table.columns.find((column) => column.name === "id")?.type)
        .toUpperCase()
        .includes("INT");

    const definitions = table.columns.map((column) => {
      const mappedType = mysqlType(column, indexedColumns.has(column.name));
      const pieces = [identifier(column.name), mappedType];
      if (column.notnull || column.pk) pieces.push("NOT NULL");
      if (
        column.dflt_value !== null &&
        !["LONGTEXT", "LONGBLOB"].includes(mappedType)
      ) {
        pieces.push(`DEFAULT ${column.dflt_value}`);
      }
      if (singleIntegerId && column.name === "id")
        pieces.push("AUTO_INCREMENT");
      return pieces.join(" ");
    });
    definitions.push(`PRIMARY KEY (${primary.map(identifier).join(", ")})`);

    let uniqueNumber = 0;
    for (const index of table.indexes.filter((entry) => entry.unique)) {
      if (!index.columns.length || index.origin === "pk") continue;
      uniqueNumber += 1;
      definitions.push(
        `CONSTRAINT ${identifier(`uq_${table.name}_${uniqueNumber}`)} UNIQUE (${index.columns.map(identifier).join(", ")})`,
      );
    }

    statements.push(
      `CREATE TABLE ${identifier(table.name)} (\n  ${definitions.join(",\n  ")}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    );

    let indexNumber = 0;
    for (const index of table.indexes.filter((entry) => !entry.unique)) {
      if (!index.columns.length) continue;
      indexNumber += 1;
      indexStatements.push(
        `CREATE INDEX ${identifier(`ix_${table.name}_${indexNumber}`)} ON ${identifier(table.name)} (${index.columns.map(identifier).join(", ")})`,
      );
    }

    const foreignKeyGroups = new Map();
    for (const key of table.foreignKeys) {
      if (!foreignKeyGroups.has(key.id)) {
        foreignKeyGroups.set(key.id, {
          table: key.table,
          onDelete: key.on_delete,
          columns: [],
        });
      }
      foreignKeyGroups.get(key.id).columns.push(key);
    }
    for (const group of foreignKeyGroups.values()) {
      group.columns.sort((a, b) => a.seq - b.seq);
      const from = group.columns.map((key) => key.from);
      const to = group.columns.map((key) => key.to);
      const suffix = [table.name, ...from, group.table, ...to]
        .join("_")
        .replace(/[^A-Za-z0-9_]/g, "_")
        .slice(0, 55);
      foreignKeyStatements.push(
        `ALTER TABLE ${identifier(table.name)} ADD CONSTRAINT ${identifier(`fk_${suffix}`)} FOREIGN KEY (${from.map(identifier).join(", ")}) REFERENCES ${identifier(group.table)} (${to.map(identifier).join(", ")})${group.onDelete && group.onDelete !== "NO ACTION" ? ` ON DELETE ${group.onDelete}` : ""}`,
      );
    }
  }

  return { statements, indexStatements, foreignKeyStatements };
}

async function main() {
  if (!fs.existsSync(source))
    throw new Error(`SQLite source not found: ${source}`);

  const sqlite = new Database(source, { readonly: true });
  const schema = readSchema(sqlite);
  const tableNames = schema.map((table) => table.name);
  const ddl = createStatements(schema);
  if (dryRun) {
    const rowCount = schema.reduce(
      (total, table) =>
        total +
        sqlite
          .prepare(`SELECT count(*) AS count FROM ${identifier(table.name)}`)
          .get().count,
      0,
    );
    console.log(
      `Dry run ready: ${schema.length} tables and ${rowCount} rows from ${source}.`,
    );
    console.log(
      `DDL: ${ddl.statements.length} tables, ${ddl.indexStatements.length} indexes, ${ddl.foreignKeyStatements.length} foreign keys.`,
    );
    sqlite.close();
    return;
  }

  for (const key of [
    "MYSQL_HOST",
    "MYSQL_DATABASE",
    "MYSQL_USER",
    "MYSQL_PASSWORD",
  ]) {
    if (!process.env[key]) throw new Error(`${key} is required in .env.local`);
  }
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
    charset: "utf8mb4",
  });

  try {
    const placeholders = tableNames.map(() => "?").join(",");
    const [existing] = await connection.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema=? AND table_name IN (${placeholders})`,
      [process.env.MYSQL_DATABASE, ...tableNames],
    );
    const existingNames = new Set(
      existing.map((row) => row.TABLE_NAME || row.table_name),
    );
    if (existing.length && !replace && !merge) {
      throw new Error(
        `Destination already contains ${existing.length} Revision Club table(s). Export a backup, then rerun with --replace.`,
      );
    }

    await connection.query("SET FOREIGN_KEY_CHECKS=0");
    if (replace) {
      for (const tableName of [...tableNames].reverse()) {
        await connection.query(`DROP TABLE IF EXISTS ${identifier(tableName)}`);
      }
    }
    for (let index = 0; index < ddl.statements.length; index += 1) {
      if (merge && existingNames.has(tableNames[index])) continue;
      await connection.query(ddl.statements[index]);
    }
    for (const statement of ddl.indexStatements) {
      const tableName = statement.match(/ ON `([^`]+)`/)?.[1];
      if (merge && existingNames.has(tableName)) continue;
      await connection.query(statement);
    }

    if (!schemaOnly) {
      await connection.beginTransaction();
      try {
        const userIdMap = new Map();
        if (merge && existingNames.has("users")) {
          const localUsers = sqlite
            .prepare("SELECT * FROM users ORDER BY id")
            .all();
          for (const user of localUsers) {
            const [matches] = await connection.execute(
              "SELECT id FROM users WHERE lower(email)=lower(?) LIMIT 1",
              [user.email],
            );
            let targetId = matches[0]?.id;
            if (!targetId) {
              const [result] = await connection.execute(
                "INSERT INTO users (email,password,username,points,avatar_url) VALUES (?,?,?,?,?)",
                [
                  user.email,
                  user.password,
                  user.username,
                  user.points || 0,
                  user.avatar_url || null,
                ],
              );
              targetId = result.insertId;
            }
            userIdMap.set(Number(user.id), Number(targetId));
          }
        }

        for (const table of schema) {
          if (merge && existingNames.has(table.name)) continue;
          const rows = sqlite
            .prepare(`SELECT * FROM ${identifier(table.name)}`)
            .all();
          if (!rows.length) continue;
          const columns = Object.keys(rows[0]);
          const columnSql = columns.map(identifier).join(", ");
          const valueSql = columns.map(() => "?").join(", ");
          const updateSql = columns
            .map(
              (column) => `${identifier(column)}=VALUES(${identifier(column)})`,
            )
            .join(", ");
          const sql = `INSERT INTO ${identifier(table.name)} (${columnSql}) VALUES (${valueSql}) ON DUPLICATE KEY UPDATE ${updateSql}`;
          for (const row of rows) {
            const migrated = { ...row };
            for (const key of table.foreignKeys.filter(
              (entry) => merge && entry.table === "users",
            )) {
              if (migrated[key.from] !== null) {
                const mapped = userIdMap.get(Number(migrated[key.from]));
                if (!mapped) {
                  throw new Error(
                    `No Bluehost user mapping for ${table.name}.${key.from}=${migrated[key.from]}`,
                  );
                }
                migrated[key.from] = mapped;
              }
            }
            await connection.execute(
              sql,
              columns.map((column) => migrated[column]),
            );
          }
          console.log(`Imported ${rows.length} row(s) into ${table.name}`);
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    }

    for (const statement of ddl.foreignKeyStatements) {
      const tableName = statement.match(/^ALTER TABLE `([^`]+)`/)?.[1];
      if (merge && existingNames.has(tableName)) continue;
      await connection.query(statement);
    }
    await connection.query("SET FOREIGN_KEY_CHECKS=1");
    console.log(
      `Migration complete: ${schema.length} tables from ${source} to ${process.env.MYSQL_DATABASE}.`,
    );
  } finally {
    sqlite.close();
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`Migration failed: ${error.message}`);
  process.exitCode = 1;
});
