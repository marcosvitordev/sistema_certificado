require("dotenv").config();

const crypto = require("crypto");
const fs = require("fs-extra");
const path = require("path");
const QRCode = require("qrcode");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const sourceArg = process.argv[2];
if (!sourceArg) {
  console.error("Uso: npm run import -- caminho/para/alunos.json");
  process.exit(1);
}

const root = path.join(__dirname, "..");
const source = path.resolve(sourceArg);
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, "data"));
const qrDir = path.resolve(process.env.QR_DIR || path.join(root, "qrcodes"));
const dbPath = path.resolve(process.env.DB_PATH || path.join(dataDir, "sistema_cursos.db"));
const baseUrl = String(process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");

function isoDate(value) {
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

function safeName(value) {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").slice(0, 80);
}

(async () => {
  const students = await fs.readJson(source);
  if (!Array.isArray(students)) throw new Error("O arquivo JSON deve conter uma lista de alunos.");
  await fs.ensureDir(dataDir);
  await fs.ensureDir(qrDir);
  const db = await open({ filename: dbPath, driver: sqlite3.Database });
  let imported = 0;
  let skipped = 0;
  try {
    await db.exec("BEGIN IMMEDIATE");
    for (const item of students) {
      const name = String(item.nome_aluno || "").trim();
      const start = isoDate(item.data_inicio);
      const end = isoDate(item.data_fim);
      if (name.length < 3 || !start || !end || end < start) { skipped += 1; continue; }
      const code = String(item.codigo_identificacao || crypto.randomUUID());
      const existing = await db.get("SELECT id FROM alunos WHERE codigo_identificacao = ?", code);
      if (existing) { skipped += 1; continue; }
      const fileName = `qr_${safeName(name)}_${code}.png`;
      await QRCode.toFile(path.join(qrDir, fileName), `${baseUrl}/validar/${encodeURIComponent(code)}`);
      await db.run(`INSERT INTO alunos
        (codigo_identificacao, nome_aluno, escola, professor, coordenador, data_inicio, data_fim, qr_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, code, name,
      String(item.escola || process.env.SCHOOL_NAME || "Centro de Estudo Sena - CES").trim(),
      String(item.professor || process.env.PROFESSOR_NAME || "").trim(),
      String(item.coordenador || process.env.COORDINATOR_NAME || "").trim(),
      start, end, `qrcodes/${fileName}`);
      imported += 1;
    }
    await db.exec("COMMIT");
    console.log(`Importação concluída: ${imported} inserido(s), ${skipped} ignorado(s).`);
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  } finally {
    await db.close();
  }
})().catch((error) => {
  console.error("Falha na importação:", error.message);
  process.exit(1);
});
