
# 🧿 Crime Vision 🧿


CrimeVision est une application cartographique interactive qui visualise les données criminelles de Montréal afin d’aider les utilisateurs à comprendre les tendances, améliorer leur vigilance et prendre des décisions éclairées.

## Installation:

### 1.Clone
git clone https://github.com/SimonHetu/CrimeVision-Backend.git

cd crimevision-backend

### 2.Installation des dépendances
npm install

### 3.Création du .env
cp .env.example .env

### 4.Insérer les information du fichier .env de votre compte Neon personnel
DATABASE_URL="votre_url_neon_postgresql_ici"
JWT_SECRET="votre_cle_secrete_pour_le_token"

### 5.Migration Prisma
npx prisma migrate dev

### 6.Import des postes de quartier(PDQ):
npx tsx src/scripts/importPdq.ts

### 7.Import des incidents criminels:
#### import rapide ~2-3 minutes
npx tsx src/scripts/importIncidents.ts --max=1000
#### import ~15 minutes
npx tsx src/scripts/importIncidents.ts --max=5000
#### import ~15h (335 000 entrées)
npx tsx src/scripts/importIncidents.ts --max=all

npx tsx src/scripts/importIncidents.ts --help


### 8.Mise à jour des incidents criminels:
npx tsx src/scripts/importLatestIncidents.ts

### 9.Lancer le serveur
npm run dev

Si tout fonctionne:
⚡🧿🚔 CrimeVision API running on http://localhost:3000 🚔🧿⚡

### 10. Test:
Le projet inclut un fichier tests/resquest.rest compatible avec l’extension REST Client de VS Code.

### Diagramme UML (Modélisation des données)

- crimevision-backend/crimevision-schema.jpg
- docs/UML/crimevision-schema.jpg

#### Les liens de ressources utilisées
crimevision-backend/data/SOURCES.md

#### Architecture MVC

Le projet utilise une architecture MVC :
- Routes : définition des endpoints API
- Controllers : logique métier et validation
- Models : définitions des entités et types
- Prisma : accès à la base de données Neon
