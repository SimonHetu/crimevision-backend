# Crime Vision

## Présentation du Projet

### 1. Genèse de l'idée
L'origine du projet vient du questionnement quelles données sont disponible sur les incidents criminels qui ont lieu autour de nous. Le but étant de permettre au citoyen de pouvoir s'orienter et se préparer pour aller au dedans de ces actes et ne pas simplement les subirs. 


### 2. Les données disponibles
**Document: `data/SOURCE.md` et `data/raw`**
Longitude (Est Ouest) et Latitude (Nord Sud) est le standard pour le système de coordonnées géographique WGS84 (utilisé partout Googlemap, OpenStreetMap, leaflet, GPS). Ce sont les données utilisées par mon application.
0° = Équateur
+90° = Pôle Nord
-90° = Pôle Sud

X et Y sont des valeurs plus précises utilisées pour calculer des distances en mètres de facon plus précises mais ne sont pas utilisées dans l'application pour l'instant.

Projection = transformation mathématique
X / Y = plan 2D
- Calculer des distances précises
- Dessiner des cartes locales

Dans l'application Leaflet recoit Lat/lon applique une projection interne et dessine sur un plan 2D dans le navigateur


### 3. Modelisation de la base de données
**Document: `UML/crimevision-schema.jpg` et `prisma/schema.prisma`**

### 4. Script d'import




## 5.🧱 Stack du Projet

## Basics

### Node.js
Environnement d'éxécution qui permet d'éxécuter du JavaScript côté serveur ou localement, grâce au moteur V8 de Google Chrome.

## 🖥 Backend

### npm
*npm est le gestionnaire de packets livré avec Node.js. Il permet d'installer,gérer et mettre à jour les librairies nécessaires au projet, ainsi que de configurer l'environnement de développement.*

### npx
*npx permet d'exécuter des outils Node sans les intaller globalement, comme prisma, vite, etc. Il est livré avec Node.js*

### TypeScript
*TypeScript est un sur-ensemble de JavaScript qui ajoute un système de types statiques. Son utilisation permet de réduire les erreurs, d'améliorer l'autocomplétion et de rendre le code plus robuste. Les commandes suivantes configurent l'environnement TypeScript pour le backend*

### Express
*Express est un framework minimaliste qui permet de créer un serveur HTTP et de gérer le sroutes les endpoints et les middlewares.*

### CORS
*CORS autorise la communication entre le frontend et le backend en controlant les requêtes provenant d'autres origines*

### Dotenv
*Dotenv charge automatiquement les variables d'environnement définies dans un fichier .env pour qu'elles soient accessibles dnas le code.*

### Prisma
*Prisma est un ORM (Object Relationnal Mapper) qui gère le schéma de la base de données et permet d'effectuer des requêtes PostgreSQL/Neon grâce à un client TypeScript généré automatiquement*

