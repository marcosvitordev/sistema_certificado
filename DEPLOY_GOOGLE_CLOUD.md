# Publicação no Google Cloud Compute Engine

Este guia publica o sistema em uma VM Ubuntu 24.04 LTS com Node.js, `systemd`, Nginx e HTTPS. O Node fica acessível somente em `127.0.0.1:3000`; a internet acessa apenas as portas 80 e 443 pelo Nginx.

Substitua nos comandos:

- `certificados.seudominio.com.br` pelo seu domínio;
- a URL do repositório pela URL real;
- os valores de usuário, instituição e responsáveis pelos valores desejados.

## 1. Criar a VM

No Console do Google Cloud:

1. Abra **Compute Engine > Instâncias de VM > Criar instância**.
2. Use uma região próxima dos usuários. Para uma instalação pequena, `e2-small` (2 GB de RAM) é um ponto de partida seguro.
3. Em **SO e armazenamento**, selecione **Ubuntu 24.04 LTS** e disco de 20 GB.
4. Em **Firewall**, marque **Permitir tráfego HTTP** e **Permitir tráfego HTTPS**.
5. Crie a VM e reserve o IP externo como **estático** em **VPC > Endereços IP**.
6. No provedor do domínio, crie um registro `A` de `certificados.seudominio.com.br` apontando para o IP estático.

Não crie regra pública para a porta 3000. Para reduzir exposição, restrinja o SSH ao seu IP ou use IAP/OS Login quando possível.

Referências oficiais: [criar uma VM Linux](https://cloud.google.com/compute/docs/create-linux-vm-instance), [reservar IP externo estático](https://cloud.google.com/compute/docs/ip-addresses/configure-static-external-ip-address) e [acessar por SSH](https://cloud.google.com/compute/docs/connect/standard-ssh).

## 2. Acessar e preparar o Ubuntu

Na lista de VMs, clique em **SSH**. Depois execute:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y git nginx sqlite3 curl ca-certificates certbot python3-certbot-nginx
```

Instale uma versão LTS do Node.js igual ou superior a 20. Este exemplo usa Node.js 24:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node --version
npm --version
```

Crie um usuário de serviço sem acesso interativo:

```bash
sudo useradd --system --create-home --home-dir /var/lib/certifica --shell /usr/sbin/nologin certifica
```

## 3. Enviar o projeto

Com repositório Git:

```bash
sudo git clone URL_DO_REPOSITORIO /opt/certifica-ces
sudo chown -R certifica:certifica /opt/certifica-ces
cd /opt/certifica-ces
sudo -u certifica npm ci --omit=dev
sudo -u certifica mkdir -p data qrcodes
```

Se o repositório for privado, use uma chave de deploy somente leitura ou envie a pasta pelo `gcloud compute scp`. Não coloque token de acesso dentro da URL salva no servidor.

## 4. Configurar as variáveis

Crie um segredo aleatório:

```bash
openssl rand -hex 32
```

Crie o arquivo protegido:

```bash
sudo install -m 640 -o root -g certifica /opt/certifica-ces/.env.example /etc/certifica-ces.env
sudo nano /etc/certifica-ces.env
```

Use este conteúdo, alterando os valores:

```dotenv
NODE_ENV=production
PORT=3000
BASE_URL=https://certificados.seudominio.com.br
SESSION_SECRET=COLE_AQUI_O_SEGREDO_GERADO
ADMIN_NAME=Administrador
ADMIN_USERNAME=admin
ADMIN_PASSWORD=UMA_SENHA_INICIAL_FORTE_COM_12_OU_MAIS_CARACTERES
SCHOOL_NAME=Centro de Estudo Sena - CES
PROFESSOR_NAME=NOME DO PROFESSOR
COORDINATOR_NAME=NOME DO COORDENADOR
```

`ADMIN_PASSWORD` só é usada se o banco ainda não tiver usuário. No primeiro login, o sistema exige que essa senha seja trocada.

## 5. Migrar os dados existentes (opcional)

Em uma instalação nova, pule esta etapa. Para levar o banco atual, pare o sistema de origem antes de copiar e envie:

- `data/sistema_cursos.db` (e os arquivos `-wal`/`-shm`, caso existam);
- a pasta `qrcodes/`.

Na VM, coloque tudo em `/opt/certifica-ces/data` e `/opt/certifica-ces/qrcodes`, então corrija as permissões:

```bash
sudo chown -R certifica:certifica /opt/certifica-ces/data /opt/certifica-ces/qrcodes
sudo chmod 750 /opt/certifica-ces/data /opt/certifica-ces/qrcodes
```

O sistema aplica automaticamente as novas colunas sem apagar os registros existentes.

## 6. Ativar o serviço

```bash
sudo cp /opt/certifica-ces/deploy/certifica-ces.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now certifica-ces
sudo systemctl status certifica-ces --no-pager
curl http://127.0.0.1:3000/healthz
```

O último comando deve retornar `{"status":"ok"}`. Para ver erros:

```bash
sudo journalctl -u certifica-ces -n 100 --no-pager
```

## 7. Configurar Nginx e HTTPS

Copie o modelo, edite o domínio e valide:

```bash
sudo cp /opt/certifica-ces/deploy/nginx.conf /etc/nginx/sites-available/certifica-ces
sudo nano /etc/nginx/sites-available/certifica-ces
sudo ln -s /etc/nginx/sites-available/certifica-ces /etc/nginx/sites-enabled/certifica-ces
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Quando o DNS já estiver apontando para o IP da VM, emita o certificado:

```bash
sudo certbot --nginx -d certificados.seudominio.com.br
sudo certbot renew --dry-run
```

O plugin do Certbot ajusta o bloco Nginx e habilita HTTPS. Consulte também as [instruções oficiais do Certbot para Nginx](https://certbot.eff.org/instructions?ws=nginx&os=snap) e a [documentação de TLS do Ubuntu](https://ubuntu.com/server/docs/how-to/security/obtain-tls-certificates/).

Abra `https://certificados.seudominio.com.br`, entre com a conta inicial e troque a senha.

## 8. Backup diário

O script cria um backup consistente do SQLite e dos QR Codes, mantendo 14 dias:

```bash
sudo install -m 750 /opt/certifica-ces/deploy/backup-certifica.sh /usr/local/sbin/backup-certifica
sudo /usr/local/sbin/backup-certifica
sudo crontab -e
```

Adicione ao `crontab`:

```cron
15 2 * * * /usr/local/sbin/backup-certifica >> /var/log/backup-certifica.log 2>&1
```

Copie periodicamente `/var/backups/certifica-ces` para outro local (por exemplo, um bucket privado). Um backup mantido somente na mesma VM não protege contra perda do disco ou da conta.

## 9. Atualizações

Antes de atualizar, faça backup. Depois:

```bash
cd /opt/certifica-ces
sudo /usr/local/sbin/backup-certifica
sudo -u certifica git pull --ff-only
sudo -u certifica npm ci
sudo -u certifica npm test
sudo -u certifica npm prune --omit=dev
sudo systemctl restart certifica-ces
curl http://127.0.0.1:3000/healthz
```

Se a saúde falhar, veja `sudo journalctl -u certifica-ces -n 100 --no-pager` antes de liberar a atualização.

## Checklist final

- DNS aponta para o IP estático;
- somente 80/443 estão públicos para o site; porta 3000 não está exposta;
- HTTPS válido e `certbot renew --dry-run` aprovado;
- senha inicial foi trocada;
- `/healthz` retorna `ok`;
- backup foi executado e restaurado em um teste;
- arquivos `/etc/certifica-ces.env`, `data/` e `qrcodes/` não estão no Git.
