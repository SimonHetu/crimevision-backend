
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

## Option A: Recréer complètement la base de données
### En recréant une base de donnée
DATABASE_URL="votre_url_neon_postgresql_ici" (Sur votre compte personnel)
JWT_SECRET="votre_cle_secrete_pour_le_token"

### Migration Prisma
npx prisma migrate dev

### Import des postes de quartier(PDQ):
npx tsx src/scripts/importPdq.ts

### Import des incidents criminels:
npx ts-node src/scripts/importCrimes.ts


## Option B: Utiliser ma base de données existante
### Insérer adresse de projet Neon
DATABASE_URL="votre_url_neon_postgresql_ici" (À envoyer en message privé avant la remise)
JWT_SECRET="votre_cle_secrete_pour_le_token"

### Génération du client Prisma
npx prisma generate



### 6.Lancer le serveur
npm run dev

Si tout fonctionne:
⚡🚔 CrimeVision API running on http://localhost:3000 🚔⚡

### 7. Test:
Le projet inclut un fichier request.rest compatible avec l’extension REST Client de VS Code.


## Version anglaise:


# 🧿 Crime Vision 🧿


CrimeVision is an interactive map app that visualizes Montreal crime data to help users understand patterns, improve awareness and make informed decisions.

## Installation:

### 1. Clone
git clone <your_repository_url>
cd backend

### 2. Install dependencies
npm install

### 3. Create the .env file
DATABASE_URL="your_neon_postgresql_url_here"
JWT_SECRET="your_secret_key_for_token_generation"

### 4. Prisma migration and client generation
npx prisma migrate dev

### 5. Start the server
npm run dev

If everything is working:
⚡🚔 CrimeVision API running on http://localhost:3000 🚔⚡

### 6. Test:
The project includes a request.rest file compatible with the REST Client extension in VS Code.
