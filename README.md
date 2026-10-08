# GMAO — engins, véhicules et équipements

Application de gestion de maintenance assistée par ordinateur pour des sociétés qui exploitent des engins de chantier, des camions, des chariots élévateurs, des groupes électrogènes et d'autres équipements mobiles. Le périmètre et les règles viennent du cahier des charges (`docs/cahier-des-charges.md`) ; la couverture exigence par exigence est suivie dans `docs/tracabilite.md`.

Ce dépôt contient le **squelette complet du MVP** : modèle de données, règles métier centrales testées, API REST v1 et écrans web de tous les modules du lot MVP. Les écarts au MVP et les phases suivantes sont listés plus bas.

## Ce que fait le MVP

| Module | Contenu |
| --- | --- |
| Organisation et habilitations | Groupe → sociétés → sites, ateliers, magasins, chantiers. Rôles × périmètres (groupe, société, site), délégations datées, journal d'audit en ajout seul. |
| Équipements | Fiche, anti-doublon, catégories et modèles, criticité, états opérationnels historisés, affectations sans chevauchement, réforme, étiquette QR. |
| Compteurs | Relevés contrôlés (croissance, plausibilité, horodatage), quarantaine « à vérifier » avec validation ou rejet, remplacement de compteur avec usage cumulé conservé. |
| Préventif | Plans par catégorie ou modèle, déclencheurs calendaire et compteur au premier seuil atteint, fixe ou glissant, pré-alertes, tolérances, projection par l'usage moyen, génération des OT sans doublon, reports, checklists, contrôles réglementaires bloquants. |
| Correctif et OT | Demandes d'intervention avec priorité proposée et détection des doublons, qualification et immobilisation, OT et machine à états, conditions manquantes toutes listées, temps, pièces, compte rendu, remise en service validée, clôtures, réouverture et récidive, OT externe. |
| Planification | Semaine par technicien, absences bloquantes, chevauchements signalés, capacité nette avec réserve pour les urgences, carnet à planifier. |
| Stock | Catalogue, stock par magasin, réservations, sorties et retours sur OT, réceptions, transferts, ajustements, rebuts, seuils, coût moyen pondéré, intégrité (verrous, idempotence, pas de stock négatif). |
| Indicateurs | Disponibilité, MTBF, MTTR, MDT, respect du préventif, coûts complets par OT et par équipement, consommation de pièces, tableau de bord filtré par droits. |
| API REST v1 | Mêmes services, mêmes règles et mêmes droits que les écrans. Catalogue public avec schémas JSON générés depuis la validation : `GET /api/v1`. |

## Démarrage rapide

Prérequis : Node.js 22 ou plus, Docker (ou un PostgreSQL 16 local).

```bash
docker compose up -d          # PostgreSQL 16 sur localhost:5432 (gmao / gmao)
cp .env.example .env          # puis renseigner BETTER_AUTH_SECRET (openssl rand -base64 32)
npm install
npm run db:migrate            # crée les tables
npm run db:seed               # données de démonstration
npm run dev                   # http://localhost:3000
```

`npm run db:reset` vide la base, rejoue les migrations et recharge la démonstration (refusé sur une base dont l'URL contient « prod »).

### Comptes de démonstration

Mot de passe commun : `Demo-Gmao-2026`. Les données sont datées par rapport au jour du chargement : la démonstration est toujours « actuelle ».

| Compte | Rôle | Périmètre |
| --- | --- | --- |
| `admin@demo.gmao` | Administrateur | Tout le groupe |
| `resp.maintenance@demo.gmao` | Responsable maintenance | Tout le groupe |
| `flotte@demo.gmao` | Gestionnaire de flotte | Société SBTP |
| `chef.lyon@demo.gmao` | Chef d'atelier (+ délégation responsable maintenance) | Site de Lyon |
| `chef.grenoble@demo.gmao` | Chef d'atelier | Site de Grenoble |
| `tech.lyon@demo.gmao`, `tech2.lyon@demo.gmao` | Techniciens | Site de Lyon |
| `tech.grenoble@demo.gmao` | Technicien | Site de Grenoble |
| `conducteur@demo.gmao` | Conducteur | Site de Lyon |
| `magasin@demo.gmao` | Magasinier | Société SBTP |
| `achats@demo.gmao` | Responsable achats | Tout le groupe |
| `direction@demo.gmao` | Direction | Tout le groupe |

### Situations prêtes à dérouler (scénarios de recette du CDC §15)

- **R-01** : l'entretien 250 h de la chargeuse CH-012 est en pré-alerte, son OT est planifié jeudi avec Julien.
- **R-02** : le conducteur a signalé une fuite hydraulique sur la pelle PE-007 (criticité A, priorité P1) : DI à qualifier.
- **R-03** : le chariot CE-031 est immobilisé, son OT est en attente de la pompe hydraulique (une seule en stock, à Marseille).
- **R-05** : l'horamètre de PE-002 a été remplacé à 6 850 h ; 120 h lues = 6 970 h cumulées, l'entretien des 7 000 h approche.
- **PRV-12** : la VGP échue du chariot CE-020 bloque l'équipement ; l'organisme de contrôle est planifié.
- **DON-02** : un relevé télématique invraisemblable de CA-102 attend une validation ou un rejet.
- TP-004 attend sa remise en service, PE-010 est immobilisé avec un OT planifié demain, PE-007 a un préventif en retard.

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement (Turbopack) |
| `npm run build` puis `npm start` | Construction et serveur de production |
| `npm run typecheck` | Types des routes (`next typegen`) puis TypeScript |
| `npm run lint` · `npm run format` | ESLint · Prettier |
| `npm test` | Tests unitaires des règles métier (Vitest) |
| `npm run test:e2e` | Tests de bout en bout (Playwright) sur l'application construite ; base chargée avec `db:reset` au préalable |
| `npm run db:generate` | Nouvelle migration SQL après modification du schéma Drizzle |
| `npm run db:studio` | Explorateur de base Drizzle Studio |

## Architecture en bref

```
src/
  app/(auth)/            connexion
  app/(app)/             écrans : une page par route, actions serveur dans actions.ts
  app/api/v1/            API REST (mêmes services que les écrans)
  components/            interface : primitives, formulaires, mise en page
  lib/                   libellés français, formats, utilitaires partagés client/serveur
  server/
    domain/              règles métier pures, sans base de données, testées (compteurs, préventif, OT, stock, KPI)
    services/            cas d'usage : droits, transactions, audit, notifications
    authz/               rôles, droits, contexte d'autorisation (rôle × périmètre)
    auth/                Better Auth (mot de passe, SSO Microsoft Entra ID, jetons Bearer)
    db/                  schéma Drizzle et client PostgreSQL
drizzle/                 migrations SQL
scripts/                 migration, remise à zéro, données de démonstration
e2e/                     tests Playwright
docs/                    cahier des charges, architecture, traçabilité
```

Détails, conventions et glossaire : `docs/architecture.md`. Consignes pour les agents de code (Claude Code) : `CLAUDE.md`.

## Pile technique

Next.js 16 (App Router, Cache Components, Server Actions) et React 19, TypeScript, PostgreSQL 16 avec Drizzle ORM, Better Auth, Zod 4, Tailwind CSS 4, Vitest et Playwright.

## Configuration

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` | Connexion PostgreSQL |
| `BETTER_AUTH_SECRET` | Secret de signature des sessions (32 caractères minimum) |
| `BETTER_AUTH_URL` | URL publique de l'application |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` | SSO Microsoft Entra ID, activé dès que l'identifiant et le secret sont renseignés |
| `NEXT_PUBLIC_DEFAULT_TIMEZONE` | Fuseau d'affichage et de saisie, `Europe/Paris` par défaut |

## Ce qui reste à faire pour le MVP

Le détail est dans `docs/tracabilite.md`. Les manques principaux :

- **Application mobile hors connexion** (MOB-01 à 09, 13) : l'API est prête (jetons Bearer, idempotence par `clientId`, canal mobile tracé), l'application reste à construire.
- **Imports et exports** (EQP-13, INT-01) et **documents et photos** (EQP-07).
- **Circuits de validation paramétrables** (HAB-04), matrice des droits paramétrable (HAB-01), double facteur obligatoire pour les administrateurs (TEC-04).
- **Règles de notification paramétrables, courriel et escalade** (NOT-01 à 03) : seules les notifications dans l'application sont en place.
- **Urgences** avec proposition des OT à décaler (PLA-06), campagnes d'inventaire (STK-07), surcharge locale des plans (PRV-01), correction d'un relevé validé (DON-05), historique des reports d'OT (DON-09).
- **Exploitation** : tâche planifiée de génération du préventif et de recalcul nocturne, sauvegardes, chiffrement, supervision (TEC-06 à 08).

## Points de vigilance

- `npm audit` signale des alertes sur `mysql2`, `deepmerge-ts` et `esbuild` : ce sont des dépendances transitives facultatives de Better Auth et des outils de développement (adaptateurs MySQL et Prisma), non utilisées avec PostgreSQL. À revoir à la prochaine mise à jour de Better Auth.
- Les valeurs marquées [AC] dans le cahier des charges (seuils, délais, tolérances) sont des propositions à confirmer en atelier de cadrage. Dans le code, ce sont des constantes nommées signalées par `[AC]` en commentaire (`grep -rn "\[AC\]" src`) : horizon de génération, tolérance, délai de réouverture, réserve d'urgence, seuil d'écart d'inventaire, vitesse plausible, durée de session.
