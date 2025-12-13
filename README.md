
# 🧿 Crime Vision 🧿


CrimeVision est une application cartographique interactive qui visualise les données criminelles de Montréal afin d’aider les utilisateurs à comprendre les tendances, améliorer leur vigilance et prendre des décisions éclairées.

## Installation:

### 1.Clone
git clone https://github.com/SimonHetu/Crime-Vision.git

cd Crime-Vision/backend

### 2.Installation des dépendances
npm install

### 3.Creation du .env
cp .env.example .env

### Insérer les information .env de votre compte Neon personnel
DATABASE_URL="votre_url_neon_postgresql_ici"
JWT_SECRET="votre_cle_secrete_pour_le_token"

### Migration Prisma
npx prisma migrate dev

### Import des postes de quartier(PDQ):
npx tsx src/scripts/importPdq.ts

### Import des incidents criminels:
npx ts-node src/scripts/importIncidents.ts

### 6.Lancer le serveur
npm run dev

Si tout fonctionne:
⚡🚔 CrimeVision API running on http://localhost:3000 🚔⚡

### 7. Test:
Le projet inclut un fichier request.rest compatible avec l’extension REST Client de VS Code.