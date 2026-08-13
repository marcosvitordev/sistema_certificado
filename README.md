# Certificate Management System

Sistema web para cadastro de alunos, geração de QR Codes e emissão de certificados em PDF.

## Funcionalidades

- autenticação de usuários com sessão;
- cadastro e consulta de alunos;
- busca, filtros por período e paginação;
- geração de identificadores únicos com UUID;
- geração de QR Codes;
- emissão de certificados em PDF;
- persistência local com SQLite.

## Tecnologias

- Node.js
- Express 5
- SQLite
- Express Session
- bcrypt
- pdf-lib
- QRCode
- UUID

## Estrutura principal

```text
.
├── data/
├── fonts/
├── models/
├── public/
├── qrcodes/
├── gerarCertificadoPDF.js
├── importar_alunos.js
├── server.js
└── package.json
```

## Executando localmente

```bash
git clone https://github.com/marcosvitordev/sistema_certificado.git
cd sistema_certificado
npm install
node server.js
```

Depois acesse `http://localhost:3000`.

## Fluxo da aplicação

1. Login do usuário.
2. Acesso ao dashboard.
3. Cadastro de alunos.
4. Geração de identificador e QR Code.
5. Consulta dos registros com busca e paginação.
6. Geração do certificado em PDF.

## Roadmap

- [ ] adicionar testes automatizados;
- [ ] documentar o deploy;
- [ ] melhorar validações de entrada;
- [ ] padronizar configuração por ambiente;
- [ ] definir uma licença para o projeto.

## Autor

**Marcos Vitor** — Analista de Sistemas e Desenvolvedor Full Stack

[GitHub](https://github.com/marcosvitordev) · [Portfólio](https://marcosvitordev.netlify.app/)
