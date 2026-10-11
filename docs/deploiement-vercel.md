# Déploiement sur Vercel avec Neon

L'application Next.js est déployée sur Vercel **uniquement depuis la branche `main`, par GitHub Actions après approbation humaine** ; la base est un PostgreSQL Neon. Aucune autre branche n'est déployée.

## Pipeline de mise en production

```
GMAO-NN ──PR, CI verte, fusion automatique──▶ develop ──PR (garde : develop uniquement), fusion manuelle──▶ main ──▶ CI ──▶ approbation ──▶ Vercel (production)
```

0. **PR `GMAO-NN` → `develop`** : le workflow **Fusion automatique vers develop** (`.github/workflows/auto-merge-develop.yml`) active la fusion automatique dès l'ouverture. GitHub fusionne seul quand toutes les vérifications obligatoires sont vertes (formatage, lint, types, tests unitaires, tests de bout en bout, application mobile). Si une vérification échoue, rien n'est fusionné : corriger la branche et pousser, la CI repart. Une PR en brouillon n'est pas fusionnée.
1. **PR `develop` → `main`** : la CI (vérifications, tests, application mobile) et la garde « Source de la PR (develop uniquement) » doivent réussir ; la protection de `main` refuse toute autre source et toute poussée directe.
2. **Merge** : la CI repart sur `main` ; si elle réussit, le workflow **Déploiement production** (`.github/workflows/deploy-production.yml`) démarre et **attend une approbation** (environnement GitHub `production-approval`).
3. **Approbation** : GitHub → **Actions** → l'exécution « Déploiement production » → **Review deployments** → cocher `production-approval` → **Approve and deploy** (ou **Reject**).
4. **Déploiement** : `vercel deploy --prod` ; la construction a lieu chez Vercel (migrations comprises), puis le workflow vérifie que `/api/health` répond `ok` **avec la version déployée** (`version` : commit court, variable `APP_VERSION`).

Redéployer sans nouveau merge : **Actions → Déploiement production → Run workflow** (branche `main`), avec la même approbation. **Ne pas relancer (« Re-run ») une ancienne exécution** : elle remettrait en ligne une version dépassée ; le workflow la refuse (« Version dépassée ») si son commit n'est plus le dernier de `main`.

Les déploiements automatiques de l'intégration GitHub de Vercel sont désactivés pour **toutes** les branches (`vercel.json` : `git.deploymentEnabled = false`) : ni prévisualisation des branches de tâche ou de `develop`, ni déploiement direct de `main`. Seul le workflow « Déploiement production » déploie. Si une prévisualisation est créée malgré tout (déploiement manuel), elle ne modifie jamais la base (ni migration ni démonstration, sauf `PREVIEW_MIGRATIONS=true` sur une base distincte).

### Configuration du dépôt GitHub (Settings)

| Réglage | Valeur |
| --- | --- |
| Secret `VERCEL_TOKEN` | Jeton Vercel (https://vercel.com/account/tokens, portée : l'équipe du projet) |
| Variables `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | Identifiants de l'équipe et du projet (Vercel → projet → Settings → General) |
| Environnement `production-approval` | Approbateurs requis, déploiement limité à `main` |
| Protection de `main` | PR obligatoire, contrôles requis (CI, application mobile, garde develop), pas de poussée forcée |
| Protection de `develop` | PR obligatoire, contrôles requis « Vérifications et tests » et « Application mobile (Expo) », appliquée aussi aux administrateurs, pas de poussée forcée ni de suppression |
| General → Pull Requests | « Allow auto-merge » coché |

Commandes équivalentes (compte administrateur du dépôt, `gh auth login`) :

```bash
gh api -X PATCH repos/HMZID/GMAO -F allow_auto_merge=true
gh api -X PUT repos/HMZID/GMAO/branches/develop/protection --input .github/develop-protection.json
```


## Ce que fait chaque déploiement

Vercel exécute `npm run vercel-build` (`scripts/predeploy.ts`, puis `next build`) :

1. contrôle de la configuration : `DATABASE_URL` et `BETTER_AUTH_SECRET` (32 caractères au moins). Si une variable manque, le déploiement s'arrête avec son nom, et la version en ligne reste la précédente ;
2. migrations SQL (`drizzle/`), par `DATABASE_URL_UNPOOLED` si elle existe, sinon `DATABASE_URL` ;
3. données de démonstration si `SEED_DEMO_DATA=true` : chargées une seule fois, sur une base vide.

`vercel.json` place les fonctions à Francfort (`fra1`, au plus près de Neon `eu-central-1`) et déclare la tâche planifiée des courriels (`/api/cron/notifications`, chaque jour à 5 h UTC, limite de l'offre gratuite).

## Variables d'environnement (Vercel → Settings → Environment Variables)

| Variable | Valeur | Obligatoire |
| --- | --- | --- |
| `DATABASE_URL` | Adresse Neon **avec** pooling (`-pooler` dans l'hôte), sans `&channel_binding=require` | Oui |
| `BETTER_AUTH_SECRET` | Chaîne aléatoire de 32 caractères au moins | Oui |
| `SEED_DEMO_DATA` | `true` pour charger la démonstration (comptes à mot de passe connu : à retirer pour une vraie production) | Non |
| `DATABASE_URL_UNPOOLED` | Adresse Neon **sans** pooling, pour les migrations (posée automatiquement par l'intégration Neon de Vercel) | Non |
| `BETTER_AUTH_URL` | Adresse publique ; par défaut l'adresse de production Vercel (`VERCEL_PROJECT_PRODUCTION_URL`) | Non |
| `PLATFORM_ADMIN_EMAILS` | Courriels des administrateurs de la plateforme (organisations clientes, démonstrations), séparés par des virgules | Pour les démonstrations |
| `CRON_SECRET` | Secret de la tâche planifiée des courriels (16 caractères au moins) | Pour les courriels |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | Serveur d'envoi des courriels | Pour les courriels |
| `STORAGE_DRIVER=s3`, `S3_*` | Stockage des documents : le disque de Vercel est en lecture seule | Pour les documents |

Générer un secret (PowerShell) :

```powershell
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
```

Une variable modifiée n'est prise en compte qu'au déploiement suivant : **GitHub → Actions → Déploiement production → Run workflow** (pas de « Redeploy » depuis Vercel, pour que la production passe toujours par l'approbation).

Connexion à Neon : l'application écrit `sslmode=verify-full` à la place de `sslmode=require` (`src/server/db/connection-string.ts`) pour garder la vérification complète du certificat quand la bibliothèque `pg` changera la signification de `require`. Rien à modifier dans les variables.

Version de Node : `22.x` (`package.json`, `engines`), la même que la CI et le poste de développement.

## Vérification

- `https://<adresse>/api/health` : `{"status":"ok","version":"<commit>"}` ; sinon `reason` indique `configuration` (avec les noms des variables manquantes) ou `database`.
- Connexion avec un compte de démonstration (`admin@demo.gmao`, mot de passe du README) si `SEED_DEMO_DATA=true`.

## Sécurité

- Ne jamais copier l'adresse de connexion Neon ailleurs que dans Vercel (elle contient le mot de passe). En cas de fuite : Neon → Connect → **Reset password**, puis mettre à jour `DATABASE_URL` dans Vercel et redéployer.
- Les comptes de démonstration ont un mot de passe public : pour une vraie production, ne pas définir `SEED_DEMO_DATA` et créer les comptes depuis l'administration.
