# CLAUDE.md — consignes pour les agents de code

@AGENTS.md

GMAO pour engins, véhicules et équipements. Référence fonctionnelle : `docs/cahier-des-charges.md` (identifiants d'exigences HAB, EQP, PRV, COR, PLA, STK, ACH, KPI, MOB, NOT, INT, TEC, DON). Avancement : `docs/tracabilite.md`. Architecture et glossaire : `docs/architecture.md`.

## Commandes

- `npm run dev` · `npm run build` · `npm start`
- `npm run typecheck` (génère les types de routes puis `tsc`) · `npm run lint` · `npm run format`
- `npm test` : règles métier (Vitest, `src/**/*.test.ts`, TZ=UTC)
- `npm run test:e2e` : Playwright sur l'application construite (`npm run build` et `npm run db:reset` avant)
- `npm run db:reset` : base vidée, migrée et rechargée (démonstration datée par rapport au jour)
- `npm run worker` : envoi des courriels en file et alertes calculées (`-- --once` : une passe)
- Schéma modifié : `npm run db:generate` puis `npm run db:migrate` ; ne jamais modifier une migration déjà livrée

Avant de rendre la main : `npm run format`, `npm run lint`, `npm run typecheck`, `npm test`, et les tests e2e si un écran ou un service a changé.

## Flux Git

- `main` : production. `develop` : intégration et recette.
- Chaque tâche a sa branche `GMAO-NN` (numéro suivant : `GMAO-01`, `GMAO-02`…), créée depuis `develop` à jour.
- Pull Request `GMAO-NN` → `develop` une fois les vérifications passées (CI verte). Jamais de PR d'une branche de tâche vers `main`.
- Après les tests sur `develop`, Pull Request `develop` → `main` pour la mise en production, sur décision du responsable du projet.

## Architecture

- `src/server/domain/` : règles pures (aucun import de base ni de Next), testées. Toute règle métier nouvelle commence ici, avec son test.
- `src/server/services/` : cas d'usage. Chaque fonction exportée reçoit un `AuthContext`, valide l'entrée avec Zod (`parseInput`), vérifie les droits (`assertCan` / `assertCanOn`), filtre par périmètre (`scopeWhere`), écrit l'audit (`audit`) dans la même transaction.
- Écrans (`src/app/(app)/`) et API (`src/app/api/v1/`) appellent les **mêmes** services : jamais de règle ni de contrôle de droit dans une page, une action ou une route.
- `src/lib/labels.ts` : libellés français des énumérations (le code et la base sont en anglais).

## Conventions

- Identifiants de code en anglais, textes, commentaires et messages en français. Référencer l'exigence du CDC en commentaire (`// COR-12 : …`).
- Erreurs : `BusinessRuleError(errors[])` pour une règle métier (toutes les conditions manquantes en une fois, DON-11), `ValidationError` (Zod), `NotFoundError` (aussi pour « hors périmètre », sans révéler l'existence), `ConflictError` (doublons).
- Formulaires : `ActionForm` + `Field` + `SubmitButton` (`src/components/forms/action-form.tsx`). Server Action dans le `actions.ts` du module : `act((ctx) => service(ctx, …, formToObject(formData)), "Message.")` ; création suivie de `redirect()` dans `runAction`. Plusieurs formulaires d'une même action dont certains disparaissent après succès (transitions d'OT) : `ActionPanel` + `PanelForm`.
- Formulaires de modification : `formToObject(formData, { keepEmpty: true })` et champs facultatifs en `clearable(...)` (vide = effacé).
- Dates-heures saisies sans fuseau : interprétées en Europe/Paris par `optionalDate` / `date()` ; affichage par `src/lib/format.ts`. Valeurs `datetime-local` produites par `toDateTimeInput`.
- Montants et compteurs : colonnes `numeric` lues comme `number` ; arrondis dans le domaine.

## Next.js 16 : points d'attention

- Cache Components est activé : les données de requête (session, `searchParams`, base) doivent être sous `<Suspense>`. Chaque dossier de page a un `loading.tsx` (réexport de `@/components/layout/route-loading`) pour couvrir aussi les navigations entre pages voisines. Ne pas lire la session au niveau supérieur d'un layout.
- `new Date()` et `Date.now()` uniquement après un accès dynamique (`getAuthContext()`), jamais dans la partie statique ; la règle ESLint `react-hooks/purity` refuse `Date.now()` dans un composant.
- `proxy.ts` remplace `middleware.ts` (contrôle optimiste du cookie de session ; les vrais contrôles sont dans les services).
- Après une mutation dans une Server Action : `refresh()` (fait par `act`). Les routes API appellent `connection()` (fait par `apiRoute`).
- Le routeur garde les pages visitées montées et masquées : des identifiants HTML fixes peuvent se dupliquer d'une page à l'autre. `Field` et `FilterField` rendent l'identifiant unique (`useId`) ; ne pas relier un libellé à un champ par un identifiant écrit en dur.

## Pièges connus

- **Drizzle, sous-requêtes corrélées** : dans un `select` sur une seule table, Drizzle écrit les colonnes sans préfixe de table. Dans ``sql`(select … where x.col = ${table.id})` ``, la colonne extérieure est alors résolue dans la sous-requête. Écrire la référence extérieure en clair : `"work_orders"."id"`.
- **Transactions** : pas de `Promise.all` sur un client de transaction (`tx`), un seul client ne traite qu'une requête à la fois. Requêtes successives dans les fonctions qui reçoivent `tx`.
- **Stock** : toute modification de quantité passe par `lockLevel` (verrou de ligne) et refuse un stock physique négatif ; les créations hors connexion sont idempotentes par `clientId`.
- **Équipement immobilisé** : la remise en service passe par `releaseEquipmentIfFree` (aucun autre OT correctif immobilisant ouvert ou OT préventif démarré, aucune DI immobilisante en attente, aucun contrôle réglementaire bloquant échu).
- **Compteurs** : seuls les relevés `VALID` font avancer le compteur et les échéances ; les valeurs cumulées (`cumulativeValue`) servent au préventif, les valeurs lues à l'affichage.

## Données de démonstration

`scripts/seed.ts` construit les situations des scénarios de recette (R-01 à R-08) en appelant les services, pour que la démo respecte les règles. Mot de passe commun : `Demo-Gmao-2026` (comptes dans le README).
