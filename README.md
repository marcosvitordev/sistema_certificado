# Certifica CES

Sistema web para emissão, gestão e validação pública de certificados com QR Code.

A estrutura de hospedagem está preparada para **Vercel (Next.js) → Render (Express) → Supabase (PostgreSQL)**. Siga o [guia de publicação e migração dos dados](DEPLOY_VERCEL_RENDER_SUPABASE.md).

O backend fica na raiz; o frontend Next.js fica em `frontend/`. O modo local com SQLite e as páginas anteriores continuam disponíveis.

## Funcionalidades

- login com sessão persistida em PostgreSQL ou SQLite e proteção contra tentativas excessivas;
- troca obrigatória da senha inicial;
- proteção CSRF e cabeçalhos de segurança;
- cadastro, busca, filtro, paginação, edição e exclusão de certificados;
- QR Code com URL de validação pública;
- certificado PDF gerado sob demanda, sem arquivos temporários públicos;
- painel responsivo com indicadores;
- endpoint de saúde para monitoramento;
- importação opcional de alunos por JSON;
- testes automatizados do fluxo principal.

## Requisitos

- Node.js 22 ou superior;
- npm;
- Linux, macOS ou Windows para desenvolvimento;
- Nginx recomendado em produção.

## Executar localmente

```bash
npm install
```

Copie `.env.example` para `.env`, ajuste os valores e execute:

```bash
npm start
```

Acesse `http://localhost:3000`. Em um banco vazio, a conta é criada com `ADMIN_USERNAME` e `ADMIN_PASSWORD`, e a troca da senha será exigida no primeiro acesso.

## Comandos

```bash
npm start                 # inicia normalmente
npm run dev               # reinicia ao alterar arquivos
npm test                  # executa testes de integração
npm run check             # valida a sintaxe do backend
npm run import -- alunos.json
```

O importador aceita datas `AAAA-MM-DD` ou `DD/MM/AAAA`. Registros inválidos ou com código já existente são ignorados.

## Dados e backup

Sem `DATABASE_URL`, o banco local fica em `data/sistema_cursos.db`. Com `DATABASE_URL`, usuários, certificados e sessões ficam no PostgreSQL. QR Codes e PDFs são gerados em memória, sem depender de disco persistente. Preserve os backups existentes de `data/` e `qrcodes/`; esses diretórios e `.env` contêm dados privados e não devem ser versionados.

## Publicação

O caminho atual está em [Vercel + Render + Supabase](DEPLOY_VERCEL_RENDER_SUPABASE.md), incluindo a migração do SQLite existente. O [guia anterior do Google Cloud](DEPLOY_GOOGLE_CLOUD.md) permanece como alternativa para o backend com as páginas locais.
