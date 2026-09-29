require("dotenv").config();

const crypto = require("crypto");
const path = require("path");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const bcrypt = require("bcrypt");
const QRCode = require("qrcode");
const { openDatabase, initializeSchema } = require("./database");

const gerarCertificadoPDF = require("./gerarCertificadoPDF");

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT_DIR, "data"));
const DB_PATH = path.resolve(process.env.DB_PATH || path.join(DATA_DIR, "sistema_cursos.db"));
const PORT = Number(process.env.PORT || 3000);
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";
const BASE_URL = String(process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const SESSION_SECRET = process.env.SESSION_SECRET || "segredo-apenas-para-desenvolvimento";
const SCHOOL_NAME = process.env.SCHOOL_NAME || "Centro de Estudo Sena - CES";
const PROFESSOR_NAME = process.env.PROFESSOR_NAME || "MARCOS VITOR LIMA DA COSTA";
const COORDINATOR_NAME = process.env.COORDINATOR_NAME || "JOAQUIM DE ARAUJO MORAIS";

let db;
let server;

function validateEnvironment() {
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error("PORT deve ser um número entre 1 e 65535");
  }
  let parsedBaseUrl;
  try {
    parsedBaseUrl = new URL(BASE_URL);
  } catch {
    throw new Error("BASE_URL deve ser uma URL válida");
  }
  if (IS_PRODUCTION) {
    if (SESSION_SECRET.length < 32 || SESSION_SECRET === "troque-este-segredo-em-producao") {
      throw new Error("SESSION_SECRET deve ter pelo menos 32 caracteres em produção");
    }
    if (parsedBaseUrl.protocol !== "https:") {
      throw new Error("BASE_URL deve usar HTTPS em produção");
    }
  }
}

validateEnvironment();

function cleanText(value, maxLength = 160) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeFileName(name = "arquivo") {
  return String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80) || "arquivo";
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function formatDateBR(value) {
  if (!isValidIsoDate(value)) return "-";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function validationUrl(code) {
  return `${BASE_URL}/validar/${encodeURIComponent(code)}`;
}

class DatabaseSessionStore extends session.Store {
  async get(sid, callback) {
    try {
      const row = await db.get("SELECT sess, expired_at FROM sessions WHERE sid = ?", sid);
      if (!row || row.expired_at <= Date.now()) {
        if (row) await db.run("DELETE FROM sessions WHERE sid = ?", sid);
        return callback(null, null);
      }
      return callback(null, JSON.parse(row.sess));
    } catch (error) {
      return callback(error);
    }
  }

  async set(sid, sess, callback = () => {}) {
    try {
      const expires = sess.cookie?.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + 8 * 60 * 60 * 1000;
      await db.run(
        `INSERT INTO sessions (sid, sess, expired_at) VALUES (?, ?, ?)
         ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expired_at = excluded.expired_at`,
        sid, JSON.stringify(sess), expires
      );
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  async destroy(sid, callback = () => {}) {
    try {
      await db.run("DELETE FROM sessions WHERE sid = ?", sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  touch(sid, sess, callback = () => {}) {
    this.set(sid, sess, callback);
  }
}

async function initDb(database) {
  if (db) return db;
  db = database || await openDatabase({ filename: DB_PATH });
  await initializeSchema(db);

  const userCount = await db.get("SELECT COUNT(*) AS total FROM usuarios");
  if (Number(userCount.total) === 0) {
    const username = cleanText(process.env.ADMIN_USERNAME || "admin", 60);
    const name = cleanText(process.env.ADMIN_NAME || "Administrador", 120);
    const password = String(process.env.ADMIN_PASSWORD || "");
    if (IS_PRODUCTION && password.length < 12) {
      throw new Error("ADMIN_PASSWORD deve ter pelo menos 12 caracteres na primeira execução");
    }
    const hash = await bcrypt.hash(password || "TroqueAgora123!", 12);
    await db.run(
      "INSERT INTO usuarios (nome, username, senha, must_change_password) VALUES (?, ?, ?, 1)",
      name, username, hash
    );
    if (!IS_PRODUCTION) console.warn(`Usuário inicial criado: ${username}. Troque a senha no primeiro acesso.`);
  }

  const users = await db.all("SELECT id, senha FROM usuarios WHERE must_change_password = 0");
  for (const user of users) {
    if (await bcrypt.compare("123456", user.senha)) {
      await db.run("UPDATE usuarios SET must_change_password = 1 WHERE id = ?", user.id);
    }
  }
  await db.run("DELETE FROM sessions WHERE expired_at <= ?", Date.now());
  return db;
}

const app = express();
if (IS_PRODUCTION || process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use((req, res, next) => {
  if (!req.path.startsWith('/css/') && !req.path.startsWith('/js/')) res.set('Cache-Control', 'no-store');
  next();
});
app.use(helmet({
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], imgSrc: ["'self'", "data:"], styleSrc: ["'self'"],
    scriptSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"],
  } },
}));
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: false, limit: "32kb" }));
app.use("/css", express.static(path.join(PUBLIC_DIR, "css"), { maxAge: IS_PRODUCTION ? "7d" : 0 }));
app.use("/js", express.static(path.join(PUBLIC_DIR, "js"), { maxAge: IS_PRODUCTION ? "7d" : 0 }));
app.use(session({
  name: "ces.sid", secret: SESSION_SECRET, store: new DatabaseSessionStore(),
  resave: false, saveUninitialized: false, rolling: true,
  cookie: { httpOnly: true, secure: IS_PRODUCTION, sameSite: "lax", maxAge: 8 * 60 * 60 * 1000 },
}));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8",
  legacyHeaders: false, skipSuccessfulRequests: true,
  message: "Muitas tentativas. Aguarde 15 minutos e tente novamente.",
});

function authPage(req, res, next) {
  if (req.session.user) return next();
  return res.redirect("/login");
}

function authJson(req, res, next) {
  if (req.session.user) return next();
  return res.status(401).json({ erro: "Sessão expirada. Entre novamente." });
}

function requirePasswordChanged(req, res, next) {
  if (!req.session.user.must_change_password) return next();
  return res.status(403).json({ erro: "Troque a senha inicial antes de alterar dados.", codigo: "CHANGE_PASSWORD_REQUIRED" });
}

function csrfToken(req) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  return req.session.csrfToken;
}

function verifyCsrf(req, res, next) {
  const expected = csrfToken(req);
  const received = String(req.get("x-csrf-token") || req.body?._csrf || "");
  const valid = received.length === expected.length && crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  if (!valid) return res.status(403).json({ erro: "Requisição inválida. Atualize a página." });
  return next();
}

function parseStudent(body) {
  const student = {
    nome_aluno: cleanText(body.nome_aluno, 160),
    escola: cleanText(body.escola || SCHOOL_NAME, 160),
    professor: cleanText(body.professor || PROFESSOR_NAME, 160),
    coordenador: cleanText(body.coordenador || COORDINATOR_NAME, 160),
    data_inicio: cleanText(body.data_inicio, 10), data_fim: cleanText(body.data_fim, 10),
  };
  if (student.nome_aluno.length < 3) return { error: "Informe o nome completo do aluno." };
  if (!student.escola || !student.professor || !student.coordenador) return { error: "Preencha escola, professor e coordenador." };
  if (!isValidIsoDate(student.data_inicio) || !isValidIsoDate(student.data_fim)) return { error: "Informe datas válidas." };
  if (student.data_fim < student.data_inicio) return { error: "A data final não pode ser anterior à data inicial." };
  return { student };
}

app.get("/healthz", async (req, res) => {
  try {
    await db.get("SELECT 1");
    return res.json({ status: "ok" });
  } catch {
    return res.status(503).json({ status: "indisponível" });
  }
});

app.get("/", (req, res) => res.redirect(req.session.user ? "/dashboard" : "/login"));
app.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/dashboard");
  return res.sendFile(path.join(PUBLIC_DIR, "login.html"));
});
app.post(["/login", "/api/auth/login"], loginLimiter, async (req, res) => {
  const json = req.path.startsWith('/api/');
  const fail = (status, code, message) => json ? res.status(status).json({ erro: message }) : res.redirect('/login?erro=' + code);
  try {
    const username = cleanText(req.body.username, 60);
    const password = String(req.body.password || "");
    const user = username ? await db.get("SELECT * FROM usuarios WHERE username = ?", username) : null;
    const passwordOk = user ? await bcrypt.compare(password, user.senha) : false;
    if (!user || !passwordOk) return fail(401, "credenciais", "Usuário ou senha incorretos.");
    return req.session.regenerate((error) => {
      if (error) return fail(500, "interno", "Não foi possível entrar agora.");
      req.session.user = {
        id: user.id, nome: user.nome, username: user.username,
        must_change_password: Boolean(user.must_change_password),
      };
      return req.session.save((error) => {
        if (error) return fail(500, 'interno', 'Não foi possível salvar a sessão.');
        const redirect = user.must_change_password ? '/configuracoes' : '/dashboard';
        return json ? res.json({ sucesso: true, redirect }) : res.redirect(redirect);
      });
    });
  } catch (error) {
    console.error("Erro no login:", error);
    return fail(500, "interno", "Não foi possível entrar agora.");
  }
});
app.post(["/logout", "/api/auth/logout"], authJson, verifyCsrf, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("ces.sid");
    res.json({ sucesso: true });
  });
});

app.get("/dashboard", authPage, (req, res) => res.sendFile(path.join(PUBLIC_DIR, "dashboard.html")));
app.get("/cadastro", authPage, (req, res) => res.sendFile(path.join(PUBLIC_DIR, "cadastro.html")));
app.get("/configuracoes", authPage, (req, res) => res.sendFile(path.join(PUBLIC_DIR, "configuracoes.html")));

app.get("/api/me", authJson, (req, res) => res.json({
  user: req.session.user, csrfToken: csrfToken(req),
  defaults: { escola: SCHOOL_NAME, professor: PROFESSOR_NAME, coordenador: COORDINATOR_NAME },
}));
app.post("/api/me/password", authJson, verifyCsrf, async (req, res) => {
  const currentPassword = String(req.body.senha_atual || "");
  const newPassword = String(req.body.nova_senha || "");
  const confirmation = String(req.body.confirmacao || "");
  if (newPassword.length < 12) return res.status(400).json({ erro: "A nova senha deve ter pelo menos 12 caracteres." });
  if (newPassword !== confirmation) return res.status(400).json({ erro: "A confirmação da senha não confere." });
  const user = await db.get("SELECT senha FROM usuarios WHERE id = ?", req.session.user.id);
  if (!user || !(await bcrypt.compare(currentPassword, user.senha))) return res.status(400).json({ erro: "A senha atual está incorreta." });
  const hash = await bcrypt.hash(newPassword, 12);
  await db.run("UPDATE usuarios SET senha = ?, must_change_password = 0, updated_at = datetime('now') WHERE id = ?", hash, req.session.user.id);
  req.session.user.must_change_password = false;
  return res.json({ sucesso: true, mensagem: "Senha alterada com sucesso." });
});

app.get("/api/stats", authJson, async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const row = await db.get(`SELECT COUNT(*) AS total,
    SUM(CASE WHEN data_fim >= ? THEN 1 ELSE 0 END) AS ativos,
    SUM(CASE WHEN substr(created_at, 1, 7) = ? THEN 1 ELSE 0 END) AS novos_mes FROM alunos`, today, today.slice(0, 7));
  res.json({ total: Number(row.total || 0), ativos: Number(row.ativos || 0), novos_mes: Number(row.novos_mes || 0) });
});

app.get("/api/alunos", authJson, async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
  const search = cleanText(req.query.busca, 100);
  const startDate = cleanText(req.query.inicio, 10);
  const endDate = cleanText(req.query.fim, 10);
  const clauses = [];
  const params = [];
  if (search) {
    clauses.push("(nome_aluno LIKE ? OR codigo_identificacao LIKE ? OR escola LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (startDate && isValidIsoDate(startDate)) { clauses.push("data_fim >= ?"); params.push(startDate); }
  if (endDate && isValidIsoDate(endDate)) { clauses.push("data_inicio <= ?"); params.push(endDate); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const totalRow = await db.get(`SELECT COUNT(*) AS total FROM alunos ${where}`, params);
  const total = Number(totalRow.total || 0);
  const pages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(page, pages);
  const alunos = await db.all(`SELECT * FROM alunos ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, ...params, limit, (currentPage - 1) * limit);
  res.json({ alunos, total, page: currentPage, limit, pages });
});

app.get("/api/alunos/:id", authJson, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ erro: "ID inválido." });
  const aluno = await db.get("SELECT * FROM alunos WHERE id = ?", id);
  if (!aluno) return res.status(404).json({ erro: "Aluno não encontrado." });
  return res.json({ aluno });
});

async function createStudent(req, res) {
  const parsed = parseStudent(req.body);
  if (parsed.error) return res.status(400).json({ erro: parsed.error });
  const code = crypto.randomUUID();
  const result = await db.run(`INSERT INTO alunos
    (codigo_identificacao, nome_aluno, escola, professor, coordenador, data_inicio, data_fim, qr_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, code, parsed.student.nome_aluno, parsed.student.escola,
    parsed.student.professor, parsed.student.coordenador, parsed.student.data_inicio,
    parsed.student.data_fim, "");
  return res.status(201).json({ sucesso: true, mensagem: "Aluno e certificado cadastrados com sucesso.",
    id: result.lastID, codigo_identificacao: code, qr_code_url: `/qr/${result.lastID}`, validacao_url: validationUrl(code) });
}

app.post("/api/alunos", authJson, requirePasswordChanged, verifyCsrf, createStudent);
app.post("/api/gerar", authJson, requirePasswordChanged, verifyCsrf, createStudent);
app.put("/api/alunos/:id", authJson, requirePasswordChanged, verifyCsrf, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ erro: "ID inválido." });
  const parsed = parseStudent(req.body);
  if (parsed.error) return res.status(400).json({ erro: parsed.error });
  const result = await db.run(`UPDATE alunos SET nome_aluno = ?, escola = ?, professor = ?, coordenador = ?,
    data_inicio = ?, data_fim = ?, updated_at = datetime('now') WHERE id = ?`, parsed.student.nome_aluno,
  parsed.student.escola, parsed.student.professor, parsed.student.coordenador,
  parsed.student.data_inicio, parsed.student.data_fim, id);
  if (!result.changes) return res.status(404).json({ erro: "Aluno não encontrado." });
  return res.json({ sucesso: true, mensagem: "Cadastro atualizado com sucesso." });
});
app.delete("/api/alunos/:id", authJson, requirePasswordChanged, verifyCsrf, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ erro: "ID inválido." });
  const aluno = await db.get("SELECT qr_path FROM alunos WHERE id = ?", id);
  if (!aluno) return res.status(404).json({ erro: "Aluno não encontrado." });
  await db.run("DELETE FROM alunos WHERE id = ?", id);
  return res.json({ sucesso: true, mensagem: "Cadastro excluído." });
});

app.get("/qr/:id", authPage, async (req, res) => {
  const aluno = await db.get("SELECT * FROM alunos WHERE id = ?", Number.parseInt(req.params.id, 10));
  if (!aluno) return res.status(404).send("QR Code não encontrado.");
  const png = await QRCode.toBuffer(validationUrl(aluno.codigo_identificacao), { errorCorrectionLevel: 'M', margin: 2, width: 320 });
  return res.type('png').send(png);
});
app.get("/certificado/:id", authPage, async (req, res) => {
  const aluno = await db.get("SELECT * FROM alunos WHERE id = ?", Number.parseInt(req.params.id, 10));
  if (!aluno) return res.status(404).send("Aluno não encontrado.");
  const pdf = await gerarCertificadoPDF(aluno, validationUrl(aluno.codigo_identificacao));
  const filename = `certificado_${normalizeFileName(aluno.nome_aluno)}.pdf`;
  res.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"` });
  return res.send(pdf);
});
app.get("/imprimir/:id", authPage, async (req, res) => {
  const aluno = await db.get("SELECT * FROM alunos WHERE id = ?", Number.parseInt(req.params.id, 10));
  if (!aluno) return res.status(404).send("Aluno não encontrado.");
  return res.send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Imprimir certificado</title><link rel="stylesheet" href="/css/app.css"></head><body class="print-page"><main class="print-card"><p class="eyebrow">Centro de Estudo Sena</p><h1>${escapeHtml(aluno.nome_aluno)}</h1><p><strong>Escola:</strong> ${escapeHtml(aluno.escola)}</p><p><strong>Período:</strong> ${formatDateBR(aluno.data_inicio)} a ${formatDateBR(aluno.data_fim)}</p><p><strong>Autenticidade:</strong> ${escapeHtml(aluno.codigo_identificacao)}</p><img src="/qr/${aluno.id}" width="220" height="220" alt="QR Code"><p class="no-print"><a class="button primary" href="/certificado/${aluno.id}">Baixar certificado em PDF</a></p></main><script src="/js/print.js" defer></script></body></html>`);
});

app.get("/validar", (req, res) => {
  const code = cleanText(req.query.codigo, 80);
  if (code) return res.redirect(`/validar/${encodeURIComponent(code)}`);
  return res.sendFile(path.join(PUBLIC_DIR, "validar.html"));
});
app.get('/api/validar/:codigo', async (req, res) => {
  const aluno = await db.get('SELECT nome_aluno, escola, data_inicio, data_fim, codigo_identificacao FROM alunos WHERE codigo_identificacao = ?', cleanText(req.params.codigo, 80));
  if (!aluno) return res.status(404).json({ erro: 'Certificado não encontrado.' });
  return res.json({ aluno });
});
app.get("/validar/:codigo", async (req, res) => {
  const code = cleanText(req.params.codigo, 80);
  const aluno = code ? await db.get("SELECT * FROM alunos WHERE codigo_identificacao = ?", code) : null;
  if (!aluno) return res.status(404).send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Certificado não encontrado</title><link rel="stylesheet" href="/css/app.css"></head><body class="public-page"><main class="validation-card"><div class="status-icon error">×</div><p class="eyebrow">Validação de autenticidade</p><h1>Certificado não encontrado</h1><p>O código informado não corresponde a um certificado válido.</p><a class="button secondary" href="/validar">Tentar outro código</a></main></body></html>`);
  return res.send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Certificado válido</title><link rel="stylesheet" href="/css/app.css"></head><body class="public-page"><main class="validation-card"><div class="status-icon success">✓</div><p class="eyebrow">Validação de autenticidade</p><h1>Certificado válido</h1><p class="muted">Este registro foi localizado na base oficial.</p><dl class="details"><div><dt>Aluno</dt><dd>${escapeHtml(aluno.nome_aluno)}</dd></div><div><dt>Instituição</dt><dd>${escapeHtml(aluno.escola)}</dd></div><div><dt>Período</dt><dd>${formatDateBR(aluno.data_inicio)} a ${formatDateBR(aluno.data_fim)}</dd></div><div><dt>Código</dt><dd class="code">${escapeHtml(aluno.codigo_identificacao)}</dd></div></dl><a class="button secondary" href="/validar">Validar outro certificado</a></main></body></html>`);
});

app.use((req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ erro: "Rota não encontrada." });
  return res.status(404).send("Página não encontrada.");
});
app.use((error, req, res, next) => {
  console.error("Erro não tratado:", error);
  if (res.headersSent) return next(error);
  if (req.path.startsWith("/api/")) return res.status(500).json({ erro: "Erro interno do servidor." });
  return res.status(500).send("Erro interno do servidor.");
});

async function start() {
  await initDb();
  return new Promise((resolve) => {
    server = app.listen(PORT, process.env.HOST || "0.0.0.0", () => {
      console.log(`Servidor disponível em ${BASE_URL}`);
      resolve(server);
    });
  });
}
async function close() {
  if (server) await new Promise((resolve) => server.close(resolve));
  server = null;
  if (db) await db.close();
  db = null;
}
if (require.main === module) {
  start().catch((error) => { console.error("Erro ao iniciar servidor:", error.message); process.exit(1); });
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, async () => { await close(); process.exit(0); });
  }
}

module.exports = { app, initDb, start, close };
