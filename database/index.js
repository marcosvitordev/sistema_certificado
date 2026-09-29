const fs = require('node:fs/promises');
const path = require('node:path');

// The shared queries use SQLite placeholders; values are always bound separately.
function postgresSql(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`)
    .replace(/datetime\('now'\)/g, "to_char(timezone('UTC', now()), 'YYYY-MM-DD HH24:MI:SS')")
    .replace(/\bLIKE\b/g, 'ILIKE');
}

function postgresAdapter(client, close = () => client.end()) {
  async function query(sql, params) {
    return client.query(postgresSql(sql), params.flat());
  }
  return {
    dialect: 'postgres',
    async get(sql, ...params) { return (await query(sql, params)).rows[0]; },
    async all(sql, ...params) { return (await query(sql, params)).rows; },
    async run(sql, ...params) {
      const insert = /^\s*INSERT INTO (alunos|usuarios)\b/i.test(sql);
      const result = await query(insert ? `${sql} RETURNING id` : sql, params);
      return { changes: result.rowCount, lastID: result.rows[0]?.id };
    },
    async exec(sql) { await client.query(sql); },
    async transaction(work) {
      const connection = typeof client.connect === 'function' ? await client.connect() : client;
      try {
        await connection.query('BEGIN');
        const result = await work(postgresAdapter(connection, async () => {}));
        await connection.query('COMMIT');
        return result;
      } catch (error) {
        await connection.query('ROLLBACK');
        throw error;
      } finally { if (connection !== client) connection.release(); }
    },
    close,
  };
}

async function openDatabase({ filename, databaseUrl = process.env.DATABASE_URL } = {}) {
  if (databaseUrl) {
    const { Pool } = require('pg');
    const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, '\n');
    const url = new URL(databaseUrl);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    const sslDisabled = url.searchParams.get('sslmode') === 'disable';
    if (sslDisabled && (!local || process.env.NODE_ENV === 'production')) {
      throw new Error('SSL não pode ser desativado para o banco de produção.');
    }
    // URL SSL options override the pg ssl object, including its CA certificate.
    // Configure verified TLS in one place, preserving the optional Supabase CA.
    for (const key of ['sslmode', 'ssl', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
    const pool = new Pool({
      connectionString: url.toString(),
      max: 5,
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 30000,
      ssl: local && sslDisabled ? false : { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
    });
    pool.on('error', error => console.error('Conexão PostgreSQL indisponível:', error.code));
    return postgresAdapter(pool);
  }
  if (process.env.REQUIRE_POSTGRES === '1') throw new Error('DATABASE_URL é obrigatória nesta hospedagem.');
  const sqlite3 = require('sqlite3');
  const { open } = require('sqlite');
  await fs.mkdir(path.dirname(filename), { recursive: true });
  const db = await open({ filename, driver: sqlite3.Database });
  db.dialect = 'sqlite';
  return db;
}

async function initializeSchema(db) {
  const sql = await fs.readFile(path.join(__dirname, `${db.dialect}.sql`), 'utf8');
  await db.exec(sql);
  if (db.dialect === 'sqlite') {
    for (const [table, column, definition] of [
      ['usuarios', 'must_change_password', 'INTEGER NOT NULL DEFAULT 0'],
      ['usuarios', 'updated_at', "TEXT NOT NULL DEFAULT ''"],
      ['alunos', 'updated_at', "TEXT NOT NULL DEFAULT ''"],
    ]) {
      const columns = await db.all(`PRAGMA table_info(${table})`);
      if (!columns.some(item => item.name === column)) await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
}

module.exports = { openDatabase, initializeSchema, postgresAdapter };
