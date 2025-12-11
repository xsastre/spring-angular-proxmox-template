# Configuració de Secrets de GitHub

Aquesta guia explica com configurar els secrets necessaris per al desplegament automàtic del projecte al contenidor LXC de Proxmox.

## Què són els GitHub Secrets?

Els secrets de GitHub són variables encriptades que permeten emmagatzemar informació sensible (com contrasenyes, claus SSH, tokens API, etc.) de forma segura al vostre repositori. Aquests secrets es poden utilitzar als workflows de GitHub Actions sense exposar-los al codi font.

## Secrets necessaris

Per al desplegament automàtic, necessiteu configurar els següents secrets:

### 1. `LXC_IP`
- **Descripció**: Adreça IP del contenidor LXC de Proxmox
- **Exemple**: `192.168.1.100`
- **Com obtenir-lo**: Consulteu amb el vostre professor o administrador del sistema

### 2. `SSH_USER`
- **Descripció**: Nom d'usuari SSH per connectar-se al contenidor LXC
- **Exemple**: `deploy` o `alumne1`
- **Com obtenir-lo**: El vostre professor us proporcionarà aquest usuari

### 3. `SSH_KEY`
- **Descripció**: Clau privada SSH per autenticació sense contrasenya
- **Format**: Clau RSA privada completa (incloent-hi `-----BEGIN OPENSSH PRIVATE KEY-----` i `-----END OPENSSH PRIVATE KEY-----`)

## Com generar claus SSH

### En Linux/macOS:

```bash
# Generar una nova parella de claus SSH
ssh-keygen -t rsa -b 4096 -C "el-teu-email@example.com" -f ~/.ssh/id_rsa_lxc

# Mostrar la clau pública (per afegir al servidor)
cat ~/.ssh/id_rsa_lxc.pub

# Mostrar la clau privada (per afegir com a secret)
cat ~/.ssh/id_rsa_lxc
```

### En Windows (PowerShell):

```powershell
# Generar una nova parella de claus SSH
ssh-keygen -t rsa -b 4096 -C "el-teu-email@example.com" -f $env:USERPROFILE\.ssh\id_rsa_lxc

# Mostrar la clau pública
Get-Content $env:USERPROFILE\.ssh\id_rsa_lxc.pub

# Mostrar la clau privada
Get-Content $env:USERPROFILE\.ssh\id_rsa_lxc
```

## Com afegir la clau pública al contenidor LXC

Un cop generada la parella de claus, heu d'afegir la **clau pública** al fitxer `~/.ssh/authorized_keys` del contenidor LXC:

```bash
# Connectar-se al contenidor LXC
ssh usuari@IP_DEL_CONTENIDOR

# Crear el directori .ssh si no existeix
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Afegir la clau pública
echo "AQUI_VA_LA_CLAU_PUBLICA" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

**Important**: Substituïu `AQUI_VA_LA_CLAU_PUBLICA` pel contingut complet de la vostra clau pública (`id_rsa_lxc.pub`).

## Com configurar els secrets al repositori de GitHub

### Pas 1: Accedir a la configuració de secrets

1. Aneu al vostre repositori a GitHub
2. Feu clic a **Settings** (Configuració)
3. Al menú lateral esquerre, aneu a **Secrets and variables** → **Actions**
4. Feu clic al botó **New repository secret**

### Pas 2: Crear cada secret

Per a cada un dels tres secrets (`LXC_IP`, `SSH_USER`, `SSH_KEY`):

1. **Name**: Introduïu el nom del secret (exactament com es mostra)
2. **Secret**: Enganxeu el valor corresponent
3. Feu clic a **Add secret**

### Exemple visual (text):

```
┌─────────────────────────────────────────┐
│  New secret                             │
├─────────────────────────────────────────┤
│  Name *                                 │
│  ┌───────────────────────────────────┐ │
│  │ LXC_IP                            │ │
│  └───────────────────────────────────┘ │
│                                         │
│  Secret *                               │
│  ┌───────────────────────────────────┐ │
│  │ 192.168.1.100                     │ │
│  └───────────────────────────────────┘ │
│                                         │
│  [ Add secret ]                         │
└─────────────────────────────────────────┘
```

### Pas 3: Verificar els secrets

Un cop afegits els tres secrets, haurien d'aparèixer a la llista de secrets del repositori (no podreu veure els valors, només els noms):

- ✓ LXC_IP
- ✓ SSH_KEY
- ✓ SSH_USER

## Consideracions de seguretat

- **Mai compartiu la clau privada** (`SSH_KEY`) amb ningú
- **No publiqueu mai** la clau privada al codi font o en missatges de commit
- Si la clau privada es veu compromesa, genereu-ne una de nova immediatament
- Utilitzeu claus SSH diferents per a cada projecte o servei
- Manteniu actualitzat el sistema operatiu del contenidor LXC

## Verificació del desplegament

Un cop configurats els secrets, el workflow de GitHub Actions s'executarà automàticament quan feu push a la branca `main`. Podeu seguir l'execució a:

1. Aneu a la pestanya **Actions** del vostre repositori
2. Seleccioneu l'execució més recent del workflow "Build, Test i Deploy"
3. Reviseu els logs per verificar que el desplegament s'ha completat correctament

## Resolució de problemes

### Error: "Permission denied (publickey)"

**Causa**: La clau SSH no està ben configurada o no coincideix amb la del servidor.

**Solució**:
1. Verifiqueu que la clau pública està al fitxer `~/.ssh/authorized_keys` del contenidor LXC
2. Comproveu que el secret `SSH_KEY` conté la clau privada completa
3. Assegureu-vos que els permisos del fitxer `authorized_keys` són 600

### Error: "Host key verification failed"

**Causa**: La clau del host no està a la llista de hosts coneguts.

**Solució**: El workflow ja inclou `ssh-keyscan` per afegir automàticament l'host. Si persisteix, contacteu amb el professor.

### El desplegament no s'executa

**Causa**: El workflow només s'executa en push a la branca `main`.

**Solució**: Assegureu-vos que esteu fent push a `main` i no a una altra branca.

## Suport addicional

Si teniu problemes configurant els secrets o el desplegament:

1. Reviseu els logs del workflow a la pestanya Actions
2. Consulteu la documentació oficial de GitHub Actions
3. Contacteu amb el vostre professor o tutor

## Referències

- [Documentació oficial de GitHub Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Guia d'SSH de GitHub](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)
