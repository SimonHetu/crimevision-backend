
# COMMANDES - CrimeVision

Ce document regroupe les principales commandes utilisées pour le développement, la gestion de la base de données et l’importation des données du backend.

## Génération de la base de données à partir de schema.prisma
1. Lit le fichier `schema.prisma`
2. Crée les fichiers de migration
3. Applique la migration à la base de données PostgreSQL (Neon)
4. Génère le client Prisma (maintenant optionnel, car intégré à `migrate` depuis Prisma 7)

### Commande
npx prisma migrate dev --name init

npx prisma generate 

#### Mise à jour de la base de données
npx prisma migrate dev --name init

---

## Imports et Insertions

### Script d'import de données du CKAN avec Prisma ◀⏪
npx tsx src/scripts/importIncidents.ts --max=1000

### Import PDQ data(csv) et/ou insertion des données dans Néon
npx ts-node src/scripts/importPdq.ts

### Tsx nouveau système plus rapide sans type check
npx tsx src/scripts/importPdq.ts

### Import Recent ⏩▶
npx tsx src/scripts/importLatestIncidents.ts
---

## Neon SQL editor

### Pour retirer les données de la table PDQ et les incidents reliés
TRUNCATE TABLE "Pdq" RESTART IDENTITY CASCADE;
