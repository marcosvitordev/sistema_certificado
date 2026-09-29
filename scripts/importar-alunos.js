require("dotenv").config();

const crypto = require("crypto");
const fs = require("fs-extra");
const path = require("path");
const { openDatabase, initializeSchema } = require("../database");

const sourceArg = process.argv[2];
if (!sourceArg) {
  console.error("Uso: npm run import -- caminho/para/alunos.json");
  process.exit(1);
}

const root = path.join(__dirname, "..");
const source = path.resolve(sourceArg);
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, "data"));
const dbPath = path.resolve(process.env.DB_PATH || path.join(dataDir, "sistema_cursos.db"));

function isoDate(value) {
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}


(async () => {
  const students = await fs.readJson(source);
  if (!Array.isArray(students)) throw new Error("O arquivo JSON deve conter uma lista de alunos.");
  const db = await openDatabase({ filename: dbPath });
  let imported = 0;
  let skipped = 0;
  try {
    await initializeSchema(db);
    const importRows = async (connection) => {
      for (const item of students) {
        const name = String(item.nome_aluno || "").trim();
        const start = isoDate(item.data_inicio);
        const end = isoDate(item.data_fim);
        if (name.length < 3 || !start || !end || end < start) { skipped += 1; continue; }
        const code = String(item.codigo_identificacao || crypto.randomUUID());
        const existing = await connection.get("SELECT id FROM alunos WHERE codigo_identificacao = ?", code);
        if (existing) { skipped += 1; continue; }
        await connection.run(`INSERT INTO alunos
          (codigo_identificacao, nome_aluno, escola, professor, coordenador, data_inicio, data_fim, qr_path)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, code, name,
        String(item.escola || process.env.SCHOOL_NAME || "Centro de Estudo Sena - CES").trim(),
        String(item.professor || process.env.PROFESSOR_NAME || "").trim(),
        String(item.coordenador || process.env.COORDINATOR_NAME || "").trim(),
        start, end, "");
        imported += 1;
      }
    };
    if (db.dialect === "postgres") await db.transaction(importRows);
    else {
      await db.exec("BEGIN IMMEDIATE");
      try { await importRows(db); await db.exec("COMMIT"); }
      catch (error) { await db.exec("ROLLBACK"); throw error; }
    }
    console.log(`Importação concluída: ${imported} inserido(s), ${skipped} ignorado(s).`);
  } finally {
    await db.close();
  }
})().catch((error) => {
  console.error("Falha na importação:", error.message);
  process.exit(1);
});
