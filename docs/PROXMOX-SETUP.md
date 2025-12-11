# Configuració de Proxmox i Reverse Proxy

Aquesta guia explica com configurar el servidor Proxmox amb contenidors LXC per allotjar els projectes dels alumnes, així com la configuració d'un reverse proxy per gestionar múltiples projectes amb subdominis.

## Arquitectura del sistema

```
Internet / Xarxa local
        ↓
[Reverse Proxy - Nginx/Traefik]
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

## Part 2: Configuració del Reverse Proxy

### Opció A: Nginx com a Reverse Proxy

#### Instal·lació (al servidor Proxmox o servidor independent)

```bash
apt update
apt install -y nginx
```

#### Configuració per a múltiples alumnes

Crear un fitxer de configuració per a cada alumne:

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

#### Verificar i reiniciar Nginx

```bash
# Comprovar la configuració
nginx -t

# Reiniciar Nginx
systemctl restart nginx
systemctl enable nginx
```

### Opció B: Traefik com a Reverse Proxy

Traefik és una alternativa moderna que ofereix configuració automàtica i millor integració amb contenidors.

#### Instal·lació amb Docker

```bash
# Crear directori de configuració
mkdir -p /opt/traefik
cd /opt/traefik

# Crear fitxer de configuració
cat > traefik.yml << 'EOF'
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

# Crear directori per a configuracions dinàmiques
mkdir -p /opt/traefik/dynamic

# Exemple de configuració per a l'alumne 1
cat > /opt/traefik/dynamic/alumne1.yml << 'EOF'
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
192.168.1.X   alumne1.daw.local
192.168.1.X   alumne2.daw.local
192.168.1.X   alumne3.daw.local
```

On `192.168.1.X` és l'IP del servidor amb el reverse proxy.

### Opció B: Configurar un servidor DNS local

Si teniu un servidor DNS local (com dnsmasq o bind9), podeu configurar un wildcard DNS:

```bash
# Exemple amb dnsmasq
echo "address=/daw.local/192.168.1.X" >> /etc/dnsmasq.conf
systemctl restart dnsmasq
```

## Part 4: SSL/TLS amb Let's Encrypt (Opcional)

### Amb Nginx

```bash
# Instal·lar Certbot
apt install -y certbot python3-certbot-nginx

# Obtenir certificat (exemple per a alumne1)
certbot --nginx -d alumne1.daw.local

# Renovació automàtica
systemctl enable certbot.timer
```

### Amb Traefik

Traefik té suport integrat per a Let's Encrypt. Només cal afegir a `traefik.yml`:

```yaml
certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@daw.local
      storage: /etc/traefik/acme.json
      httpChallenge:
        entryPoint: web
```

## Verificació de la configuració

### Comprovar que el reverse proxy funciona

```bash
# Des d'un client
curl http://alumne1.daw.local
curl http://alumne1.daw.local/api/health
```

### Monitoritzar logs

**Nginx**:
```bash
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

**Traefik**:
```bash
docker logs -f traefik
```

## Resolució de problemes

### El lloc no és accessible

1. Verificar que el contenidor LXC està en marxa
2. Comprovar que Nginx dins del LXC està funcionant
3. Verificar la configuració del reverse proxy
4. Comprovar la configuració DNS/hosts

### Error 502 Bad Gateway

- El backend dins del LXC no està funcionant
- Comprovar: `systemctl status backend.service` dins del LXC

### Error 404 Not Found

- Els fitxers del frontend no estan al directori `/var/www/html/`
- Verificar el desplegament del frontend

## Manteniment

### Crear nous contenidors per a nous alumnes

1. Clonar un contenidor existent a Proxmox (opció ràpida)
2. O crear-ne un de nou seguint els passos anteriors
3. Afegir la configuració al reverse proxy
4. Actualitzar el DNS/hosts

### Backups

```bash
# Backup d'un contenidor LXC des de Proxmox
vzdump 100 --dumpdir /var/lib/vz/dump --compress gzip
```

### Monitorització

Considerar eines com:
- Prometheus + Grafana per a mètriques
- Netdata per a monitorització en temps real
- Uptime Kuma per a verificació de disponibilitat

## Referències

- [Documentació oficial de Proxmox](https://pve.proxmox.com/pve-docs/)
- [Documentació de Nginx](https://nginx.org/en/docs/)
- [Documentació de Traefik](https://doc.traefik.io/traefik/)
- [Let's Encrypt](https://letsencrypt.org/)
