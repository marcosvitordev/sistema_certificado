CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  senha TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT to_char(timezone('UTC', now()), 'YYYY-MM-DD HH24:MI:SS'),
  updated_at TEXT NOT NULL DEFAULT to_char(timezone('UTC', now()), 'YYYY-MM-DD HH24:MI:SS')
);
CREATE TABLE IF NOT EXISTS alunos (
  id SERIAL PRIMARY KEY,
  codigo_identificacao TEXT NOT NULL UNIQUE,
  nome_aluno TEXT NOT NULL,
  escola TEXT NOT NULL,
  professor TEXT NOT NULL,
  coordenador TEXT NOT NULL,
  data_inicio TEXT NOT NULL,
  data_fim TEXT NOT NULL,
  qr_path TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT to_char(timezone('UTC', now()), 'YYYY-MM-DD HH24:MI:SS'),
  updated_at TEXT NOT NULL DEFAULT to_char(timezone('UTC', now()), 'YYYY-MM-DD HH24:MI:SS')
);
CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expired_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alunos_nome ON alunos(nome_aluno);
CREATE INDEX IF NOT EXISTS idx_alunos_periodo ON alunos(data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired_at);

-- A aplicação usa conexão PostgreSQL privada com o proprietário das tabelas.
-- Nenhuma tabela deve ser acessível pela API pública do Supabase.
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
