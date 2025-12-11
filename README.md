# Template DAW: Spring Boot + Angular + Proxmox

[![Build, Test i Deploy](https://github.com/xsastre/spring-angular-proxmox-template/actions/workflows/deploy.yml/badge.svg)](https://github.com/xsastre/spring-angular-proxmox-template/actions/workflows/deploy.yml)

Plantilla completa per a projectes de Desenvolupament d'Aplicacions Web (DAW) amb Spring Boot (backend) i Angular (frontend), preparada per al desplegament automàtic a contenidors LXC de Proxmox mitjançant GitHub Actions.

## 📋 Descripció

Aquest projecte proporciona una base sòlida per començar projectes DAW amb una arquitectura moderna i professional:

- **Backend**: API REST amb Spring Boot 3.x i Java 17
- **Frontend**: Aplicació web amb Angular 17+
- **Base de dades**: H2 (desenvolupament) / PostgreSQL (producció)
- **Desplegament**: Automàtic amb GitHub Actions a contenidors LXC
- **Contenidors**: Suport per Docker Compose per a desenvolupament local

## 🚀 Característiques principals

✅ Projecte Spring Boot configurat amb Maven Wrapper  
✅ API REST amb endpoints d'exemple i verificació de salut  
✅ Aplicació Angular amb servei per consumir l'API  
✅ Configuració per perfils (desenvolupament i producció)  
✅ Dockerfiles multi-stage per a optimització  
✅ Docker Compose per a execució local completa  
✅ GitHub Actions per a CI/CD automàtic  
✅ Documentació completa en català  

## 📁 Estructura del projecte

```
spring-angular-proxmox-template/
├── backend/                    # Projecte Spring Boot
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/cat/daw/template/
│   │   │   │   ├── TemplateApplication.java
│   │   │   │   └── controller/
│   │   │   │       └── HelloController.java
│   │   │   └── resources/
│   │   │       ├── application.yml
│   │   │       ├── application-dev.yml
│   │   │       └── application-prod.yml
│   │   └── test/
│   ├── pom.xml
│   ├── mvnw
│   ├── mvnw.cmd
│   └── Dockerfile
│
├── frontend/                   # Projecte Angular
│   ├── src/
│   │   ├── app/
│   │   │   ├── app.component.ts
│   │   │   ├── app.component.html
│   │   │   ├── app.component.css
│   │   │   └── services/
│   │   │       └── api.service.ts
│   │   ├── environments/
│   │   │   ├── environment.ts
│   │   │   └── environment.prod.ts
│   │   ├── index.html
│   │   ├── main.ts
│   │   └── styles.css
│   ├── package.json
│   ├── angular.json
│   ├── tsconfig.json
│   ├── nginx.conf
│   └── Dockerfile
│
├── .github/
│   └── workflows/
│       └── deploy.yml          # Workflow de CI/CD
│
├── docs/
│   ├── CONFIGURACIO-SECRETS.md # Guia de configuració de secrets
│   └── PROXMOX-SETUP.md        # Guia de configuració de Proxmox
│
├── docker-compose.yml          # Configuració Docker Compose
├── .gitignore
├── .editorconfig
└── README.md
```

## 🛠️ Requisits previs

### Per a desenvolupament local:

- **Java 17** o superior
- **Node.js 20** o superior
- **Docker** i **Docker Compose** (opcional, per a execució amb contenidors)
- **Git**

### Per al desplegament automàtic:

- Compte de GitHub
- Contenidor LXC a Proxmox configurat (consulteu [docs/PROXMOX-SETUP.md](docs/PROXMOX-SETUP.md))
- Secrets configurats al repositori de GitHub (consulteu [docs/CONFIGURACIO-SECRETS.md](docs/CONFIGURACIO-SECRETS.md))

## 🎯 Com utilitzar aquesta plantilla

### 1. Crear el vostre projecte

Feu clic al botó **"Use this template"** a GitHub o feu un fork del repositori:

```bash
# Clonar el repositori
git clone https://github.com/EL_VOSTRE_USUARI/spring-angular-proxmox-template.git
cd spring-angular-proxmox-template

# Canviar l'origen remot si heu fet fork
git remote set-url origin https://github.com/EL_VOSTRE_USUARI/el-vostre-projecte.git
```

### 2. Configurar els secrets de GitHub

Seguiu la guia detallada a [docs/CONFIGURACIO-SECRETS.md](docs/CONFIGURACIO-SECRETS.md) per configurar:

- `LXC_IP`: IP del contenidor LXC
- `SSH_USER`: Usuari SSH per al desplegament
- `SSH_KEY`: Clau privada SSH per a l'autenticació

### 3. Executar localment amb Docker Compose

La forma més ràpida de provar el projecte complet:

```bash
# Iniciar tots els serveis (backend, frontend i base de dades)
docker-compose up --build

# Accedir a l'aplicació:
# - Frontend: http://localhost
# - Backend API: http://localhost:8080/api
# - H2 Console: http://localhost:8080/h2-console (en mode dev)
```

### 4. Executar localment sense Docker

#### Backend:

```bash
cd backend

# Executar amb Maven Wrapper (Linux/macOS)
./mvnw spring-boot:run

# Executar amb Maven Wrapper (Windows)
mvnw.cmd spring-boot:run

# L'API estarà disponible a http://localhost:8080
```

#### Frontend:

```bash
cd frontend

# Instal·lar dependències
npm install

# Executar en mode desenvolupament
npm start

# L'aplicació estarà disponible a http://localhost:4200
```

### 5. Desplegar automàticament

Un cop configurats els secrets, el desplegament és automàtic:

1. Feu canvis al vostre codi
2. Feu commit i push a la branca `main`:
   ```bash
   git add .
   git commit -m "Descripció dels canvis"
   git push origin main
   ```
3. GitHub Actions compilarà, testarà i desplegarà automàticament el projecte al contenidor LXC

Podeu seguir l'estat del desplegament a la pestanya **Actions** del vostre repositori.

## 🧪 Testejar el projecte

### Backend:

```bash
cd backend
./mvnw test
```

### Frontend:

```bash
cd frontend
npm test
```

## 📚 Documentació addicional

- **[Configuració de Secrets](docs/CONFIGURACIO-SECRETS.md)**: Guia pas a pas per configurar els secrets de GitHub necessaris per al desplegament
- **[Configuració de Proxmox](docs/PROXMOX-SETUP.md)**: Guia completa per configurar els contenidors LXC i el reverse proxy a Proxmox

## 🔧 Endpoints de l'API

El backend exposa els següents endpoints:

- `GET /api/hello`: Missatge de benvinguda
- `GET /api/health`: Verificació de l'estat del servei

Exemple de petició:

```bash
curl http://localhost:8080/api/health
```

Resposta:

```json
{
  "status": "UP",
  "service": "Template DAW Backend",
  "timestamp": 1702345678901
}
```

## 🐳 Comandes útils de Docker

```bash
# Construir i iniciar tots els serveis
docker-compose up --build

# Executar en segon pla
docker-compose up -d

# Veure els logs
docker-compose logs -f

# Aturar els serveis
docker-compose down

# Eliminar també els volums (dades de la base de dades)
docker-compose down -v
```

## 🤝 Contribuir

Si trobeu algun error o teniu suggeriments de millora:

1. Feu un fork del projecte
2. Creeu una branca per a la vostra característica (`git checkout -b feature/nova-caracteristica`)
3. Feu commit dels vostres canvis (`git commit -m 'Afegir nova característica'`)
4. Feu push a la branca (`git push origin feature/nova-caracteristica`)
5. Obriu una Pull Request

## 📝 Llicència

Aquest projecte és de domini públic i pot ser utilitzat lliurement per a fins educatius.

## 👨‍🏫 Suport

Per a preguntes o problemes:

- Reviseu la documentació a la carpeta `docs/`
- Consulteu amb el vostre professor o tutor
- Obriu un issue a GitHub

## 🔗 Recursos addicionals

- [Documentació de Spring Boot](https://spring.io/projects/spring-boot)
- [Documentació d'Angular](https://angular.io/docs)
- [Documentació de Docker](https://docs.docker.com/)
- [Documentació de GitHub Actions](https://docs.github.com/en/actions)
- [Documentació de Proxmox](https://pve.proxmox.com/pve-docs/)

---

Desenvolupat amb ❤️ per a l'assignatura de DAW
