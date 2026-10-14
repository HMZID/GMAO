# Site commercial

Vitrine publique de la GMAO, servie par la même application que le logiciel : même base, mêmes comptes, même file de courriels, même déploiement. Un visiteur non connecté qui ouvre `/` voit le site ; un utilisateur connecté y trouve son tableau de bord.

## Pages publiques

| Adresse | Contenu |
| --- | --- |
| `/` (réécrite vers `/decouvrir` sans session) | Accroche, chiffres clés, secteurs, fonctionnalités, démarrage en quatre étapes, calculateur du coût des pannes, offres, témoignages, questions, appel final |
| `/tarifs` | Offres avec bascule mensuel / annuel, inclus dans toutes les offres, questions |
| `/essai-gratuit` (`?offre=Flotte` présélectionne l'offre) | Formulaire de demande de compte de démonstration |
| `/essai-gratuit/merci` | Confirmation |
| `/infos/<adresse>` | Pages libres (mentions légales, confidentialité…) |
| `/robots.txt`, `/sitemap.xml` | Référencement : seul le site est exploré, et seulement en production |

Les pages publiques ne demandent aucune session (`src/proxy.ts`). Elles sont rendues à la requête : une modification faite dans l'administration est visible aussitôt.

Charte « chantier », propre au site (`src/app/(site)`, `src/components/site`, styles `site-*` de `src/app/globals.css`) : asphalte et papier kraft, jaune de signalisation, titres condensés (Archivo), libellés en chasse fixe comme une plaque constructeur (JetBrains Mono), rayures de balisage, quadrillage de plan. L'illustration de l'accroche est un tableau de parc en HTML et CSS (aucune image).

## Parcours d'une demande de démonstration

1. Le prospect remplit `/essai-gratuit` : société, nom, courriel professionnel (futur identifiant), téléphone, taille du parc, secteur, offre, message, accord de confidentialité.
   - Anti-robot sans captcha : champ piège invisible et délai minimal de 3 secondes (envoi ignoré sans le dire) ; 5 demandes par heure au plus depuis une même connexion (empreinte salée de l'adresse IP, jamais l'adresse).
   - Une seconde demande en attente pour le même courriel ne crée pas de doublon.
2. Les administrateurs de la plateforme (rôle Administrateur, et `PLATFORM_ADMIN_EMAILS` si renseignée) reçoivent une notification dans l'application et un courriel.
3. Administration → **Site commercial** → **Demandes de démo** : l'administrateur ouvre la demande et choisit
   - **Accepter** (nom de l'organisation, nom du contact, durée 7 / 14 / 30 / 60 jours) : l'organisation de démonstration est ouverte (société, site, atelier, magasin, familles d'engins), le compte de direction est créé avec un **mot de passe provisoire**, et le prospect reçoit un courriel avec le **lien de connexion**, son **identifiant** et ce **mot de passe provisoire**. Le mot de passe est aussi affiché une fois à l'administrateur, pour le dicter si le courriel n'arrive pas ;
   - **Refuser**, avec un motif et, au choix, un courriel au prospect ;
   - **Renvoyer les accès** (nouveau mot de passe provisoire) tant que le client ne s'est pas connecté ;
   - **Effacer** la demande (droit à l'effacement ; l'organisation ouverte n'est pas touchée).
4. Première connexion du prospect : il est conduit à `/premiere-connexion` et choisit son mot de passe (10 caractères au moins, différent du provisoire). Tant qu'il ne l'a pas fait, aucune autre page ni action de l'application n'est accessible ; ses autres sessions sont fermées ensuite.
5. Fin de la démonstration, prolongation, passage en abonnement : inchangés (Administration → Organisations clientes).

Les courriels passent par la file d'envoi habituelle (reprises, suivi). Ceux du site (alerte de demande, accès, refus) sont envoyés dès l'action, sans attendre le processus d'envoi ni la tâche quotidienne de Vercel. Sans `SMTP_HOST`, ils sont écrits dans le journal du serveur.

## Administration du contenu

Administration → **Site commercial** (administrateurs de la plateforme uniquement), avec un lien « Voir le site » :

| Onglet | Contenu |
| --- | --- |
| Demandes de démo | Liste filtrée par statut, fiche, décisions |
| Textes et réglages | Identité et contact, bandeau d'offre, accroche, titres des rubriques, essai et tarifs (durée proposée, remise annuelle), calculateur (hypothèse de réduction, prix de référence), formulaire, référencement. Un champ vidé reprend le texte d'origine |
| Chiffres clés, Secteurs, Fonctionnalités, Étapes, Témoignages, Questions fréquentes | Ajouter, modifier, publier ou masquer, monter ou descendre, supprimer. Une rubrique vide est masquée sur le site |
| Offres et tarifs | Nom, badge, accroche, prix mensuel (vide : sur devis), libellé du prix, condition, avantages (un par ligne), mise en avant, ordre |
| Pages | Pages libres sous `/infos/<adresse>` ; mise en forme simple : `## Titre`, `- liste`, `**gras**`, `[lien](https://…)` |

Chaque modification est tracée au journal d'audit. Le contenu initial (`src/server/domain/site-defaults.ts`) est chargé une seule fois dans une base neuve ; le supprimer ne le recharge pas.

## Proposition commerciale livrée (à valider et ajuster)

Les textes et prix livrés sont une proposition, modifiable dans l'administration :

- **Essai gratuit de 30 jours sur son propre espace**, sans carte bancaire, données conservées à la fin de l'essai ;
- **Prix par équipement suivi, utilisateurs illimités** : Atelier 7 € HT / équipement / mois (dès 10 équipements), Flotte 12 € HT (dès 20 équipements, mise en avant), Groupe sur devis ;
- **Paiement annuel : 2 mois offerts** (10 mois facturés sur 12) ;
- **Offre de lancement** dans le bandeau : −30 % la première année avant le 31 décembre 2026 ;
- **Calculateur du coût des pannes** : estimation indicative fondée sur les hypothèses du visiteur et une réduction de 25 % des journées d'immobilisation.

Les témoignages livrés sont des exemples **non publiés** : n'en publier qu'avec l'accord de vrais clients. Les mentions légales sont à compléter (éditeur).

## Code

| Élément | Emplacement |
| --- | --- |
| Règles pures (blocs, réglages, anti-robot, pages, prix, calculateur) | `src/server/domain/site.ts`, `site-defaults.ts`, `credentials.ts` (mot de passe provisoire) |
| Courriels | `renderDemoAccessEmail`, `renderDemoRequestEmail`, `renderDemoDeclinedEmail` (`src/server/domain/email.ts`) |
| Services | `src/server/services/site.ts` (contenu), `demo-requests.ts` (demandes), `account.ts` (première connexion), `provisionDemoTenant` (`platform.ts`) |
| Pages | `src/app/(site)`, `src/app/(auth)/premiere-connexion`, `src/app/(app)/administration/site` |
| Tables | `site_settings`, `site_items`, `site_plans`, `site_pages`, `demo_requests` ; colonne `user.must_change_password` (migration `0015_site_vitrine`) |
| Tests | `src/server/domain/__tests__/site.test.ts`, `e2e/site.spec.ts` |
