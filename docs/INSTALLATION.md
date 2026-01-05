=====================================================================
# Guide d'installation pour le Projet
=====================================================================
## 🧱 Basics

### Node.js
*Node.js est un environnement d'éxécution qui permet d'éxécuter du JavaScript côté serveur ou localement, grâce au moteur V8 de Google Chrome*
https://nodejs.org/


=====================================================================
## 🖥 Backend

### npm
*npm est le gestionnaire de packets livré avec Node.js. Il permet d'installer,gérer et mettre à jour les librairies nécessaires au projet, ainsi que de configurer l'environnement de développement.*

### npx
*npx permet d'exécuter des outils Node sans les intaller globalement, comme prisma, vite, etc. Il est livré avec Node.js*

Command:
npm init -y

### TypeScript
*TypeScript est un sur-ensemble de JavaScript qui ajoute un système de types statiques. Son utilisation permet de réduire les erreurs, d'améliorer l'autocomplétion et de rendre le code plus robuste. Les commandes suivantes configurent l'environnement TypeScript pour le backend*

Lexique:
*typescript*: Installe TS localement pour compiler les fichiers .ts en JavaScript
*ts-node-dev*: Outil de développement permettant le redémarrage automatique du serveur à chaque modification (équivalent de nodemon pour TypeScript).
*npx tsc --init*: Génère le fichier tsconfig.json qui contient la configuration du compilateur TypeScript pour le projet
*--save-dev*: Installation pour le developpement seulement pas en production

Command:
npm install typescript --save-dev
npm install ts-node-dev --save-dev
npx tsc --init


### Express
*Express est un framework minimaliste qui permet de créer un serveur HTTP et de gérer le sroutes les endpoints et les middlewares.*

Command:
npm install express
npm install @types/express --save-dev


### CORS
*CORS autorise la communication entre le frontend et le backend en controlant les requêtes provenant d'autres origines*

Command:
npm install cors
npm install @types/cors --save-dev

### Dotenv
*Dotenv charge automatiquement les variables d'environnement définies dans un fichier .env pour qu'elles soient accessibles dnas le code.*

Command:
npm install dotenv


### Prisma
*Prisma est un ORM (Object Relationnal Mapper) qui gère le schéma de la base de données et permet d'effectuer des requêtes PostgreSQL/Neon grâce à un client TypeScript généré automatiquement*

Command:
npm install prisma --save-dev
npm install @prisma/client

Ensuite on initialise:
Command:
npx prisma init

*ce qui créer le dossier prisma avec le fichier schema.prisma et le fichier .env contenant le DATABASE_URL=...*

*On ajoute cette section au schema.prisma:*
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}



**Commande Complète d'Installation du Backend**:
npm init -y
npm install typescript --save-dev
npm install ts-node-dev --save-dev
npx tsc --init
npm install express
npm install @types/express --save-dev
npm install cors
npm install @types/cors --save-dev
npm install dotenv
npm install prisma --save-dev
npm install @prisma/client
npm install -D tsx
----------------------------------------
npx prisma init
npx prisma migrate dev --name init
npx prisma generate
----------------------------------------

# Prisma Neon adapter
npm install @prisma/adapter-neon

# Neon serverless driver
npm install @neondatabase/serverless

# Bcrypt
npm install bcrypt
npm install --save-dev @types/bcrypt

# JSON web token
npm install jsonwebtoken
npm install --save-dev @types/jsonwebtoken


=====================================================================
## 🌐 Frontend

### npm
*npm est le gestionnaire de packets livré avec Node.js. Il permet d'installer,gérer et mettre à jour les librairies nécessaires au projet, ainsi que de configurer l'environnement de développement.*

### npx
*npx permet d'exécuter des outils Node sans les intaller globalement, comme prisma, vite, etc. Il est livré avec Node.js*

Command:
npm init -y

## 🗄 Database


=====================================================================
# Déinstallation des dépendances du projet
=====================================================================
git status;
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue;
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue;
if (Test-Path ".\backend") {
  Remove-Item -Recurse -Force .\backend\node_modules -ErrorAction SilentlyContinue;
  Remove-Item -Force .\backend\package-lock.json -ErrorAction SilentlyContinue;
}
$buildFolders = @("dist","build",".next",".turbo",".vite",".cache","coverage","out");
foreach ($f in $buildFolders) {
  if (Test-Path ".\$f") { Remove-Item -Recurse -Force ".\$f" }
  if (Test-Path ".\backend\$f") { Remove-Item -Recurse -Force ".\backend\$f" }
}
if (Test-Path ".\generated") {
  Remove-Item -Recurse -Force .\generated
}
npm cache clean --force