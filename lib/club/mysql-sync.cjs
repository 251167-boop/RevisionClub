const {
  MessageChannel,
  Worker,
  receiveMessageOnPort,
} = require("node:worker_threads");

const WORKER_SOURCE = String.raw`
const { workerData } = require("node:worker_threads");
const mysql = require("mysql2/promise");
const port = workerData.port;
let connection;
function plain(result) {
  if (Array.isArray(result)) return result.map((row) => ({ ...row }));
  return { changes: Number(result.affectedRows || 0), lastInsertRowid: Number(result.insertId || 0) };
}
async function handle(message) {
  if (!connection) connection = await mysql.createConnection(workerData.config);
  if (message.type === "begin") await connection.beginTransaction();
  else if (message.type === "commit") await connection.commit();
  else if (message.type === "rollback") await connection.rollback();
  else if (message.type === "ping") await connection.ping();
  else { const [result] = await connection.execute(message.sql, message.params || []); return plain(result); }
  return null;
}
port.on("message", async (message) => {
  const state = new Int32Array(message.signal);
  try { port.postMessage({ id: message.id, result: await handle(message) }); }
  catch (error) { port.postMessage({ id: message.id, error: { message: error.message, code: error.code, errno: error.errno, sqlState: error.sqlState } }); }
  finally { Atomics.store(state, 0, 1); Atomics.notify(state, 0); }
});`;

function mysqlConfig() {
  for (const key of [
    "MYSQL_HOST",
    "MYSQL_DATABASE",
    "MYSQL_USER",
    "MYSQL_PASSWORD",
  ])
    if (!process.env[key])
      throw new Error(`${key} is required. SQLite fallback has been removed.`);
  return {
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
    decimalNumbers: true,
    supportBigNumbers: true,
    bigNumberStrings: false,
  };
}

function mysqlSql(sql) {
  let value = String(sql)
    .replace(/INSERT OR IGNORE INTO/gi, "INSERT IGNORE INTO")
    .replace(/INSERT OR REPLACE INTO/gi, "REPLACE INTO")
    // MySQL columns can legitimately use either legacy utf8 or utf8mb4.
    // Forcing an utf8mb4 collation onto an utf8 column raises ER_COLLATION_CHARSET_MISMATCH.
    // Both production character sets already use case-insensitive column collations.
    .replace(/\s+COLLATE\s+NOCASE/gi, "")
    .replace(/assignment_id IS \?/gi, "assignment_id <=> ?")
    .replace(/m\.rowid/gi, "m.position")
    .replace(/a\.rowid/gi, "a.id")
    .replace(/r\.rowid/gi, "r.id")
    .replace(/e\.rowid/gi, "a.submitted_at")
    .replace(/b\.rowid/gi, "b.id")
    .replace(/SELECT rowid position,\*/gi, "SELECT position, *")
    .replace(/\browid\s*>\s*\?/gi, "position > ?")
    .replace(/ORDER BY rowid\b/gi, "ORDER BY question_id");

  value = value.replace(
    /ON CONFLICT\s*\([^)]*\)\s*DO UPDATE SET\s*([\s\S]+)$/i,
    (_, assignments) =>
      "ON DUPLICATE KEY UPDATE " +
      assignments
        .replace(/excluded\.([A-Za-z_][A-Za-z0-9_]*)/gi, "VALUES($1)")
        .replace(
          /MAX\(last_row,\s*VALUES\(last_row\)\)/gi,
          "GREATEST(last_row, VALUES(last_row))",
        ),
  );
  return value;
}

function openMysqlSync() {
  const { port1, port2 } = new MessageChannel();
  const worker = new Worker(WORKER_SOURCE, {
    eval: true,
    workerData: { port: port2, config: mysqlConfig() },
    transferList: [port2],
  });
  worker.unref();
  port1.unref();
  let sequence = 0;
  let transactionDepth = 0;

  function call(payload) {
    const id = ++sequence;
    const signal = new SharedArrayBuffer(4);
    const state = new Int32Array(signal);
    port1.postMessage({ ...payload, id, signal });
    const wait = Atomics.wait(state, 0, 0, 30000);
    if (wait === "timed-out")
      throw new Error("The database request timed out.");
    const packet = receiveMessageOnPort(port1)?.message;
    if (!packet || packet.id !== id)
      throw new Error("The database worker returned an invalid response.");
    if (packet.error) {
      const error = new Error(packet.error.message);
      Object.assign(error, packet.error);
      throw error;
    }
    return packet.result;
  }

  call({ type: "ping" });
  return {
    prepare(sql) {
      const translated = mysqlSql(sql);
      return {
        get(...params) {
          return call({ type: "query", sql: translated, params })[0];
        },
        all(...params) {
          return call({ type: "query", sql: translated, params });
        },
        run(...params) {
          return call({ type: "query", sql: translated, params });
        },
      };
    },
    transaction(fn) {
      const execute = () => {
        if (transactionDepth) return fn();
        call({ type: "begin" });
        transactionDepth += 1;
        try {
          const result = fn();
          call({ type: "commit" });
          return result;
        } catch (error) {
          try {
            call({ type: "rollback" });
          } catch {}
          throw error;
        } finally {
          transactionDepth -= 1;
        }
      };
      execute.immediate = execute;
      return execute;
    },
    close() {
      worker.terminate();
    },
  };
}

module.exports = { mysqlSql, openMysqlSync };
