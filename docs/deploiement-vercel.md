# Déploiement sur Vercel avec Neon

L'application Next.js est déployée sur Vercel depuis la branche `main`, **par GitHub Actions après approbation humaine** ; la base est un PostgreSQL Neon.

## Pipeline de mise en production

```
GMAO-NN ──PR──▶ develop ──PR (garde : develop uniquement)──▶ main ──▶ CI ──▶ approbation ──▶ Vercel (production)
```

1. **PR `develop` → `main`** : la CI (vérifications, tests, application mobile) et la garde « Source de la PR (develop uniquement) » doivent réussir ; la protection de `main` refuse toute autre source et toute poussée directe.
2. **Merge** : la CI repart sur `main` ; si elle réussit, le workflow **Déploiement production** (`.github/workflows/deploy-production.yml`) démarre et **attend une approbation** (environnement GitHub `production-approval`).
3. **Approbation** : GitHub → **Actions** → l'exécution « Déploiement production » → **Review deployments** → cocher `production-approval` → **Approve and deploy** (ou **Reject**).
4. **Déploiement** : `vercel deploy --prod` ; la construction a lieu chez Vercel (migrations comprises), puis le workflow vérifie `/api/health`.

Redéployer sans nouveau merge : **Actions → Déploiement production → Run workflow** (branche `main`), avec la même approbation.

Le déploiement automatique de `main` par l'intégration GitHub de Vercel est désactivé (`vercel.json` : `git.deploymentEnabled.main = false`) ; les prévisualisations des autres branches restent actives.

### Configuration du dépôt GitHub (Settings)

| Réglage | Valeur |
| --- | --- |
| Secret `VERCEL_TOKEN` | Jeton Vercel (https://vercel.com/account/tokens, portée : l'équipe du projet) |
| Variables `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | Identifiants de l'équipe et du projet (Vercel → projet → Settings → General) |
| Environnement `production-approval` | Approbateurs requis, déploiement limité à `main` |
| Protection de `main` | PR obligatoire, contrôles requis (CI, application mobile, garde develop), pas de poussée forcée |


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
| `CRON_SECRET` | Secret de la tâche planifiée des courriels (16 caractères au moins) | Pour les courriels |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | Serveur d'envoi des courriels | Pour les courriels |
| `STORAGE_DRIVER=s3`, `S3_*` | Stockage des documents : le disque de Vercel est en lecture seule | Pour les documents |

Générer un secret (PowerShell) :

```powershell
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
```

Une variable modifiée n'est prise en compte qu'au déploiement suivant : **Deployments → ⋯ → Redeploy**.

## Vérification

- `https://<adresse>/api/health` : `{"status":"ok"}` ; sinon `reason` indique `configuration` (avec les noms des variables manquantes) ou `database`.
- Connexion avec un compte de démonstration (`admin@demo.gmao`, mot de passe du README) si `SEED_DEMO_DATA=true`.

## Sécurité

- Ne jamais copier l'adresse de connexion Neon ailleurs que dans Vercel (elle contient le mot de passe). En cas de fuite : Neon → Connect → **Reset password**, puis mettre à jour `DATABASE_URL` dans Vercel et redéployer.
- Les comptes de démonstration ont un mot de passe public : pour une vraie production, ne pas définir `SEED_DEMO_DATA` et créer les comptes depuis l'administration.
