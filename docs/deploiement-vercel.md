# Déploiement sur Vercel avec Neon

L'application Next.js est déployée sur Vercel par GitHub Actions, dans deux environnements, chacun avec sa propre base PostgreSQL Neon :

- **production** : branche `main`, après approbation humaine ;
- **développement** (recette) : branche `develop`, automatiquement après une CI verte, à une adresse fixe (par défaut `https://gmao-develop.vercel.app`).

Aucune autre branche n'est déployée.

## Pipeline de mise en production

```
GMAO-NN ──PR, CI verte, fusion automatique──▶ develop ──▶ Pipeline développement (tests, config, Vercel recette)
                                               └──PR (garde : develop uniquement), fusion manuelle──▶ main ──▶ CI ──▶ approbation ──▶ Vercel (production)
```

0. **PR `GMAO-NN` → `develop`** : le workflow **Fusion automatique vers develop** (`.github/workflows/auto-merge-develop.yml`) active la fusion automatique dès l'ouverture. GitHub fusionne seul quand toutes les vérifications obligatoires sont vertes (formatage, lint, types, tests unitaires, tests de bout en bout, application mobile). Si une vérification échoue, rien n'est fusionné : corriger la branche et pousser, la CI repart. Une PR en brouillon n'est pas fusionnée.
1. **PR `develop` → `main`** : la CI (vérifications, tests, application mobile) et la garde « Source de la PR (develop uniquement) » doivent réussir ; la protection de `main` refuse toute autre source et toute poussée directe.
2. **Merge** : la CI repart sur `main` ; si elle réussit, le workflow **Déploiement production** (`.github/workflows/deploy-production.yml`) démarre et **attend une approbation** (environnement GitHub `production-approval`).
3. **Approbation** : GitHub → **Actions** → l'exécution « Déploiement production » → **Review deployments** → cocher `production-approval` → **Approve and deploy** (ou **Reject**).
4. **Déploiement** : `vercel deploy --prod` ; la construction a lieu chez Vercel (migrations comprises), puis le workflow vérifie que `/api/health` répond `ok` **avec la version déployée** (`version` : commit court, variable `APP_VERSION`).

Redéployer sans nouveau merge : **Actions → Déploiement production → Run workflow** (branche `main`), avec la même approbation. **Ne pas relancer (« Re-run ») une ancienne exécution** : elle remettrait en ligne une version dépassée ; le workflow la refuse (« Version dépassée ») si son commit n'est plus le dernier de `main`.

Les déploiements automatiques de l'intégration GitHub de Vercel sont désactivés pour **toutes** les branches (`vercel.json` : `git.deploymentEnabled = false`) : ni prévisualisation des branches de tâche, ni déploiement direct. Seuls les workflows « Déploiement production » (`main`) et « Déploiement développement » (`develop`) déploient. Si une prévisualisation est créée malgré tout (déploiement manuel), elle ne modifie jamais la base (ni migration ni démonstration, sauf `PREVIEW_MIGRATIONS=true` sur une base distincte).

## Environnement de développement (`develop`)

Le pipeline **Pipeline développement** (`.github/workflows/deploy-develop.yml`) part automatiquement sur chaque push vers `develop` (fusion d'une branche de tâche), sans approbation. Ses étapes, chacune bloquante pour la suivante :

1. **Vérifications et tests** : la CI complète (`ci.yml`, réutilisée).
2. **Configuration Vercel** (`scripts/ci/preview-env.sh`) : par l'API Vercel (noms et portées seulement), `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` ne sont pas partagées avec la production ; les variables Preview manquantes sont créées depuis Neon (voir ci-dessous), puis les obligatoires sont vérifiées.
3. **Déploiement** : prévisualisation Vercel (`VERCEL_ENV=preview`) attachée à l'adresse fixe, puis `/api/health` : `status` ok, version déployée, `environment` à `development`. Un bandeau jaune « Environnement de développement » s'affiche sur chaque page. Les tâches planifiées de Vercel ne tournent pas sur une prévisualisation, et sans `SMTP_HOST` les courriels restent dans le journal (Administration › Courriels).

**Garde-fou de la base.** Chaque base porte la marque de son environnement (table `platform_settings`, posée au déploiement par `scripts/predeploy.ts`). Le développement refuse une base marquée « production » ou une base existante non marquée ; la production refuse une base marquée « development ». La construction s'arrête alors avec un message clair, avant toute écriture.

Mise en place, une seule fois :

1. **Neon** : une base **vide** pour le développement, par exemple la branche `develop` et, dans cette branche, la base `gmao_dev` (Databases → New database). Une branche copiée de la production avec ses données est refusée par le garde-fou. Si l'intégration Neon de Vercel crée une branche par prévisualisation, la désactiver pour ce projet.
2. **Vercel → Settings → Environment Variables** : les variables de la production ne doivent être que de portée **Production** (le pipeline s'arrête sinon).
3. **Clé d'API Neon** : Neon → Account settings → API keys → *Create new API key*, puis GitHub → Settings → Secrets and variables → Actions → **New repository secret** `NEON_API_KEY`. Le pipeline crée alors lui-même les variables Preview manquantes :

   | Variable Preview | Valeur créée par le pipeline |
   | --- | --- |
   | `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Adresses de `gmao_dev` dans la branche `develop`, **relues dans Neon à chaque exécution** (avec et sans pooling, `?sslmode=require` seul) : un changement de mot de passe dans Neon est repris au déploiement suivant ; jamais la branche par défaut |
   | `BETTER_AUTH_SECRET` | Secret aléatoire propre à la recette |
   | `BETTER_AUTH_URL` | `https://gmao-develop.vercel.app` (ou `DEVELOP_ALIAS`) |
   | `PREVIEW_MIGRATIONS`, `SEED_DEMO_DATA` | `true` |
   | `PLATFORM_ADMIN_EMAILS` | Secret GitHub `DEVELOP_PLATFORM_ADMIN_EMAILS`, **repris à chaque exécution** ; il doit nommer au moins un compte de la base de recette (`admin@demo.gmao`), sans quoi personne n'y administre la plateforme (demandes d'essai, organisations) |

   Variables GitHub utilisées : `NEON_PROJECT_ID` (identifiant du projet Neon), et facultatives `NEON_DEV_BRANCH` (`develop`), `NEON_DEV_DATABASE` (`gmao_dev`), `DEVELOP_ALIAS`. Hors adresses de la base, une variable Preview déjà déclarée n'est jamais modifiée. Sans `NEON_API_KEY`, les variables se déclarent à la main dans Vercel (portée Preview seulement). Le dépôt est public : aucune valeur n'est écrite dans les journaux.
4. **Vercel → Settings → Deployment Protection** : soit désactiver la protection des prévisualisations (l'application garde sa propre connexion), soit créer un secret *Protection Bypass for Automation* et le déclarer dans GitHub sous `VERCEL_AUTOMATION_BYPASS_SECRET`. Le pipeline le signale s'il est bloqué.
5. Premier déploiement : la prochaine fusion dans `develop`, ou **Actions → Pipeline développement → dernière exécution → Re-run all jobs** (aussi pour redéployer après un changement de variable). Si la configuration est incomplète, l'étape 2 s'arrête en nommant ce qui manque.

### Configuration du dépôt GitHub (Settings)

| Réglage | Valeur |
| --- | --- |
| Secret `VERCEL_TOKEN` | Jeton Vercel (https://vercel.com/account/tokens, portée : l'équipe du projet) |
| Variables `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | Identifiants de l'équipe et du projet (Vercel → projet → Settings → General) |
| Environnement `production-approval` | Approbateurs requis, déploiement limité à `main` |
| Protection de `main` | PR obligatoire, contrôles requis (CI, application mobile, garde develop), pas de poussée forcée |
| Protection de `develop` | PR obligatoire, contrôles requis « Vérifications et tests » et « Application mobile (Expo) », appliquée aussi aux administrateurs, pas de poussée forcée ni de suppression |
| General → Pull Requests | « Allow auto-merge » coché |
| Secret `AUTO_MERGE_TOKEN` | Jeton personnel à granularité fine (GitHub → Settings → Developer settings → Fine-grained tokens), dépôt `HMZID/GMAO` seul, permissions *Contents*, *Pull requests* et *Workflows* en lecture-écriture. Sans lui, une fusion automatique (faite par `github-actions`) ne déclenche pas le Pipeline développement et une PR qui modifie un workflow doit être fusionnée à la main |

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
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | CAPTCHA de la page de connexion (Cloudflare Turnstile, voir ci-dessous). Sans elles, la page fonctionne sans CAPTCHA (poste local, CI) ; la limitation des tentatives reste active | Conseillé en production et en recette |
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

## Sécurité de la connexion

- **CAPTCHA** (Cloudflare Turnstile, souvent invisible) sur la page `/login` : Cloudflare → *Turnstile* → *Add widget*, noms de domaine `gmao-eight-alpha.vercel.app` (production) et `gmao-develop.vercel.app` (recette), mode *Managed*. Déclarer la clé du site et la clé secrète dans Vercel (`TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`), pour Production et Preview. Le serveur vérifie chaque jeton (action `login`, nom de domaine de l'application, usage unique) et refuse en cas de panne du service. L'adresse HTTP `/api/auth/sign-in/email`, utilisée par l'application mobile, n'exige pas de CAPTCHA.
- **Double authentification** (TOTP, application d'authentification) : obligatoire pour l'administrateur de la plateforme en recette et en production (`ADMIN_TWO_FACTOR_REQUIRED`, `true` par défaut sur Vercel, `false` en local et en CI). À sa première connexion, il est dirigé vers **Sécurité du compte** (`/compte/securite`) : QR code, 10 codes de secours, confirmation par un premier code ; ses droits de plateforme restent suspendus jusque-là. Facultative pour les autres comptes (lien dans l'en-tête), mais l'application mobile ne gère pas encore le code. Secret et codes chiffrés par Better Auth ; codes faux limités, puis vérification bloquée.
- **Mots de passe divulgués** refusés (Have I Been Pwned, seuls 5 caractères de l'empreinte quittent le serveur) : `PASSWORD_BREACH_CHECK`, actif par défaut sur Vercel.
- **Tentatives limitées** pour l'écran, l'adresse HTTP et le mobile (table `login_attempts`, IP conservée en empreinte, purge à 30 jours) : 5 échecs d'un compte depuis une même adresse, 20 échecs d'un compte, ou 50 échecs depuis une adresse, en 15 minutes, bloquent la connexion pendant 15 minutes. La réponse ne dit pas si le compte existe.
- **Retour après connexion** limité aux chemins de l'application (`safeRedirectPath`).
- **En-têtes** sur toutes les réponses : `frame-ancestors 'none'` et `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS.

## Vérification

- `https://<adresse>/api/health` : `{"status":"ok","version":"<commit>","environment":"production"}` (`development` sur l'adresse de recette) ; sinon `reason` indique `configuration` (avec les noms des variables manquantes) ou `database`.
- Connexion avec un compte de démonstration (`admin@demo.gmao`, mot de passe du README) si `SEED_DEMO_DATA=true`.

## Sécurité

- Ne jamais copier l'adresse de connexion Neon ailleurs que dans Vercel (elle contient le mot de passe). En cas de fuite : Neon → Connect → **Reset password**, puis mettre à jour `DATABASE_URL` dans Vercel et redéployer.
- Les comptes de démonstration ont un mot de passe public : pour une vraie production, ne pas définir `SEED_DEMO_DATA` et créer les comptes depuis l'administration.
