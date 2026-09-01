# Certifica CES

Sistema web para emissão, gestão e validação pública de certificados com QR Code.

## Funcionalidades

- login com sessão persistida em SQLite e proteção contra tentativas excessivas;
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

- Node.js 20 ou superior;
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

O banco fica em `data/sistema_cursos.db` e os QR Codes em `qrcodes/`. Esses diretórios, assim como `.env`, contêm dados privados e não devem ser versionados. Faça backup dos dois.

## Publicação

O passo a passo completo para Google Cloud Compute Engine, incluindo IP estático, `systemd`, Nginx, HTTPS e backup, está em [DEPLOY_GOOGLE_CLOUD.md](DEPLOY_GOOGLE_CLOUD.md).
