# Publicar o Certifica CES

O projeto está organizado para este fluxo:

```text
Usuário → Vercel (frontend Next.js) → Render (API Express) → Supabase (PostgreSQL)
```

A Vercel encaminha `/api/*`, PDFs, QR Codes e impressão para o Render. O cookie de sessão pertence ao domínio visitado na Vercel. O navegador não recebe a senha do banco. Usuários, certificados e sessões ficam no PostgreSQL; PDF e QR Code são gerados em memória.

## 1. Enviar o código ao GitHub

O repositório configurado é `marcosvitordev/sistema_certificado`. Envie as alterações deste projeto antes de importar o repositório nos serviços. Inclua `frontend/`, `database/`, `render.yaml`, os scripts e os dois `package-lock.json`.

Os arquivos `.env`, bancos SQLite e dependências são ignorados pelo Git. O modelo `models/certificado_modelo.pdf` e as fontes precisam estar no repositório, pois são usados na geração dos certificados.

## 2. Criar o banco no Supabase

1. Crie uma conta em <https://supabase.com> e um projeto.
2. Guarde a senha do banco em seu gerenciador de senhas.
3. Abra **Connect → Session pooler** e copie a conexão PostgreSQL, porta `5432`. Esse modo aceita conexões IPv4. Copie o host exibido pelo painel; não tente deduzi-lo pelo nome da região.
4. Substitua `[YOUR-PASSWORD]` pela senha do banco. Caracteres especiais na senha devem ser codificados para URL.
5. Em **Database → Settings → SSL**, baixe o certificado raiz se necessário e habilite a exigência de SSL. A aplicação verifica o certificado do servidor; ela não usa `rejectUnauthorized: false`.

Formato ilustrativo, sem credenciais reais:

```dotenv
DATABASE_URL=postgresql://postgres.PROJECT_REF:SENHA_CODIFICADA@HOST_DO_SESSION_POOLER:5432/postgres
```

`DATABASE_CA_CERT` aceita o conteúdo PEM do certificado raiz, com quebras de linha reais no painel ou `\n` em um arquivo `.env`. Configure essa variável se a conexão precisar do certificado baixado. Não adicione caminhos de certificado como `sslrootcert` na URL: esta aplicação usa `DATABASE_CA_CERT` para isso.

As tabelas são criadas automaticamente pelo backend ou pelo migrador. RLS fica habilitado em `usuarios`, `alunos` e `sessions`, sem políticas públicas. A conexão PostgreSQL deve usar o proprietário das tabelas (usuário da conexão fornecida pelo painel). O projeto mantém seu próprio login com bcrypt e não usa Supabase Auth.

Referências: [conexões PostgreSQL do Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres) e [configuração SSL do node-postgres](https://node-postgres.com/features/ssl).

### Levar os dados que já estão no computador

Faça esta etapa **antes de iniciar a API no Render**, com o PostgreSQL vazio. Isso preserva o usuário atual, a senha armazenada, os IDs e os códigos dos certificados. Sessões antigas não são copiadas.

1. Pare o servidor local para evitar novos cadastros durante a cópia.
2. Faça uma cópia de segurança da pasta `data/` com o servidor parado.
3. Na raiz do projeto, crie um arquivo privado `.env.migration`:

```dotenv
DATABASE_URL=CONEXAO_REAL_DO_SUPABASE
DB_PATH=data/sistema_cursos.db
# Se necessário:
# DATABASE_CA_CERT=-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----
```

4. No PowerShell, execute na raiz:

```powershell
npm ci
$env:ENV_FILE = '.env.migration'
npm run migrate:postgres
Remove-Item Env:ENV_FILE
```

O comando lê o SQLite em modo somente leitura. A cópia para PostgreSQL usa uma transação: se houver erro, os registros copiados são desfeitos. Se o destino já tiver usuários ou certificados, o comando recusa a operação. Não apague tabelas para contornar essa mensagem: verifique qual banco deve ser preservado.

Se preferir começar com o banco vazio, pule a migração. O Render criará uma conta usando `ADMIN_USERNAME` e `ADMIN_PASSWORD`.

Os códigos antigos continuam válidos no novo site. PDFs já baixados mantêm o endereço antigo impresso no QR Code: reemita-os com o endereço novo ou mantenha o domínio antigo com redirecionamento. QR Codes antigos apontando para `localhost` precisam ser reemitidos.

## 3. Criar a API no Render

Em <https://render.com>, conecte seu GitHub e use **New → Blueprint**, selecionando este repositório. O arquivo `render.yaml` configura o serviço `certifica-ces-api`.

Também é possível criar um **Web Service** manualmente:

| Campo | Valor |
| --- | --- |
| Language / Runtime | Node |
| Root Directory | deixar vazio (raiz do repositório) |
| Build Command | `npm ci --omit=dev` |
| Start Command | `npm start` |
| Health Check Path | `/healthz` |
| Node | `22` |

Configure estas variáveis no Render:

| Variável | Valor |
| --- | --- |
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `22` |
| `HOST` | `0.0.0.0` |
| `REQUIRE_POSTGRES` | `1` |
| `DATABASE_URL` | conexão privada copiada do Supabase |
| `DATABASE_CA_CERT` | certificado raiz, se necessário |
| `SESSION_SECRET` | segredo aleatório com pelo menos 32 caracteres; o Blueprint gera automaticamente |
| `BASE_URL` | URL pública HTTPS do frontend, como `https://seu-projeto.vercel.app` |
| `ADMIN_USERNAME` | `admin` (somente para banco vazio) |
| `ADMIN_PASSWORD` | senha inicial exclusiva com pelo menos 12 caracteres (somente para banco vazio) |
| `ADMIN_NAME` | `Administrador` |

O Render fornece `PORT`; não é necessário fixá-la. Se ainda não souber a URL final da Vercel, use a URL planejada em `BASE_URL` e corrija-a no passo 5, antes de emitir certificados. Não use `localhost` nessa variável em produção.

Se usar configuração manual, gere `SESSION_SECRET` localmente com:

```powershell
node -p "require('crypto').randomBytes(48).toString('hex')"
```

Copie o resultado para o Render. Mantenha o mesmo segredo entre deploys para preservar as sessões existentes.

As variáveis opcionais `SCHOOL_NAME`, `PROFESSOR_NAME` e `COORDINATOR_NAME` alteram os valores sugeridos para novos certificados.

Após o deploy, abra `https://ENDERECO-REAL.onrender.com/healthz`. A resposta esperada é:

```json
{"status":"ok"}
```

Guarde a URL real do serviço. Ela será usada na Vercel. [Referência: Express no Render](https://render.com/docs/deploy-node-express-app).

O Blueprint seleciona a modalidade gratuita. Serviços gratuitos do Render podem suspender por inatividade, causando demora na primeira chamada; revise as condições atuais se precisar de disponibilidade contínua. [Limitações do plano gratuito](https://render.com/docs/free).

## 4. Criar o frontend na Vercel

1. Em <https://vercel.com>, use **Add New → Project** e importe o mesmo repositório.
2. Selecione **Framework Preset: Next.js**.
3. Configure **Root Directory: `frontend`**.
4. Use Node.js `22.x`, instalação `npm ci` e build `npm run build`. Mantenha o diretório de saída padrão do Next.js.
5. Adicione `API_URL` com a URL HTTPS real do Render, por exemplo `https://certifica-ces-api.onrender.com`, sem barra final.
6. Publique e copie a URL de produção da Vercel.

Somente `API_URL` é necessária na Vercel. `DATABASE_URL`, `ADMIN_PASSWORD` e `SESSION_SECRET` pertencem ao Render. Não crie variáveis `NEXT_PUBLIC_` para esses segredos.

`API_URL` é usada na geração das regras de proxy durante o build. Se alterá-la, faça um novo deploy da Vercel. Evite conectar deploys de Preview ao banco de produção; para testar mudanças com gravação, use outra API e outro banco.

Referências: [Root Directory em monorepos na Vercel](https://vercel.com/docs/monorepos) e [rewrites do Next.js](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites).

## 5. Conectar os endereços e conferir o acesso

1. No Render, ajuste `BASE_URL` para a URL de produção exata da Vercel, sem barra final, e aplique a alteração.
2. Abra `https://SEU-SITE.vercel.app/login`.
3. Se migrou o SQLite, use a conta e a senha atuais do sistema local. Se começou com banco vazio, use `ADMIN_USERNAME` e `ADMIN_PASSWORD` configurados no Render.
4. Troque a senha inicial quando solicitado. Alterar `ADMIN_PASSWORD` depois não redefine uma conta já existente.
5. Cadastre um certificado de teste, baixe o PDF e abra o QR Code pelo celular.
6. Confirme que o QR Code aponta para a Vercel e que a validação funciona sem login.
7. Saia e entre novamente; recarregue o painel para conferir a sessão.

Se adicionar domínio próprio na Vercel, atualize `BASE_URL` no Render antes de emitir novos certificados.

## Executar a nova estrutura localmente

Requisitos: Node.js 22 ou superior. Sem `DATABASE_URL`, o backend continua usando seu SQLite local.

Terminal 1, na raiz:

```powershell
npm ci
npm start
```

Terminal 2, na raiz:

```powershell
npm ci --prefix frontend
Copy-Item frontend/.env.example frontend/.env.local
npm run frontend:dev
```

Abra <http://localhost:3001>. A API continua na porta `3000`. Para testar QR Codes locais no novo frontend, configure `BASE_URL=http://localhost:3001` no `.env` do backend.

## Verificações automatizadas

```powershell
npm run check
npm test
npm run test:postgres
npm run frontend:build
```

Os testes de PostgreSQL usam PGlite, um PostgreSQL local embutido, sem conta externa e sem alterar o banco real. Eles verificam as consultas, a persistência de sessão, o fluxo de certificados, RLS e a migração. Não substituem a verificação da conexão TLS e das credenciais reais no Supabase.

Para verificar o fluxo completo no navegador, com Microsoft Edge instalado:

```powershell
$env:API_URL = 'http://127.0.0.1:3100'
npm run frontend:build
npm run test:e2e
Remove-Item Env:API_URL
```

O teste abre serviços isolados nas portas `3100` e `3101`, usando um SQLite temporário. Em outro ambiente, instale o navegador Playwright e use `PLAYWRIGHT_CHANNEL=chromium`. Depois, execute `npm run frontend:build` novamente sem o endereço de teste para gerar o build local padrão.

## Resolver falhas de publicação

- **API não inicia:** confira `DATABASE_URL`, `BASE_URL` HTTPS e `SESSION_SECRET` nos logs do Render. Com `REQUIRE_POSTGRES=1`, a API recusa iniciar sem PostgreSQL para não gravar dados num SQLite temporário.
- **Erro de certificado SSL:** configure o PEM correto em `DATABASE_CA_CERT`; não desative a verificação TLS.
- **Erro de IPv6/conexão:** use o endereço de Session pooler fornecido em Connect, porta `5432`.
- **Frontend não consegue entrar:** confira `API_URL` na Vercel, refaça o deploy e confirme `/healthz` no Render. O cookie de produção depende de HTTPS.
- **Credenciais incorretas após migrar:** a migração preserva a senha local; a variável `ADMIN_PASSWORD` não altera o usuário migrado.
- **PDF não abre:** confira o modelo em `models/` e as fontes em `fonts/` no repositório.
