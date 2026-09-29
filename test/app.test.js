const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const request = require("supertest");

const tempDir = path.join(os.tmpdir(), `certifica-ces-${process.pid}`);
process.env.NODE_ENV = "test";
process.env.DB_PATH = path.join(tempDir, "test.db");
process.env.DATA_DIR = tempDir;
process.env.QR_DIR = path.join(tempDir, "qrcodes");
process.env.BASE_URL = "http://localhost:3000";
process.env.SESSION_SECRET = "segredo-de-teste-com-mais-de-trinta-e-dois-caracteres";
process.env.ADMIN_USERNAME = "admin_test";
process.env.ADMIN_PASSWORD = "SenhaInicial123!";

const { app, initDb, close } = require("../server");

let agent;
let csrf;
let studentId;
let validationCode;

test.before(async () => {
  await fs.mkdir(tempDir, { recursive: true });
  if (process.env.TEST_POSTGRES === '1') {
    const { PGlite } = require('@electric-sql/pglite');
    const { postgresAdapter } = require('../database');
    const client = new PGlite();
    const adapter = postgresAdapter({
      query: async (sql, params) => {
        if (params === undefined) return client.exec(sql);
        const result = await client.query(sql, params);
        return { ...result, rowCount: result.affectedRows };
      },
    }, () => client.close());
    await initDb(adapter);
  } else {
    delete process.env.DATABASE_URL;
    await initDb();
  }
  agent = request.agent(app);
});

test.after(async () => {
  await close();
  await fs.rm(tempDir, { recursive: true, force: true });
});

test("health check responde e páginas privadas exigem login", async () => {
  const health = await request(app).get("/healthz").expect(200);
  assert.equal(health.body.status, "ok");
  await request(app).get("/dashboard").expect(302).expect("Location", "/login");
  await request(app).get("/dashboard.html").expect(404);
  await request(app).get("/api/alunos").expect(401);
});

test("login cria sessão e exige a troca da senha inicial", async () => {
  await agent.post("/login").type("form").send({ username: "admin_test", password: "SenhaInicial123!" })
    .expect(302).expect("Location", "/configuracoes");
  const me = await agent.get("/api/me").expect(200);
  assert.equal(me.body.user.username, "admin_test");
  assert.equal(me.body.user.must_change_password, true);
  csrf = me.body.csrfToken;
  await agent.post("/api/alunos").set("X-CSRF-Token", csrf).send({}).expect(403);
});

test("troca de senha valida CSRF e libera alterações", async () => {
  await agent.post("/api/me/password").send({}).expect(403);
  const response = await agent.post("/api/me/password").set("X-CSRF-Token", csrf).send({
    senha_atual: "SenhaInicial123!",
    nova_senha: "SenhaNovaSegura123!",
    confirmacao: "SenhaNovaSegura123!",
  }).expect(200);
  assert.equal(response.body.sucesso, true);
});

test("cadastra, lista, edita e valida um certificado", async () => {
  const created = await agent.post("/api/alunos").set("X-CSRF-Token", csrf).send({
    nome_aluno: "Aluno de Integração",
    escola: "Escola de Teste",
    professor: "Professor de Teste",
    coordenador: "Coordenador de Teste",
    data_inicio: "2026-01-10",
    data_fim: "2026-07-10",
  }).expect(201);
  studentId = created.body.id;
  validationCode = created.body.codigo_identificacao;
  assert.match(validationCode, /^[0-9a-f-]{36}$/);

  const list = await agent.get("/api/alunos?busca=Integração").expect(200);
  assert.equal(list.body.total, 1);

  await agent.put(`/api/alunos/${studentId}`).set("X-CSRF-Token", csrf).send({
    nome_aluno: "Aluno Atualizado",
    escola: "Escola de Teste",
    professor: "Professor de Teste",
    coordenador: "Coordenador de Teste",
    data_inicio: "2026-01-10",
    data_fim: "2026-08-10",
  }).expect(200);

  const validation = await request(app).get(`/validar/${validationCode}`).expect(200);
  assert.match(validation.text, /Aluno Atualizado/);
  await request(app).get("/validar/codigo-inexistente").expect(404);
});

test("gera PDF protegido e exclui o cadastro", async () => {
  const unauthenticated = await request(app).get(`/certificado/${studentId}`).expect(302);
  assert.equal(unauthenticated.headers.location, "/login");
  const pdf = await agent.get(`/certificado/${studentId}`).expect(200).expect("Content-Type", /application\/pdf/);
  assert.equal(pdf.body.subarray(0, 4).toString(), "%PDF");
  const qr = await agent.get(`/qr/${studentId}`).expect(200).expect('Content-Type', /image\/png/);
  assert.equal(qr.body.subarray(1, 4).toString(), 'PNG');
  const validation = await request(app).get(`/api/validar/${validationCode}`).expect(200);
  assert.equal(validation.body.aluno.nome_aluno, 'Aluno Atualizado');
  assert.equal(validation.body.aluno.senha, undefined);
  const stats = await agent.get('/api/stats').expect(200);
  assert.equal(stats.body.total, 1);
  await agent.delete(`/api/alunos/${studentId}`).set("X-CSRF-Token", csrf).expect(200);
  await request(app).get(`/validar/${validationCode}`).expect(404);
});

test('login JSON, persistência da sessão e logout para o frontend Next.js', async () => {
  const next = request.agent(app);
  const invalid = await next.post('/api/auth/login').send({ username: 'admin_test', password: 'errada' }).expect(401);
  assert.equal(invalid.body.erro, 'Usuário ou senha incorretos.');
  const login = await next.post('/api/auth/login').send({ username: 'admin_test', password: 'SenhaNovaSegura123!' }).expect(200);
  assert.equal(login.body.redirect, '/dashboard');
  assert.match(login.headers['set-cookie'][0], /HttpOnly/);
  const me = await next.get('/api/me').expect(200).expect('Cache-Control', 'no-store');
  await next.post('/api/auth/logout').expect(403);
  await next.post('/api/auth/logout').set('X-CSRF-Token', me.body.csrfToken).expect(200);
  await next.get('/api/me').expect(401);
});
