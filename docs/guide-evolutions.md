# Guide de configuration et d'utilisation des évolutions

Ce guide couvre les cinq évolutions livrées après le MVP : application mobile, imports Excel, documents, circuits de validation et notifications par courriel. Les règles détaillées sont dans `docs/architecture.md`, l'avancement exigence par exigence dans `docs/tracabilite.md`.

## 1. Mise en route

```bash
docker compose up -d                    # PostgreSQL et Mailpit (courriels de développement)
docker compose --profile s3 up -d       # en plus : stockage S3 de développement (SeaweedFS)
cp .env.example .env                    # puis renseigner BETTER_AUTH_SECRET
npm install
npm run db:migrate && npm run db:seed   # ou npm run db:reset
npm run dev                             # application web : http://localhost:3000
npm run worker                          # envoi des courriels et alertes calculées
```

Mailpit affiche les courriels envoyés sur http://localhost:8025. Comptes de démonstration : voir le README (mot de passe commun `Demo-Gmao-2026`).

### Variables d'environnement ajoutées

| Domaine | Variables |
| --- | --- |
| Documents | `DOCUMENT_MAX_SIZE_MB` (20), `STORAGE_DRIVER` (`local` ou `s3`), `STORAGE_LOCAL_DIR` (`./storage`), `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`, `S3_AUTO_CREATE_BUCKET`, `S3_SERVER_SIDE_ENCRYPTION` |
| Courriels | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_REQUIRE_TLS`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, `APP_URL`, `EMAIL_DIGEST_HOUR` (7), `EMAIL_WORKER_INTERVAL_SECONDS` (30), `EMAIL_ALERTS_INTERVAL_MINUTES` (15), `CRON_SECRET` |
| Mobile | `EXPO_PUBLIC_API_URL` (dans `mobile/.env`) |

### Production

- **Stockage** : `STORAGE_DRIVER=s3` sur un compartiment privé (AWS, Scaleway, OVH…). Avec plusieurs serveurs d'application, le stockage local ne convient pas : chaque serveur aurait ses propres fichiers.
- **Courriels** : un compte SMTP authentifié (Office 365, Brevo, Amazon SES) et `MAIL_FROM` d'un domaine autorisé (SPF, DKIM). Lancer `npm run worker` comme service permanent (systemd, conteneur, PM2…), ou appeler `POST /api/cron/notifications` toutes les minutes avec `Authorization: Bearer <CRON_SECRET>`. Plusieurs processus peuvent tourner en parallèle sans double envoi.
- **Mobile** : application construite avec EAS, `EXPO_PUBLIC_API_URL` en HTTPS.

## 2. Application mobile

Voir `mobile/README.md` pour l'installation. En résumé, pour le technicien :

1. **Connexion** avec son compte GMAO. Les onglets dépendent de ses droits.
2. **Mes OT** → choisir l'OT → **Démarrer l'intervention**.
3. Remplir la **checklist**, le **diagnostic et compte rendu**, le **temps passé** (raccourcis 15 min, 30 min, 1 h, 2 h), les **pièces consommées** (article, magasin, quantité), le **relevé du compteur**, puis prendre des **photos**.
4. **Travaux terminés**. Le serveur vérifie toutes les conditions à l'envoi ; une condition manquante apparaît « à revoir » dans l'onglet **Synchro**.

**Scanner** lit le QR code de l'étiquette et ouvre la fiche de l'équipement. Depuis la fiche, on peut **signaler une panne** ou saisir un **relevé de compteur**.

**Sans réseau**, tout se saisit normalement. Le bandeau indique « Hors connexion » et le nombre de saisies en attente ; l'envoi part tout seul au retour du réseau, sans doublon.

## 3. Imports Excel

Menu **Imports** (profils qui peuvent créer des équipements, des articles ou des mouvements de stock).

1. **Télécharger le modèle** du type voulu : équipements, pièces détachées ou stocks initiaux. Le classeur contient l'onglet de saisie (listes déroulantes, colonnes obligatoires marquées *), l'onglet **Aide** (règle de chaque colonne) et l'onglet **Listes** (codes de société, site, catégorie et magasin de votre périmètre).
2. Remplir le fichier : 5 000 lignes et 10 Mo au plus. L'ordre des colonnes est libre.
3. **Simuler l'import** : chaque ligne passe tous les contrôles de la saisie à l'écran, sans rien créer. L'aperçu donne pour chaque ligne son statut (à importer, déjà présente, en erreur) et ses anomalies. Le **rapport Excel** reprend toutes les lignes avec leurs anomalies, prêt à être corrigé.
4. **Exécuter** :
   - **Tout importer** (tout ou rien) : refusé tant qu'une ligne est en erreur ;
   - **Importer les lignes valides** : les lignes en erreur restent à corriger.

**Réimportation** : une ligne dont la clé existe déjà (code parc, référence interne, article déjà mouvementé dans le magasin) est ignorée, jamais recréée. Le même fichier peut donc être réimporté après correction. Importer les **articles avant les stocks initiaux**.

## 4. Documents et photos

Carte **Documents** des fiches équipement et OT.

- **Ajouter** : choisir le fichier (PDF, photo, vidéo courte, Word, Excel ; 20 Mo par défaut), le type (notice, certificat, facture, photo, rapport, autre), un titre et une date d'expiration facultative (certificat, rapport de contrôle).
- **Consulter** : le titre ouvre le document dans le navigateur ; « Télécharger » l'enregistre.
- **Retirer** : réservé au gestionnaire de l'objet, ou à l'auteur d'une photo d'OT tant que l'OT n'est pas clôturé. Le document disparaît de la fiche mais reste conservé pour l'audit.
- Les **factures** ne sont visibles que des profils achats et maintenance.
- Un document arrivant à échéance déclenche un courriel à J-30, J-7 et à l'échéance (gestionnaire de flotte, responsable achats).

Contrôles : le contenu réel du fichier est vérifié (un exécutable renommé en .pdf est refusé), et le même fichier ne peut pas être joint deux fois au même objet.

## 5. Circuits de validation

### Paramétrage (administrateur)

**Administration → Circuits de validation**.

- Un circuit par type d'objet : **demande d'intervention**, **demande d'achat**, **dépense de maintenance**. Il vaut pour une société, ou pour tout le groupe à défaut.
- **Étapes**, dans l'ordre. Pour chacune :
  - un valideur : un **rôle**, pris dans la société ou le site de l'objet, ou une **personne nommée** ;
  - un **seuil** « à partir de » (vide : toujours) ;
  - pour les DI, des **priorités** (par exemple P1 seulement).
- Un circuit inactif ne s'applique plus. Les demandes déjà soumises gardent les étapes figées au moment de la soumission.

Circuits de la démonstration (CDC §2.4) :
- **DI P1** → chef d'atelier du site ;
- **demande d'achat** → responsable achats, puis direction à partir de 5 000 € ;
- **dépense** → responsable maintenance à partir de 1 000 €, puis direction à partir de 10 000 €.

### Utilisation

- **Demandes d'achat** (menu du même nom, ou depuis un OT) : objet, quantité, prix estimé, rattachement obligatoire (OT, équipement ou centre de coût). La demande part dans le circuit ; sans étape applicable, elle est validée d'office.
- **Dépenses de maintenance** : une dépense ajoutée à un OT au-delà du seuil reste « à valider ». Elle n'entre dans les coûts qu'une fois validée, et l'OT ne peut pas être clôturé administrativement tant qu'elle attend.
- **DI P1** : la transformation en OT est bloquée tant que le chef d'atelier n'a pas validé ; refusée, la DI est rejetée.
- **Validations** (menu) :
  - **À valider** : les demandes dont vous êtes valideur, avec **Valider** ou **Refuser** (commentaire obligatoire en cas de refus) ;
  - **Mes demandes soumises** ;
  - **Suppléance** : désigner un suppléant pour une période ; ses décisions portent la mention « suppléant de … ».
- Règles : le demandeur ne décide jamais de sa demande, une même personne ne valide pas deux étapes, et une demande tranchée ne change plus. Chaque décision (auteur, date, commentaire) est visible sur la fiche de l'objet.

## 6. Notifications par courriel

- **Préférences** : page **Notifications**, carte « Courriels ». Les alertes obligatoires (DI P1, validation en attente) ne se désactivent pas.
- **Événements** :
  - affectation à un OT ;
  - validation en attente ;
  - décision sur vos demandes ;
  - DI urgente ;
  - documents arrivant à échéance ;
  - récapitulatifs quotidiens à partir de `EMAIL_DIGEST_HOUR` : échéances, retards, stock sous le point de commande.
- **Suivi** (administrateur) : **Administration → Courriels** affiche les compteurs par statut et la dernière erreur de chaque courriel. On peut **relancer** un courriel en échec, **annuler** un courriel en attente, et **traiter la file maintenant**.
- Fonctionnement :
  - un même événement n'envoie qu'un courriel par destinataire ;
  - une erreur passagère est retentée après 1, 5, 15, 60 puis 240 minutes ;
  - une adresse refusée ou une authentification impossible met le courriel en échec tout de suite.
