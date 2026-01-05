# BACKEND_NOTES – CrimeVision

Ce document résume les principaux concepts backend utilisés dans le projet.

---

## Stack et outils
- **Node.js + Express** : serveur HTTP et définition des endpoints REST.
- **TypeScript (mode strict)** : typage statique, interfaces/DTO, réduction des erreurs à l’exécution.
- **PostgreSQL (Neon)** : base de données relationnelle hébergée (serverless).
- **Prisma ORM** : schéma, migrations, accès typé à la BD (requêtes CRUD).

---

## Architecture (MVC)
- **Routes** : déclarent les routes (`GET/POST/PATCH/DELETE`) et délèguent aux controllers.
- **Controllers** : logique métier, validation des entrées, gestion des réponses et statuts HTTP.
- **Models** : types/structures métier (interfaces, DTO) + cohérence avec le schéma Prisma.
- **Middleware** : logique transversale (auth, erreurs, validation, etc.).

---

## API REST
- Endpoints organisés par ressources (ex. **incidents**, **pdq**, **users**, **auth**).
- Utilisation de **paramètres** (`:id`) et **query params** (`limit`, `timePeriod`, `pdqId`).
- Réponses JSON + statuts HTTP (200, 201, 400, 401, 404, 409, 500).

---

## Authentification et sécurité
- **Hash de mot de passe (bcrypt)** : stockage sécurisé des mots de passe.
- **JWT** : génération de token à la connexion et vérification sur routes protégées.
- **Auth middleware** : lecture du header `Authorization: Bearer <token>` et contrôle d’accès.
- **Variables d’environnement** : `DATABASE_URL`, `JWT_SECRET` via `.env` (non commité).

---

## Gestion d’erreurs
- **Validation** des données d’entrée (champs requis, formats, etc.).
- **Erreurs contrôlées** : invalid ID, not found, conflits (email/pseudo déjà utilisés).
- **Error handler middleware** : centralise les erreurs et évite la duplication de `try/catch`.

---

## Importation de données (scripts)
- Scripts `tsx` pour **importer** les données (PDQ, incidents) dans PostgreSQL.
- Import par lots (ex. `--max=1000/5000/all`) pour performance et contrôle.
- Script de **mise à jour** (incidents récents) pour rafraîchir les données.

---

## Tests
- Tests via fichier `test/request.rest` (extension VS Code REST Client) :
  - scénarios de succès + erreurs (IDs invalides, not found, auth, JWT, etc.).
