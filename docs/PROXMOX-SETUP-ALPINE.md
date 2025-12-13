# Configuració de Proxmox i Reverse Proxy amb Alpine Linux

Aquesta guia explica com configurar el servidor Proxmox amb contenidors LXC per allotjar els projectes dels alumnes, així com la configuració d'un reverse proxy amb **Alpine Linux** per gestionar múltiples projectes amb subdominis.

## Arquitectura del sistema

```
Internet / Xarxa local
        ↓
[Reverse Proxy Alpine - Nginx/Traefik]
        ↓
┌───────────────────────────────────────┐
│     Servidor Proxmox                  │
│                                       │
│  ┌─────────────┐  ┌─────────────┐   │
│  │ LXC Alumne1 │  │ LXC Alumne2 │   │
│  │ 192.168.1.10│  │ 192.168.1.11│   │
│  │             │  │             │   │
│  │ - Backend   │  │ - Backend   │   │
│  │ - Frontend  │  │ - Frontend  │   │
│  │ - PostgreSQL│  │ - PostgreSQL│   │
│  └─────────────┘  └─────────────┘   │
│                                       │
│  ┌─────────────┐  ┌─────────────┐   │
│  │ LXC Alumne3 │  │ LXC Alumne4 │   │
│  │     ...     │  │     ...     │   │
│  └─────────────┘  └─────────────┘   │
└───────────────────────────────────────┘
```

## Part 1: Configuració dels contenidors LXC a Proxmox

> **Nota**: Els contenidors dels alumnes continuen utilitzant Ubuntu/Debian, ja que són més familiars i tenen millor suport per a Java, PostgreSQL i les eines de desenvolupament. Només el reverse proxy utilitzarà Alpine Linux per aprofitar la seva lleugeresa i eficiència.

### Crear un contenidor LXC base

1. **Accedir a Proxmox VE**:
   - Obriu el navegador i aneu a `https://IP_PROXMOX:8006`
   - Inicieu sessió amb les credencials d'administrador

2. **Crear un nou contenidor LXC**:
   - Feu clic a "Create CT" (Crear contenidor)
   - Configuració bàsica:
     - **CT ID**: 100 (per exemple, per al primer alumne)
     - **Hostname**: `alumne1`
     - **Password**: Establiu una contrasenya segura
     - **Template**: Ubuntu 22.04 o Debian 12

3. **Configuració de recursos**:
   - **CPU**: 2 cores
   - **RAM**: 2048 MB
   - **Swap**: 512 MB
   - **Disk**: 10-20 GB
   - **Network**: Pont `vmbr0`, IP estàtica (192.168.1.10/24)

4. **Iniciar el contenidor** i accedir-hi:
   ```bash
   # Des del servidor Proxmox
   pct start 100
   pct enter 100
   ```

### Configurar el contenidor LXC per a desplegaments

Un cop dins del contenidor LXC:

```bash
# Actualitzar el sistema
apt update && apt upgrade -y

# Instal·lar eines necessàries
apt install -y openjdk-17-jdk nginx postgresql sudo wget curl

# Crear directori per a l'aplicació
mkdir -p /opt/app
chown www-data:www-data /opt/app

# Crear usuari per al desplegament
useradd -m -s /bin/bash deploy
usermod -aG sudo deploy

# Configurar sudo sense contrasenya per a l'usuari deploy (opcional, per al desplegament)
echo "deploy ALL=(ALL) NOPASSWD: /bin/systemctl restart backend.service, /bin/systemctl restart nginx" >> /etc/sudoers.d/deploy

# Crear directori .ssh per a l'usuari deploy
mkdir -p /home/deploy/.ssh
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
```

### Configurar el servei del backend

Crear un servei systemd per al backend Spring Boot:

```bash
cat > /etc/systemd/system/backend.service << 'EOF'
[Unit]
Description=Spring Boot Backend Application
After=postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/app
ExecStart=/usr/bin/java -Dspring.profiles.active=prod -jar /opt/app/backend.jar
Restart=always
RestartSec=10

Environment="DB_HOST=localhost"
Environment="DB_PORT=5432"
Environment="DB_NAME=template_db"
Environment="DB_USER=postgres"
Environment="DB_PASSWORD=postgres"

[Install]
WantedBy=multi-user.target
EOF

# Habilitar i iniciar el servei
systemctl daemon-reload
systemctl enable backend.service
```

### Configurar PostgreSQL

```bash
# Canviar a l'usuari postgres
su - postgres

# Crear base de dades i usuari
psql << EOF
CREATE DATABASE template_db;
CREATE USER postgres WITH PASSWORD 'postgres';
GRANT ALL PRIVILEGES ON DATABASE template_db TO postgres;
\q
EOF

exit
```

### Configurar Nginx al contenidor LXC

```bash
cat > /etc/nginx/sites-available/default << 'EOF'
server {
    listen 80 default_server;
    server_name _;

    # Frontend Angular
    root /var/www/html;
    index index.html;

    # Configuració per a Angular (enrutament)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy per al backend
    location /api/ {
        proxy_pass http://localhost:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Reiniciar Nginx
systemctl restart nginx
systemctl enable nginx
```

## Part 2: Configuració del Reverse Proxy amb Alpine Linux

### Crear un contenidor LXC Alpine a Proxmox

1. **Descarregar el template d'Alpine Linux**:
   ```bash
   # Des del servidor Proxmox
   pveam update
   pveam download local alpine-3.19-default_20240207_amd64.tar.xz
   ```

2. **Crear el contenidor LXC Alpine**:
   - Feu clic a "Create CT" (Crear contenidor)
   - Configuració bàsica:
     - **CT ID**: 200 (per exemple)
     - **Hostname**: `reverse-proxy`
     - **Password**: Establiu una contrasenya segura
     - **Template**: Seleccionar el template Alpine descarregat

3. **Configuració de recursos** (Alpine és molt lleuger):
   - **CPU**: 1 core
   - **RAM**: 512 MB (o menys)
   - **Swap**: 256 MB
   - **Disk**: 2-4 GB
   - **Network**: Pont `vmbr0`, IP estàtica (192.168.1.5/24)

4. **Iniciar el contenidor Alpine**:
   ```bash
   pct start 200
   pct enter 200
   ```

### Configuració inicial d'Alpine

```bash
# Actualitzar el sistema
apk update
apk upgrade

# Instal·lar eines bàsiques
apk add nano curl wget bash
```

### Opció A: Nginx com a Reverse Proxy sobre Alpine

#### Instal·lació de Nginx

```bash
# Instal·lar Nginx i curl
apk add nginx curl
```

#### Configuració principal de Nginx

```bash
# Crear directoris necessaris
mkdir -p /etc/nginx/sites-available
mkdir -p /etc/nginx/sites-enabled
mkdir -p /run/nginx

# Editar la configuració principal de Nginx
cat > /etc/nginx/nginx.conf << 'EOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /run/nginx/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Incloure configuracions dels sites
    include /etc/nginx/sites-enabled/*;
}
EOF
```

#### Configuració per a múltiples alumnes

```bash
# Exemple per a l'alumne 1
cat > /etc/nginx/sites-available/alumne1.daw.local << 'EOF'
server {
    listen 80;
    server_name alumne1.daw.local;

    location / {
        proxy_pass http://192.168.1.10:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Habilitar el lloc
ln -s /etc/nginx/sites-available/alumne1.daw.local /etc/nginx/sites-enabled/
```

Repetir per a cada alumne, canviant el subdomini i l'IP:

```bash
# Alumne 2
cat > /etc/nginx/sites-available/alumne2.daw.local << 'EOF'
server {
    listen 80;
    server_name alumne2.daw.local;

    location / {
        proxy_pass http://192.168.1.11:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -s /etc/nginx/sites-available/alumne2.daw.local /etc/nginx/sites-enabled/
```

#### Script per afegir nous alumnes automàticament

```bash
# Crear l'script
cat > /usr/local/bin/add-alumne.sh << 'EOF'
#!/bin/sh

if [ $# -ne 3 ]; then
    echo "Ús: $0 <nom_alumne> <ip_alumne> <domini>"
    echo "Exemple: $0 alumne3 192.168.1.12 daw.local"
    exit 1
fi

ALUMNE=$1
IP=$2
DOMINI=$3
SITE_NAME="${ALUMNE}.${DOMINI}"
SITE_AVAILABLE="/etc/nginx/sites-available/${SITE_NAME}"
SITE_ENABLED="/etc/nginx/sites-enabled/${SITE_NAME}"

# Crear configuració
cat > "${SITE_AVAILABLE}" << EOFNGINX
server {
    listen 80;
    server_name ${SITE_NAME};

    location / {
        proxy_pass http://${IP}:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOFNGINX

# Habilitar el lloc
ln -s "${SITE_AVAILABLE}" "${SITE_ENABLED}"

# Verificar configuració
nginx -t

if [ $? -eq 0 ]; then
    # Recarregar Nginx
    rc-service nginx reload
    echo "Alumne ${ALUMNE} afegit correctament amb IP ${IP}"
else
    echo "Error en la configuració de Nginx"
    rm -f "${SITE_AVAILABLE}" "${SITE_ENABLED}"
    exit 1
fi
EOF

# Fer l'script executable
chmod +x /usr/local/bin/add-alumne.sh
```

**Ús de l'script**:
```bash
/usr/local/bin/add-alumne.sh alumne3 192.168.1.12 daw.local
```

#### Gestió del servei Nginx amb OpenRC

```bash
# Comprovar la configuració
nginx -t

# Iniciar Nginx
rc-service nginx start

# Habilitar Nginx a l'arrencada
rc-update add nginx default

# Altres comandes útils
rc-service nginx stop      # Aturar Nginx
rc-service nginx restart   # Reiniciar Nginx
rc-service nginx reload    # Recarregar configuració
rc-service nginx status    # Estat del servei
```

### Opció B: Traefik com a Reverse Proxy sobre Alpine

#### Instal·lació de Traefik (sense Docker)

```bash
# Descarregar el binari de Traefik
cd /tmp
wget https://github.com/traefik/traefik/releases/download/v3.0.0/traefik_v3.0.0_linux_amd64.tar.gz
tar -xzf traefik_v3.0.0_linux_amd64.tar.gz
mv traefik /usr/local/bin/
chmod +x /usr/local/bin/traefik

# Verificar la instal·lació
traefik version
```

#### Configuració de Traefik

```bash
# Crear directoris de configuració
mkdir -p /etc/traefik/dynamic

# Crear fitxer de configuració principal
cat > /etc/traefik/traefik.yml << 'EOF'
api:
  dashboard: true
  insecure: true

entryPoints:
  web:
    address: ":80"

providers:
  file:
    directory: /etc/traefik/dynamic
    watch: true

log:
  level: INFO
EOF

# Exemple de configuració per a l'alumne 1
cat > /etc/traefik/dynamic/alumne1.yml << 'EOF'
http:
  routers:
    alumne1:
      rule: "Host(`alumne1.daw.local`)"
      service: alumne1-service
      entryPoints:
        - web

  services:
    alumne1-service:
      loadBalancer:
        servers:
          - url: "http://192.168.1.10:80"
EOF

# Exemple per a l'alumne 2
cat > /etc/traefik/dynamic/alumne2.yml << 'EOF'
http:
  routers:
    alumne2:
      rule: "Host(`alumne2.daw.local`)"
      service: alumne2-service
      entryPoints:
        - web

  services:
    alumne2-service:
      loadBalancer:
        servers:
          - url: "http://192.168.1.11:80"
EOF
```

#### Crear servei OpenRC per a Traefik

```bash
cat > /etc/init.d/traefik << 'EOF'
#!/sbin/openrc-run

name="traefik"
description="Traefik reverse proxy"
command="/usr/local/bin/traefik"
command_args="--configFile=/etc/traefik/traefik.yml"
command_background="yes"
pidfile="/run/${RC_SVCNAME}.pid"
output_log="/var/log/traefik.log"
error_log="/var/log/traefik.err"

depend() {
    need net
    after firewall
}
EOF

# Fer l'script executable
chmod +x /etc/init.d/traefik

# Iniciar i habilitar Traefik
rc-service traefik start
rc-update add traefik default
```

#### Gestió del servei Traefik

```bash
# Iniciar Traefik
rc-service traefik start

# Aturar Traefik
rc-service traefik stop

# Reiniciar Traefik
rc-service traefik restart

# Estat del servei
rc-service traefik status

# Veure logs
tail -f /var/log/traefik.log
```

#### Alternativa: Traefik amb Docker a Alpine

Si preferiu utilitzar Docker:

```bash
# Instal·lar Docker a Alpine
apk add docker
rc-update add docker default
rc-service docker start

# Crear directori de configuració
mkdir -p /opt/traefik/dynamic

# Crear fitxer de configuració
cat > /opt/traefik/traefik.yml << 'EOF'
api:
  dashboard: true
  insecure: true

entryPoints:
  web:
    address: ":80"

providers:
  file:
    directory: /etc/traefik/dynamic
    watch: true

log:
  level: INFO
EOF

# Executar Traefik amb Docker
docker run -d \
  -p 80:80 \
  -p 8080:8080 \
  -v /opt/traefik/traefik.yml:/etc/traefik/traefik.yml \
  -v /opt/traefik/dynamic:/etc/traefik/dynamic \
  --name traefik \
  --restart unless-stopped \
  traefik:latest
```

## Part 3: Configuració de DNS / Hosts

### Opció A: Configurar /etc/hosts (per a proves locals)

Al vostre ordinador (client):

**Linux/macOS**:
```bash
sudo nano /etc/hosts
```

**Windows**:
```powershell
# Executar Notepad com a administrador
notepad C:\Windows\System32\drivers\etc\hosts
```

Afegir les entrades:
```
192.168.1.5   alumne1.daw.local
192.168.1.5   alumne2.daw.local
192.168.1.5   alumne3.daw.local
```

On `192.168.1.5` és l'IP del contenidor Alpine amb el reverse proxy.

### Opció B: Configurar dnsmasq a Alpine

```bash
# Instal·lar dnsmasq
apk add dnsmasq

# Configurar dnsmasq
cat > /etc/dnsmasq.conf << 'EOF'
# No llegir /etc/resolv.conf
no-resolv

# Servidor DNS upstream
server=8.8.8.8
server=8.8.4.4

# Domini local
domain=daw.local

# Expandir hosts simples
expand-hosts

# Wildcard per al domini local
address=/daw.local/192.168.1.5

# Fitxer de hosts
addn-hosts=/etc/hosts

# No reenviar noms sense domini
domain-needed

# No reenviar adreces IP privades
bogus-priv

# Cache DNS
cache-size=1000

# Listening interface
listen-address=127.0.0.1
listen-address=192.168.1.5
EOF

# Iniciar i habilitar dnsmasq
rc-service dnsmasq start
rc-update add dnsmasq default
```

## Part 4: SSL/TLS amb Let's Encrypt

### Amb Nginx a Alpine

```bash
# Instal·lar Certbot
apk add certbot certbot-nginx

# Obtenir certificat (exemple per a alumne1)
certbot --nginx -d alumne1.daw.local

# Verificar configuració
nginx -t
rc-service nginx reload
```

### Renovació automàtica amb cron

Alpine utilitza crond, que ve preinstal·lat:

```bash
# Crear script de renovació
cat > /etc/periodic/daily/certbot-renew << 'EOF'
#!/bin/sh
/usr/bin/certbot renew --quiet --post-hook "rc-service nginx reload"
EOF

# Fer l'script executable
chmod +x /etc/periodic/daily/certbot-renew

# Habilitar crond
rc-update add crond default
rc-service crond start
```

### Amb Traefik

Traefik té suport integrat per a Let's Encrypt. Afegir a `/etc/traefik/traefik.yml`:

```yaml
certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@daw.local
      storage: /etc/traefik/acme.json
      httpChallenge:
        entryPoint: web

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"
```

I actualitzar les configuracions dinàmiques:

```yaml
http:
  routers:
    alumne1:
      rule: "Host(`alumne1.daw.local`)"
      service: alumne1-service
      entryPoints:
        - websecure
      tls:
        certResolver: letsencrypt

  services:
    alumne1-service:
      loadBalancer:
        servers:
          - url: "http://192.168.1.10:80"
```

## Verificació de la configuració

### Comprovar que el reverse proxy funciona

```bash
# Des d'un client
curl http://alumne1.daw.local
curl http://alumne1.daw.local/api/health
```

### Monitoritzar logs

**Nginx a Alpine**:
```bash
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

**Traefik a Alpine**:
```bash
tail -f /var/log/traefik.log
```

### Comprovar serveis actius

```bash
# Llistar serveis
rc-status

# Veure serveis habilitats a l'arrencada
rc-update show
```

## Resolució de problemes

### El lloc no és accessible

1. Verificar que el contenidor LXC està en marxa
   ```bash
   pct status 200  # Des de Proxmox
   ```

2. Comprovar que Nginx/Traefik dins d'Alpine està funcionant
   ```bash
   rc-service nginx status
   # o
   rc-service traefik status
   ```

3. Verificar la configuració del reverse proxy
   ```bash
   nginx -t  # Per Nginx
   ```

4. Comprovar la configuració DNS/hosts

5. Verificar connectivitat de xarxa
   ```bash
   ping 192.168.1.10  # Provar ping al contenidor de l'alumne
   ```

### Error 502 Bad Gateway

- El backend dins del LXC de l'alumne no està funcionant
- Comprovar: `systemctl status backend.service` dins del LXC de l'alumne (Ubuntu/Debian)
- Verificar que el port 80 està obert al contenidor de l'alumne

### Error 404 Not Found

- Els fitxers del frontend no estan al directori `/var/www/html/`
- Verificar el desplegament del frontend al contenidor de l'alumne

### Nginx no arrenca

- Verificar que el directori `/run/nginx` existeix:
  ```bash
  mkdir -p /run/nginx
  ```
- Comprovar permisos:
  ```bash
  chown -R nginx:nginx /run/nginx
  ```

### Problemes amb OpenRC

```bash
# Veure els logs del servei
rc-service nginx --debug start

# Llistar tots els serveis
rc-status --all
```

## Manteniment

### Script per afegir nous alumnes

#### Per a Nginx

Utilitzar l'script `/usr/local/bin/add-alumne.sh` creat anteriorment:

```bash
/usr/local/bin/add-alumne.sh alumne4 192.168.1.13 daw.local
```

#### Per a Traefik

```bash
# Crear script per afegir alumnes amb Traefik
cat > /usr/local/bin/add-alumne-traefik.sh << 'EOF'
#!/bin/sh

if [ $# -ne 3 ]; then
    echo "Ús: $0 <nom_alumne> <ip_alumne> <domini>"
    echo "Exemple: $0 alumne3 192.168.1.12 daw.local"
    exit 1
fi

ALUMNE=$1
IP=$2
DOMINI=$3
SITE_NAME="${ALUMNE}.${DOMINI}"
CONFIG_FILE="/etc/traefik/dynamic/${ALUMNE}.yml"

# Crear configuració
cat > "${CONFIG_FILE}" << EOFTRAEFIK
http:
  routers:
    ${ALUMNE}:
      rule: "Host(\`${SITE_NAME}\`)"
      service: ${ALUMNE}-service
      entryPoints:
        - web

  services:
    ${ALUMNE}-service:
      loadBalancer:
        servers:
          - url: "http://${IP}:80"
EOFTRAEFIK

echo "Alumne ${ALUMNE} afegit correctament amb IP ${IP}"
echo "Traefik recarregarà la configuració automàticament"
EOF

chmod +x /usr/local/bin/add-alumne-traefik.sh
```

### Backups de la configuració

```bash
# Backup de configuracions de Nginx
tar -czf /root/backup-nginx-$(date +%Y%m%d).tar.gz /etc/nginx/

# Backup de configuracions de Traefik
tar -czf /root/backup-traefik-$(date +%Y%m%d).tar.gz /etc/traefik/

# Backup des de Proxmox
vzdump 200 --dumpdir /var/lib/vz/dump --compress gzip
```

### Actualització d'Alpine

```bash
# Actualitzar els paquets
apk update
apk upgrade

# Reiniciar el contenidor si cal
reboot
```

### Monitorització

Considerar eines com:

```bash
# Instal·lar htop per monitoritzar recursos
apk add htop

# Instal·lar iftop per monitoritzar xarxa
apk add iftop
```

## Avantatges d'utilitzar Alpine Linux

### 1. **Lleuger**
- Mida base: ~5 MB (comparat amb ~200 MB d'Ubuntu Server)
- Consum mínim de RAM: 128-256 MB suficients per a un reverse proxy
- Ideal per a contenidors i entorns virtualitzats

### 2. **Segur**
- Utilitza `musl libc` en lloc de `glibc`, reduint la superfície d'atac
- BusyBox per a les utilitats bàsiques del sistema
- Menys paquets instal·lats = menys vulnerabilitats potencials
- Actualitzacions de seguretat ràpides

### 3. **Ràpid**
- Arrencada extremadament ràpida (segons)
- Menys procesos en execució
- Rendiment excel·lent en operacions de xarxa

### 4. **Eficient**
- Baix consum de CPU i memòria
- Permet allotjar més contenidors al mateix hardware
- Ideal per a infraestructures amb recursos limitats

### 5. **Simple**
- Sistema d'init OpenRC, més simple que systemd
- Menys complexitat = més fàcil de debugar
- Documentació clara i concisa

## Taula de diferències clau: Ubuntu/Debian vs Alpine

| Característica | Ubuntu/Debian | Alpine Linux |
|----------------|---------------|--------------|
| **Gestor de paquets** | `apt` / `apt-get` | `apk` |
| **Sistema d'init** | systemd | OpenRC |
| **Iniciar servei** | `systemctl start nginx` | `rc-service nginx start` |
| **Aturar servei** | `systemctl stop nginx` | `rc-service nginx stop` |
| **Reiniciar servei** | `systemctl restart nginx` | `rc-service nginx restart` |
| **Habilitar a l'arrencada** | `systemctl enable nginx` | `rc-update add nginx default` |
| **Deshabilitar a l'arrencada** | `systemctl disable nginx` | `rc-update del nginx default` |
| **Estat del servei** | `systemctl status nginx` | `rc-service nginx status` |
| **Veure logs** | `journalctl -u nginx` | `tail -f /var/log/nginx/error.log` |
| **Mida base** | ~200 MB | ~5 MB |
| **Shell per defecte** | bash | ash (BusyBox) |
| **Libreria C** | glibc | musl libc |
| **Temps d'arrencada** | 10-30 segons | 1-5 segons |
| **RAM mínima recomanada** | 512 MB - 1 GB | 128-256 MB |
| **Actualitzar sistema** | `apt update && apt upgrade` | `apk update && apk upgrade` |
| **Instal·lar paquet** | `apt install <paquet>` | `apk add <paquet>` |
| **Cercar paquet** | `apt search <paquet>` | `apk search <paquet>` |
| **Eliminar paquet** | `apt remove <paquet>` | `apk del <paquet>` |

## Referències

- [Alpine Linux Official Website](https://alpinelinux.org/)
- [Alpine Linux Wiki](https://wiki.alpinelinux.org/)
- [Alpine Linux Packages](https://pkgs.alpinelinux.org/)
- [OpenRC Documentation](https://wiki.gentoo.org/wiki/OpenRC)
- [Documentació oficial de Proxmox](https://pve.proxmox.com/pve-docs/)
- [Documentació de Nginx](https://nginx.org/en/docs/)
- [Documentació de Traefik](https://doc.traefik.io/traefik/)
- [Let's Encrypt](https://letsencrypt.org/)
- [Alpine Linux Docker Official Images](https://hub.docker.com/_/alpine)
