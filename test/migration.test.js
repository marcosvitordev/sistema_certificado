const test = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const { postgresAdapter, initializeSchema } = require('../database');
const { migrate } = require('../scripts/migrar-postgres');

test('migração preserva IDs, códigos e senhas, ajusta sequência e recusa sobrescrita', async () => {
  const client = new PGlite();
  const target = postgresAdapter({ query: async (sql, params) => {
    if (params === undefined) return client.exec(sql);
    const result = await client.query(sql, params);
    return { ...result, rowCount: result.affectedRows };
  } }, () => client.close());
  const user = { id: 7, nome: 'Administrador', username: 'admin', senha: 'hash-original', must_change_password: 1 };
  const aluno = { id: 42, codigo_identificacao: 'codigo-original', nome_aluno: 'Aluno existente', escola: 'CES', professor: 'Professor', coordenador: 'Coordenador', data_inicio: '2026-01-01', data_fim: '2026-07-01' };
  const source = { all: async sql => sql.includes('usuarios') ? [user] : [aluno] };
  try {
    assert.deepEqual(await migrate(source, target), { usuarios: 1, alunos: 1 });
    assert.equal((await target.get('SELECT senha FROM usuarios WHERE id = ?', 7)).senha, 'hash-original');
    assert.equal((await target.get('SELECT codigo_identificacao FROM alunos WHERE id = ?', 42)).codigo_identificacao, 'codigo-original');
    const next = await target.run('INSERT INTO usuarios (nome, username, senha) VALUES (?, ?, ?)', 'Outro', 'outro', 'hash');
    assert.equal(next.lastID, 8);
    await assert.rejects(migrate(source, target), /precisa estar vazio/);
    assert.equal(Number((await target.get('SELECT COUNT(*) AS total FROM alunos')).total), 1);
    const policies = await target.all("SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('usuarios', 'alunos', 'sessions')");
    assert.equal(policies.length, 3);
    assert.ok(policies.every(row => row.relrowsecurity));
  } finally { await target.close(); }
});

test('falha na migração desfaz os registros já copiados', async () => {
  const client = new PGlite();
  const target = postgresAdapter({ query: (sql, params) => params === undefined ? client.exec(sql) : client.query(sql, params) }, () => client.close());
  try {
    await initializeSchema(target);
    const source = { all: async sql => {
      if (sql.includes('alunos')) throw new Error('Falha simulada de leitura');
      return [{ id: 1, nome: 'Teste', username: 'teste', senha: 'hash' }];
    } };
    await assert.rejects(migrate(source, target), /Falha simulada/);
    assert.equal(Number((await target.get('SELECT COUNT(*) AS total FROM usuarios')).total), 0);
  } finally { await target.close(); }
});
