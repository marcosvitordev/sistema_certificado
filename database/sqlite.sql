PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      senha TEXT NOT NULL,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expired_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_alunos_nome ON alunos(nome_aluno);
    CREATE INDEX IF NOT EXISTS idx_alunos_periodo ON alunos(data_inicio, data_fim);
    CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired_at);
