require("dotenv").config();

const express = require("express");
const session = require("express-session");
const fs = require("fs-extra");
const path = require("path");
const QRCode = require("qrcode");
const cors = require("cors");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");

// SQLite
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const gerarCertificadoPDF = require("./gerarCertificadoPDF");

const app = express();

// ======= CONFIGURAÇÕES GERAIS =======
const PORT = Number(process.env.PORT || 3000);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const SESSION_SECRET =
  process.env.SESSION_SECRET || "troque-este-segredo-em-producao";

// ======= MIDDLEWARES =======
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Sessão
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // em produção com HTTPS, coloque true
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 8, // 8 horas
    },
  })
);

// ======= PASTAS =======
fs.ensureDirSync(path.join(__dirname, "qrcodes"));
fs.ensureDirSync(path.join(__dirname, "data"));
fs.ensureDirSync(path.join(__dirname, "certificados"));

app.use("/qrcodes", express.static(path.join(__dirname, "qrcodes")));
app.use("/certificados", express.static(path.join(__dirname, "certificados")));
app.use(express.static(path.join(__dirname, "public")));

// ======= HELPERS =======
function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeFileName(name = "") {
  return String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_ -]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

function isValidDate(date) {
  return !isNaN(Date.parse(date));
}

function formatDateBR(dateStr) {
  if (!dateStr || !isValidDate(dateStr)) return "-";
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("pt-BR");
}

// ======= MIDDLEWARES DE AUTENTICAÇÃO =======
function authPage(req, res, next) {
  if (req.session.user) return next();
  return res.redirect("/login");
}

function authJson(req, res, next) {
  if (req.session.user) return next();
  return res.status(401).json({ erro: "Não autenticado" });
}

// ======= SQLITE =======
let db;

async function initDb() {
  db = await open({
    filename: path.join(__dirname, "data", "sistema_cursos.db"),
    driver: sqlite3.Database,
  });

  await db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      senha TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS alunos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo_identificacao TEXT NOT NULL UNIQUE,
      nome_aluno TEXT NOT NULL,
      escola TEXT NOT NULL,
      professor TEXT NOT NULL,
      coordenador TEXT NOT NULL,
      data_inicio TEXT NOT NULL,
      data_fim TEXT NOT NULL,
      qr_path TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_alunos_nome ON alunos(nome_aluno);
    CREATE INDEX IF NOT EXISTS idx_alunos_periodo ON alunos(data_inicio, data_fim);
  `);

  // Usuário admin seed
  const senhaAdminHash = await bcrypt.hash("123456", 10);

await db.run(
  `INSERT OR IGNORE INTO usuarios (id, nome, username, senha, created_at)
   VALUES (?, ?, ?, ?, ?)`,
  [
    1,
    "Administrador",
    "admin",
    senhaAdminHash,
    "2025-11-24 17:31:29",
  ]
);

  const alunosSeed = [
    [1,"8a9962c1-15fa-4f51-8087-0c5f5901c81c","ZABELER FANTYNY SOUZA RODRIGUES","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2024-09-30","2025-03-30","qrcodes/qr_ZABELER_FANTYNY_SOUZA_RODRIGUES_8a9962c1-15fa-4f51-8087-0c5f5901c81c.png","2025-11-24 17:12:11"],
    [2,"3094c23a-4741-4708-883f-53e6c7cf2075","MARIA JOSÉ FREIRE PEREIRA","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2025-03-09","2025-04-07","qrcodes/qr_MARIA_JOSE_FREIRE_PEREIRA_3094c23a-4741-4708-883f-53e6c7cf2075.png","2025-11-24 17:16:16"],
    [3,"236fb129-af91-4b5f-a856-7efa6b4fbced","Marcos Vitor","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2019-10-15","2024-10-07","qrcodes/qr_Marcos_Vitor_236fb129-af91-4b5f-a856-7efa6b4fbced.png","2025-11-24 17:23:28"],
    [4,"f74c5e75-c3b7-4340-b53c-5901853feecb","ANA BEATRIZ SILVA DE SOUZA","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2024-06-10","2024-12-10","qrcodes/qr_ANA_BEATRIZ_SILVA_DE_SOUZA_f74c5e75-c3b7-4340-b53c-5901853feecb.png","2025-11-24 17:23:28"],
    [5,"b4472bcd-fbfc-4300-ab4a-2a35dd09a355","MARIA CLARA DE SOUZA QUEIROZ","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2024-06-10","2024-12-10","qrcodes/qr_MARIA_CLARA_DE_SOUZA_QUEIROZ_b4472bcd-fbfc-4300-ab4a-2a35dd09a355.png","2025-11-24 17:23:28"],
    [6,"4ffe8536-7999-47c4-8bd5-92c44dd82a99","SINGRIDY EMILLY MARQUES DA SILVA","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2025-01-01","2025-07-01","qrcodes/qr_SINGRIDY_EMILLY_MARQUES_DA_SILVA_4ffe8536-7999-47c4-8bd5-92c44dd82a99.png","2025-11-24 17:23:28"],
    [7,"88e20cb0-7457-4129-8fe3-ee04d71b877b","REINALDO COSTA DA SILVA","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2025-01-15","2025-07-15","qrcodes/qr_REINALDO_COSTA_DA_SILVA_88e20cb0-7457-4129-8fe3-ee04d71b877b.png","2025-11-24 17:23:28"],
    [8,"4414563d-2f91-43b9-bdf1-d7d4ecd55370","YASMIN THAELLY MARQUES DA SILVA","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2024-09-02","2025-03-02","qrcodes/qr_YASMIN_THAELLY_MARQUES_DA_SILVA_4414563d-2f91-43b9-bdf1-d7d4ecd55370.png","2025-11-24 17:23:28"],
    [9,"6a65bfd9-ea60-4701-b329-11adadf1968a","RONALEUDO SILVA DA ROCHA","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2024-08-13","2025-02-13","qrcodes/qr_RONALEUDO_SILVA_DA_ROCHA_6a65bfd9-ea60-4701-b329-11adadf1968a.png","2025-11-24 17:23:28"],
    [10,"5e294892-b87e-454e-9513-9ef7e0329cdc","MARLY RUFINO DE PAIVA","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2024-08-13","2025-02-13","qrcodes/qr_MARLY_RUFINO_DE_PAIVA_5e294892-b87e-454e-9513-9ef7e0329cdc.png","2025-11-24 17:23:28"],
    [11,"001665ef-2c08-4846-9bbe-cba3822c6217","ANA PAULA DA SILVA MOURA","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2024-08-27","2025-02-27","qrcodes/qr_ANA_PAULA_DA_SILVA_MOURA_001665ef-2c08-4846-9bbe-cba3822c6217.png","2025-11-24 17:23:28"],
    [12,"02c1492b-7e8d-4ea9-b4fe-8a7e6a507834","ANTONIA NUNES DE PAIVA","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2024-08-12","2025-02-12","qrcodes/qr_ANTONIA_NUNES_DE_PAIVA_02c1492b-7e8d-4ea9-b4fe-8a7e6a507834.png","2025-11-24 17:23:28"],
    [13,"ad4d9978-a46a-4b07-88b5-25fa9e54a3b5","JEFTER MATEUS DE SOUZA SANTOS","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2024-08-05","2025-02-05","qrcodes/qr_JEFTER_MATEUS_DE_SOUZA_SANTOS_ad4d9978-a46a-4b07-88b5-25fa9e54a3b5.png","2025-11-24 17:23:28"],
    [14,"64f567bf-0632-41c1-96bb-a35964aa07d7","AMANDA VITORIA RODRIGUES SILVA","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2024-08-26","2025-02-26","qrcodes/qr_AMANDA_VITORIA_RODRIGUES_SILVA_64f567bf-0632-41c1-96bb-a35964aa07d7.png","2025-11-24 17:23:28"],
    [15,"4ab96e90-0913-484a-9eeb-9c889795c5ef","MATHEUS ALMEIDA DE QUEIROZ","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2024-10-08","2025-04-08","qrcodes/qr_MATHEUS_ALMEIDA_DE_QUEIROZ_4ab96e90-0913-484a-9eeb-9c889795c5ef.png","2025-11-24 17:23:28"],
    [16,"24bf7a03-de6c-4ffb-8437-1b6990f19c11","OGG KAUE TAVARES LIMA","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2024-09-02","2025-03-02","qrcodes/qr_OGG_KAUE_TAVARES_LIMA_24bf7a03-de6c-4ffb-8437-1b6990f19c11.png","2025-11-24 17:23:28"],
    [17,"f3f61aa1-4fe4-4a8e-bc58-653dc2b67cca","CALEBE SILVA ALENCAR","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2024-12-09","2025-06-09","qrcodes/qr_CALEBE_SILVA_ALENCAR_f3f61aa1-4fe4-4a8e-bc58-653dc2b67cca.png","2025-11-24 17:23:28"],
    [18,"0370d9f0-32ec-4d95-ab33-40448690d6a6","GLEICIANE PEIXE DE SOUZA SANTOS","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2024-10-21","2025-04-21","qrcodes/qr_GLEICIANE_PEIXE_DE_SOUZA_SANTOS_0370d9f0-32ec-4d95-ab33-40448690d6a6.png","2025-11-24 17:23:28"],
    [19,"54bdf43d-12ca-4838-92f0-c7f7407e8d00","SIRLANDIA DOS SANTOS LOPES","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2024-11-05","2025-05-05","qrcodes/qr_SIRLANDIA_DOS_SANTOS_LOPES_54bdf43d-12ca-4838-92f0-c7f7407e8d00.png","2025-11-24 17:23:28"],
    [20,"d21e308a-bdc1-4ee1-9f5c-3e4389bc53ec","sadasdsa","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2025-07-30","2025-07-30","qrcodes/qr_sadasdsa_d21e308a-bdc1-4ee1-9f5c-3e4389bc53ec.png","2025-11-24 17:23:28"],
    [21,"5e20b944-099e-47b8-930d-10acb41e1f03","MESSIAS SILVA DE ALMEIDA","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2025-01-31","2025-07-13","qrcodes/qr_MESSIAS_SILVA_DE_ALMEIDA_5e20b944-099e-47b8-930d-10acb41e1f03.png","2025-11-24 17:23:28"],
    [22,"28f9bc9f-d73b-413c-ab64-7d38cf19ee9a","ROMEU SILVA DO NASCIMENTO","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2025-01-31","2025-07-13","qrcodes/qr_ROMEU_SILVA_DO_NASCIMENTO_28f9bc9f-d73b-413c-ab64-7d38cf19ee9a.png","2025-11-24 17:23:29"],
    [23,"807dc2dc-722f-4520-b394-1a02a5127094","FRANCISCO DAS CHAGAS SILVA DE ALMEIDA","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2025-01-31","2025-07-13","qrcodes/qr_FRANCISCO_DAS_CHAGAS_SILVA_DE_ALMEIDA_807dc2dc-722f-4520-b394-1a02a5127094.png","2025-11-24 17:23:29"],
    [24,"65e49a05-8c93-4be4-9571-a1eaade2ade1","GALBERT ENDREW LIMA VASQUES HENRIQUE","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2025-01-28","2025-07-28","qrcodes/qr_GALBERT_ENDREW_LIMA_VASQUES_HENRIQUE_65e49a05-8c93-4be4-9571-a1eaade2ade1.png","2025-11-24 17:23:29"],
    [25,"1295f4c6-dda7-4ead-a2fb-c89ef14a64a6","ERIANE ALVES DE FREITAS","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2025-02-18","2025-08-18","qrcodes/qr_ERIANE_ALVES_DE_FREITAS_1295f4c6-dda7-4ead-a2fb-c89ef14a64a6.png","2025-11-24 17:23:29"],
    [26,"fc71cafc-1430-4664-9751-cce0ef3bb18d","RAYNER MIRANDA MACEDO","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2025-02-24","2025-08-24","qrcodes/qr_RAYNER_MIRANDA_MACEDO_fc71cafc-1430-4664-9751-cce0ef3bb18d.png","2025-11-24 17:23:29"],
    [27,"de5b7372-4983-473c-8fe9-cf61f2cef8ad","WESLLEY RODRIGUES MOURA","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2025-03-10","2025-09-10","qrcodes/qr_WESLLEY_RODRIGUES_MOURA_de5b7372-4983-473c-8fe9-cf61f2cef8ad.png","2025-11-24 17:23:29"],
    [28,"9b98ab1d-aa4b-4b86-afef-1048cffda2ad","FRANCISCO RUFINO DA SILVA","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2025-03-24","2025-08-24","qrcodes/qr_FRANCISCO_RUFINO_DA_SILVA_9b98ab1d-aa4b-4b86-afef-1048cffda2ad.png","2025-11-24 17:23:29"],
    [29,"0444fd7c-3b5a-4d83-9b25-06973271a9fb","SAMUEL RIBEIRO DE MAGALHAES","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2025-02-17","2025-08-17","qrcodes/qr_SAMUEL_RIBEIRO_DE_MAGALHAES_0444fd7c-3b5a-4d83-9b25-06973271a9fb.png","2025-11-24 17:23:29"],
    [30,"a55109ac-f0bd-499f-b49b-0594444cd74c","JOCINEI CIDRAO DE FARIAS","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2025-02-04","2025-08-04","qrcodes/qr_JOCINEI_CIDRAO_DE_FARIAS_a55109ac-f0bd-499f-b49b-0594444cd74c.png","2025-11-24 17:23:29"],
    [31,"28342dde-f79a-42b2-856b-685bc2d9c65d","LUCAS GABRIEL DA SILVA GIMES","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2025-03-10","2025-09-10","qrcodes/qr_LUCAS_GABRIEL_DA_SILVA_GIMES_28342dde-f79a-42b2-856b-685bc2d9c65d.png","2025-11-24 17:23:29"],
    [32,"63496b71-53d5-4049-94d7-7a34c28eecd1","FRANCISCO GABRIEL MAGALHAES GOMES","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2025-05-12","2025-11-12","qrcodes/qr_FRANCISCO_GABRIEL_MAGALHAES_GOMES_63496b71-53d5-4049-94d7-7a34c28eecd1.png","2025-12-12 17:02:24"],
    [33,"0d40b7fd-0059-45a4-97a0-47d4683eef29","ARIELLY BRITO DOS SANTOS","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2025-05-07","2025-11-07","qrcodes/qr_ARIELLY_BRITO_DOS_SANTOS_0d40b7fd-0059-45a4-97a0-47d4683eef29.png","2025-12-12 17:03:01"],
    [34,"337edcfb-a686-4f84-96dc-9921f1810a56","JARDSON LIMA DE BRITO","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2025-04-28","2025-10-28","qrcodes/qr_JARDSON_LIMA_DE_BRITO_337edcfb-a686-4f84-96dc-9921f1810a56.png","2025-12-22 17:16:04"],
    [35,"e13ee777-7ec0-4193-8424-9422ee86f62d","AYLTON MAGALHAES DOS REIS COSTA","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2025-05-12","2025-11-12","qrcodes/qr_AYLTON_MAGALHAES_DOS_REIS_COSTA_e13ee777-7ec0-4193-8424-9422ee86f62d.png","2025-12-22 17:16:50"],
    [36,"6c947b52-aa8e-4666-96c4-390d24c1ca56","ALINE MAGALHAES DOS REIS COSTA","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2025-05-12","2025-11-12","qrcodes/qr_ALINE_MAGALHAES_DOS_REIS_COSTA_6c947b52-aa8e-4666-96c4-390d24c1ca56.png","2025-12-22 17:17:32"],
    [37,"006a7422-15d5-45c4-98a4-72defc739b7a","EMANUELY DE LIMA CARVALHO","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2025-05-07","2025-11-07","qrcodes/qr_EMANUELY_DE_LIMA_CARVALHO_006a7422-15d5-45c4-98a4-72defc739b7a.png","2025-12-22 17:17:59"],
    [38,"32ab7647-ac6f-4306-ab95-75e170769a14","NAYARA MANUELLY OLIVEIRA DE SOUZA","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2025-04-24","2025-10-22","qrcodes/qr_NAYARA_MANUELLY_OLIVEIRA_DE_SOUZA_32ab7647-ac6f-4306-ab95-75e170769a14.png","2025-12-22 17:18:44"],
    [39,"57268a84-20ab-4683-a872-c6c3ad79edc4","JHENNEFY VITTORIA CARDOSO DOS SANTOS","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2025-04-28","2025-12-01","qrcodes/qr_JHENNEFY_VITTORIA_CARDOSO_DOS_SANTOS_57268a84-20ab-4683-a872-c6c3ad79edc4.png","2026-01-19 16:48:30"],
    [40,"57a0a328-fb51-4548-9f1d-76dee21f20c7","EVELLY LIRA DA SILVA","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2025-07-03","2026-01-07","qrcodes/qr_EVELLY_LIRA_DA_SILVA_57a0a328-fb51-4548-9f1d-76dee21f20c7.png","2026-01-19 16:49:03"],
    [41,"d536bb6c-ab1c-41d2-9dc8-f974f2a97971","HYANNA CRISTINA DE OLIVEIRA FREIRE","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2025-08-13","2026-02-13","qrcodes/qr_HYANNA_CRISTINA_DE_OLIVEIRA_FREIRE_d536bb6c-ab1c-41d2-9dc8-f974f2a97971.png","2026-01-27 16:46:35"],
    [42,"654d34c9-47b9-4f0c-ac3d-c3c75e402c7d","RAIMUNDO ANDRADE DE OLIVEIRA NETO","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2025-06-09","2025-12-09","qrcodes/qr_RAIMUNDO_ANDRADE_DE_OLIVEIRA_NETO_654d34c9-47b9-4f0c-ac3d-c3c75e402c7d.png","2026-01-27 16:47:18"],
    [43,"52e5c2d7-9908-40a4-b94c-da2f3158ff19","ANA PAULA DA COSTA","Centro de Estudo Sena - CES","MARCOS VITOR LIMA DA COSTA","JOAQUIM DE ARAUJO MORAIS","2025-06-17","2025-12-17","qrcodes/qr_ANA_PAULA_DA_COSTA_52e5c2d7-9908-40a4-b94c-da2f3158ff19.png","2026-01-27 16:47:50"],
  ];

  await db.exec("BEGIN TRANSACTION;");
  const stmt = await db.prepare(`
    INSERT OR IGNORE INTO alunos
    (id, codigo_identificacao, nome_aluno, escola, professor, coordenador, data_inicio, data_fim, qr_path, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  try {
    for (const aluno of alunosSeed) {
      aluno[8] = String(aluno[8]).replace(/\\/g, "/");
      await stmt.run(aluno);
    }
    await stmt.finalize();
    await db.exec("COMMIT;");
  } catch (err) {
    await db.exec("ROLLBACK;");
    throw err;
  }

  // Ajuste do autoincrement
  await db.exec(`DELETE FROM sqlite_sequence WHERE name IN ('alunos','usuarios');`);
  await db.exec(`INSERT INTO sqlite_sequence(name, seq) VALUES ('usuarios', 1);`);
  await db.exec(`INSERT INTO sqlite_sequence(name, seq) VALUES ('alunos', 43);`);

  console.log("✅ SQLite pronto em:", path.join(__dirname, "data", "sistema_cursos.db"));
  console.log("✅ Seed aplicado com sucesso");
}

// ======= ROTAS DE AUTENTICAÇÃO =======
app.get("/login", (req, res) => {
  if (req.session.user) {
    return res.redirect("/dashboard");
  }
  return res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/login", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");

    if (!username || !password) {
      return res.status(400).send(`
        <h2>Dados inválidos</h2>
        <p>Informe usuário e senha.</p>
        <a href="/login">Voltar</a>
      `);
    }

    const user = await db.get(`SELECT * FROM usuarios WHERE username = ?`, [username]);

    if (!user) {
      return res.status(401).send(`
        <h2>Usuário não encontrado</h2>
        <a href="/login">Voltar</a>
      `);
    }

    const senhaOK = await bcrypt.compare(password, user.senha);

    if (!senhaOK) {
      return res.status(401).send(`
        <h2>Senha incorreta</h2>
        <a href="/login">Voltar</a>
      `);
    }

    req.session.user = {
      id: user.id,
      nome: user.nome,
      username: user.username,
    };

    return res.redirect("/dashboard");
  } catch (error) {
    console.error("Erro no login:", error);
    return res.status(500).send("Erro interno no login");
  }
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

// ======= ROTAS DE PÁGINAS =======
app.get("/", (req, res) => {
  if (req.session.user) {
    return res.redirect("/dashboard");
  }
  return res.redirect("/login");
});

app.get("/dashboard", authPage, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.get("/cadastro", authPage, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "cadastro.html"));
});

// ======= API: USUÁRIO ATUAL =======
app.get("/api/me", authJson, (req, res) => {
  res.json({
    user: req.session.user,
  });
});

// ======= API: LISTAR ALUNOS =======
app.get("/api/alunos", authJson, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const busca = String(req.query.busca || "").trim();
    const periodo = String(req.query.periodo || "").trim();

    const offset = (page - 1) * limit;

    let where = "WHERE 1=1";
    const params = [];

    if (busca) {
      where += " AND nome_aluno LIKE ?";
      params.push(`%${busca}%`);
    }

    if (periodo) {
      const [inicio, fim] = periodo.split(",");
      if (inicio && fim && isValidDate(inicio) && isValidDate(fim)) {
        // interseção de período
        where += " AND data_inicio <= ? AND data_fim >= ?";
        params.push(fim, inicio);
      }
    }

    const alunos = await db.all(
      `SELECT * FROM alunos ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const totalRow = await db.get(
      `SELECT COUNT(*) AS total FROM alunos ${where}`,
      params
    );

    const total = totalRow?.total || 0;

    res.json({
      alunos,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Erro ao listar alunos:", error);
    res.status(500).json({ erro: "Erro ao carregar alunos" });
  }
});

// ======= API: BUSCAR ALUNO POR ID =======
app.get("/api/alunos/:id", authJson, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({ erro: "ID inválido" });
    }

    const aluno = await db.get("SELECT * FROM alunos WHERE id = ?", [id]);

    if (!aluno) {
      return res.status(404).json({ erro: "Aluno não encontrado" });
    }

    res.json({ aluno });
  } catch (error) {
    console.error("Erro ao buscar aluno:", error);
    res.status(500).json({ erro: "Erro ao buscar aluno" });
  }
});

// ======= API: GERAR NOVO CERTIFICADO =======
app.post("/api/gerar", authJson, async (req, res) => {
  try {
    const nome_aluno = String(req.body.nome_aluno || "").trim();
    const data_inicio = String(req.body.data_inicio || "").trim();
    const data_fim = String(req.body.data_fim || "").trim();

    if (!nome_aluno || !data_inicio || !data_fim) {
      return res.status(400).json({ erro: "Preencha todos os campos" });
    }

    if (nome_aluno.length < 3) {
      return res.status(400).json({ erro: "Nome do aluno muito curto" });
    }

    if (!isValidDate(data_inicio) || !isValidDate(data_fim)) {
      return res.status(400).json({ erro: "Data inválida" });
    }

    if (new Date(data_fim) < new Date(data_inicio)) {
      return res.status(400).json({
        erro: "A data final não pode ser menor que a data inicial",
      });
    }

    const codigo = uuidv4();

    const dadosAluno = {
      codigo_identificacao: codigo,
      escola: "Centro de Estudo Sena - CES",
      nome_aluno,
      professor: "MARCOS VITOR LIMA DA COSTA",
      coordenador: "JOAQUIM DE ARAUJO MORAIS",
      data_inicio,
      data_fim,
    };

    const safeName = normalizeFileName(nome_aluno) || "aluno";
    const qrFile = `qr_${safeName}_${codigo}.png`;
    const qrPath = path.join("qrcodes", qrFile);

    const urlValidacao = `${BASE_URL}/validar/${codigo}`;
    await QRCode.toFile(qrPath, urlValidacao);

    const result = await db.run(
      `
      INSERT INTO alunos
      (codigo_identificacao, nome_aluno, escola, professor, coordenador, data_inicio, data_fim, qr_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        codigo,
        dadosAluno.nome_aluno,
        dadosAluno.escola,
        dadosAluno.professor,
        dadosAluno.coordenador,
        dadosAluno.data_inicio,
        dadosAluno.data_fim,
        qrPath.replace(/\\/g, "/"),
      ]
    );

    res.json({
      sucesso: true,
      mensagem: "QR Code gerado com sucesso",
      id: result.lastID,
      codigo_identificacao: codigo,
      qr_code_url: `/${qrPath.replace(/\\/g, "/")}`,
      validacao_url: urlValidacao,
    });
  } catch (error) {
    console.error("Erro ao gerar QR:", error);
    res.status(500).json({ erro: "Erro ao gerar QR Code" });
  }
});

// ======= API: EXCLUIR ALUNO =======
app.delete("/api/alunos/:id", authJson, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({ erro: "ID inválido" });
    }

    const aluno = await db.get("SELECT * FROM alunos WHERE id = ?", [id]);

    if (!aluno) {
      return res.status(404).json({ erro: "Aluno não encontrado" });
    }

    // remove QR se existir
    const qrFullPath = path.join(__dirname, aluno.qr_path || "");
    if (await fs.pathExists(qrFullPath)) {
      await fs.remove(qrFullPath);
    }

    await db.run("DELETE FROM alunos WHERE id = ?", [id]);

    res.json({
      sucesso: true,
      mensagem: "Aluno removido com sucesso",
    });
  } catch (error) {
    console.error("Erro ao excluir aluno:", error);
    res.status(500).json({ erro: "Erro ao excluir aluno" });
  }
});

// ======= IMPRESSÃO =======
app.get("/imprimir/:id", authPage, async (req, res) => {
  try {
    const aluno = await db.get("SELECT * FROM alunos WHERE id = ?", [req.params.id]);

    if (!aluno) {
      return res.status(404).send("Aluno não encontrado");
    }

    const qr = "/" + String(aluno.qr_path).replace(/\\/g, "/");

    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Impressão</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 40px;
          }
          h1 {
            margin-bottom: 10px;
          }
          .info {
            font-size: 18px;
            margin-bottom: 20px;
          }
          img {
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(aluno.nome_aluno)}</h1>
        <div class="info">
          <p><strong>Escola:</strong> ${escapeHtml(aluno.escola)}</p>
          <p><strong>Período:</strong> ${escapeHtml(formatDateBR(aluno.data_inicio))} até ${escapeHtml(formatDateBR(aluno.data_fim))}</p>
        </div>
        <img src="${qr}" width="220" alt="QR Code do aluno" />
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Erro ao imprimir:", error);
    res.status(500).send("Erro ao imprimir");
  }
});

// ======= GERAR CERTIFICADO PDF =======
app.get("/certificado/:id", authPage, async (req, res) => {
  try {
    const aluno = await db.get("SELECT * FROM alunos WHERE id = ?", [req.params.id]);

    if (!aluno) {
      return res.status(404).send("Aluno não encontrado");
    }

    const pdfPath = await gerarCertificadoPDF(aluno);

    return res.download(pdfPath);
  } catch (error) {
    console.error("Erro ao gerar certificado:", error);
    return res.status(500).send("Erro ao gerar certificado");
  }
});

// ======= VALIDAÇÃO PÚBLICA =======
app.get("/validar/:codigo", async (req, res) => {
  try {
    const codigo = String(req.params.codigo || "").trim();

    if (!codigo) {
      return res.status(400).send("Código inválido");
    }

    const aluno = await db.get(
      "SELECT * FROM alunos WHERE codigo_identificacao = ?",
      [codigo]
    );

    if (!aluno) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <title>Validação do Certificado</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              background: #f5f5f5;
              padding: 40px;
            }
            .box {
              max-width: 700px;
              margin: 0 auto;
              background: white;
              padding: 30px;
              border-radius: 12px;
              box-shadow: 0 4px 20px rgba(0,0,0,.08);
            }
            .erro {
              color: #b91c1c;
            }
          </style>
        </head>
        <body>
          <div class="box">
            <h1 class="erro">Certificado não encontrado</h1>
            <p>O código informado não corresponde a nenhum certificado válido em nosso sistema.</p>
            <p>Entre em contato com a administração ou com a escola para mais informações.</p>
          </div>
        </body>
        </html>
      `);
    }

    const qr = "/" + String(aluno.qr_path).replace(/\\/g, "/");

    return res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Validação do Certificado</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: #f4f7fb;
            margin: 0;
            padding: 30px;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            background: #fff;
            border-radius: 16px;
            box-shadow: 0 6px 30px rgba(0,0,0,.08);
            padding: 30px;
          }
          .ok {
            color: #166534;
          }
          .badge {
            display: inline-block;
            background: #dcfce7;
            color: #166534;
            padding: 8px 14px;
            border-radius: 999px;
            font-weight: bold;
            margin-bottom: 16px;
          }
          .grid {
            display: grid;
            grid-template-columns: 1fr 220px;
            gap: 24px;
            align-items: center;
          }
          .info p {
            margin: 8px 0;
            font-size: 16px;
          }
          img {
            max-width: 220px;
            width: 100%;
            border: 1px solid #ddd;
            border-radius: 12px;
            padding: 8px;
            background: white;
          }
          @media (max-width: 700px) {
            .grid {
              grid-template-columns: 1fr;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="badge">Certificado válido</div>
          <h1 class="ok">Validação concluída com sucesso</h1>
          <div class="grid">
            <div class="info">
              <p><strong>Aluno:</strong> ${escapeHtml(aluno.nome_aluno)}</p>
              <p><strong>Escola:</strong> ${escapeHtml(aluno.escola)}</p>
              <p><strong>Professor:</strong> ${escapeHtml(aluno.professor)}</p>
              <p><strong>Coordenador:</strong> ${escapeHtml(aluno.coordenador)}</p>
              <p><strong>Data de início:</strong> ${escapeHtml(formatDateBR(aluno.data_inicio))}</p>
              <p><strong>Data de término:</strong> ${escapeHtml(formatDateBR(aluno.data_fim))}</p>
              <p><strong>Código de autenticidade:</strong> ${escapeHtml(aluno.codigo_identificacao)}</p>
            </div>
            <div>
              <img src="${qr}" alt="QR Code do certificado" />
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Erro na validação:", error);
    return res.status(500).send("Erro ao validar certificado");
  }
});

// ======= VALIDAÇÃO MANUAL =======
app.get("/validar", (req, res) => {
  const codigo = String(req.query.codigo || "").trim();

  if (codigo) {
    return res.redirect(`/validar/${encodeURIComponent(codigo)}`);
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Validar Certificado</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #f4f7fb;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
        }
        .box {
          background: white;
          padding: 30px;
          border-radius: 16px;
          box-shadow: 0 8px 30px rgba(0,0,0,.08);
          width: 100%;
          max-width: 480px;
        }
        h1 {
          margin-top: 0;
        }
        input {
          width: 100%;
          padding: 12px;
          border: 1px solid #ccc;
          border-radius: 10px;
          margin: 12px 0 16px;
          box-sizing: border-box;
        }
        button {
          width: 100%;
          padding: 12px;
          border: 0;
          border-radius: 10px;
          background: #2563eb;
          color: white;
          font-size: 16px;
          cursor: pointer;
        }
        button:hover {
          background: #1d4ed8;
        }
      </style>
    </head>
    <body>
      <form class="box" method="GET" action="/validar">
        <h1>Validar Certificado</h1>
        <p>Digite o código de autenticidade do certificado para validar.</p>
        <input
          type="text"
          name="codigo"
          placeholder="Digite o código do certificado"
          required
        />
        <button type="submit">Validar agora</button>
      </form>
    </body>
    </html>
  `);
});

// ======= TRATAMENTO 404 =======
app.use((req, res) => {
  res.status(404).send("Página não encontrada");
});

// ======= START =======
(async () => {
  try {
    await initDb();

    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando em: ${BASE_URL}`);
    });
  } catch (error) {
    console.error("Erro ao iniciar servidor:", error);
    process.exit(1);
  }
})();