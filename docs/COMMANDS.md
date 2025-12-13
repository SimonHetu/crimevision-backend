=====================================================================
# COMMANDES:
=====================================================================

# Génération de la base de donné à partir de schema.prisma
1) Lit le schema.prisma créer le fichier de migration 
et Applique la migration à la base de donnée Neon
2) Génère le client prisma (maintenant optionnel puisque tout est généré avec migrate dans Prisma 7)

**Commande:**
npx prisma migrate dev --name init
npx prisma generate 


=====================================================================
# IMPORT and INSERT
=====================================================================

## Script d'import de donné du CKAN avec Prisma
npx ts-node src/scripts/importCrimes.ts


## Import PDQ data(csv) et/ou insertion des données dans Néon
npx ts-node src/scripts/importPdq.ts
## Tsx nouveau systeme plus rapide sans type check
npx tsx src/scripts/importPdq.ts



=====================================================================
# Neon SQL editor
=====================================================================


## Pour retirer les données de la table PDQ et les incidents reliés
TRUNCATE TABLE "Pdq" RESTART IDENTITY CASCADE;
