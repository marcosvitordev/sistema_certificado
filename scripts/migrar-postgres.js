require('dotenv').config({ path: process.env.ENV_FILE || '.env' });
const path = require('node:path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { openDatabase, initializeSchema } = require('../database');

async function migrate(source, target) {
  await initializeSchema(target);
  return target.transaction(async tx => {
    // Prevent a running API from adding records while the migration checks/copies.
    await tx.exec('LOCK TABLE usuarios, alunos IN ACCESS EXCLUSIVE MODE');
    for (const table of ['usuarios', 'alunos']) {
      if (Number((await tx.get(`SELECT COUNT(*) AS total FROM ${table}`)).total) !== 0) {
        throw new Error('O PostgreSQL precisa estar vazio. A migração não substitui dados existentes.');
      }
    }
    const counts = {};
    for (const [table, columns] of [
      ['usuarios', ['id', 'nome', 'username', 'senha', 'must_change_password', 'created_at', 'updated_at']],
      ['alunos', ['id', 'codigo_identificacao', 'nome_aluno', 'escola', 'professor', 'coordenador', 'data_inicio', 'data_fim', 'qr_path', 'created_at', 'updated_at']],
    ]) {
      const rows = await source.all(`SELECT * FROM ${table} ORDER BY id`);
      if (table === 'usuarios' && !rows.length) throw new Error('Nenhum usuário encontrado no SQLite de origem.');
      for (const row of rows) {
        const values = columns.map(column => column === 'qr_path' ? '' : row[column] ?? (column === 'must_change_password' ? 1 : ''));
        await tx.run(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`, values);
      }
      await tx.get(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM ${table}`);
      counts[table] = rows.length;
    }
    return counts;
  });
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL do Supabase em um arquivo local privado.');
  const filename = path.resolve(process.env.DB_PATH || path.join(process.env.DATA_DIR || 'data', 'sistema_cursos.db'));
  const source = await open({ filename, driver: sqlite3.Database, mode: sqlite3.OPEN_READONLY });
  let target;
  try {
    await source.exec('BEGIN');
    target = await openDatabase();
    const counts = await migrate(source, target);
    await source.exec('COMMIT');
    console.log(`Migração concluída: ${counts.usuarios} usuário(s), ${counts.alunos} certificado(s). O SQLite original foi preservado.`);
  } finally { await source.close(); if (target) await target.close(); }
}
if (require.main === module) main().catch(error => { console.error('Migração interrompida:', error.message); process.exitCode = 1; });
module.exports = { migrate };
