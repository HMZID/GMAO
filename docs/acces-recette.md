# Accès à la recette (environnement de développement)

Version en ligne : `develop` au commit `8bf7a4f` (GMAO-38 inclus), vérifiée le 16/10/2026.
Données de **démonstration uniquement** : ne jamais y saisir de vraies données.

## Adresses

| Quoi | Adresse |
| --- | --- |
| Site commercial (visiteur non connecté) | https://gmao-develop.vercel.app |
| Connexion à l'application | https://gmao-develop.vercel.app/login |
| Sonde de santé (version, environnement) | https://gmao-develop.vercel.app/api/health |
| Tarifs · Essai gratuit | https://gmao-develop.vercel.app/tarifs · https://gmao-develop.vercel.app/essai-gratuit |
| Pipeline de recette (relancer : *Run workflow*, branche `develop`) | https://github.com/HMZID/GMAO/actions/workflows/deploy-develop.yml |
| PR de mise en production `develop` → `main` | https://github.com/HMZID/GMAO/pull/49 |

## Comptes de démonstration

Mot de passe commun : **`Demo-Gmao-2026`**. Organisation « Groupe Démo BTP » : sociétés SBTP Travaux Publics (Dépôt Lyon, Agence Marseille) et LocaEngins Alpes (Dépôt Grenoble).

| Profil | Courriel | Nom | Périmètre | Pour tester |
| --- | --- | --- | --- | --- |
| Administrateur de la plateforme | `admin@demo.gmao` | Alice Martin | Toute la plateforme | Organisations clientes, démonstrations, « se connecter en tant que », Administration › Site (contenu, tarifs, **demandes d'essai**) |
| Direction | `direction@demo.gmao` | Hélène Garnier | Tout le groupe | Organisation, utilisateurs, imports, exports, connecteur, indicateurs |
| Responsable maintenance | `resp.maintenance@demo.gmao` | Karim Benali | Tout le groupe | Préventif, planning, validations, inventaire (validation des écarts) |
| Gestionnaire de flotte | `flotte@demo.gmao` | Sophie Durand | Société SBTP | Affectations, compteurs |
| Chef d'atelier Lyon | `chef.lyon@demo.gmao` | Marc Lefèvre | Site Dépôt Lyon | Qualification des DI, OT, planification, remise en service |
| Chef d'atelier Grenoble | `chef.grenoble@demo.gmao` | Yanis Ferhat | Site Dépôt Grenoble | Cloisonnement entre sociétés |
| Technicien Lyon | `tech.lyon@demo.gmao` | Julien Moreau | Site Dépôt Lyon | Exécution des OT |
| Technicienne Lyon | `tech2.lyon@demo.gmao` | Nadia Haddad | Site Dépôt Lyon | Exécution des OT |
| Technicien Grenoble | `tech.grenoble@demo.gmao` | Lucas Bernard | Site Dépôt Grenoble | Exécution des OT |
| Conducteur | `conducteur@demo.gmao` | Paul Girard | Site Dépôt Lyon | Signalement d'une panne |
| Magasinier | `magasin@demo.gmao` | Claire Petit | Société SBTP | Stock, mouvements, inventaire, demandes d'achat |
| Responsable achats | `achats@demo.gmao` | Thomas Roux | Tout le groupe | Fournisseurs, validation des achats |

Administrateurs de la plateforme en recette : `admin@demo.gmao` et `hassan.mzid@gmail.com` (ce dernier seulement si un compte existe à cette adresse dans la base de recette).

## Bon à savoir

- **Demande d'essai** : elle arrive « en attente » dans Administration › Site › Demandes (compte `admin@demo.gmao`). À la validation, le mot de passe provisoire s'affiche à l'écran ; aucun courriel ne part en recette (pas de serveur d'envoi), le message prévu est visible dans Administration › Courriels.
- **Connexion limitée** : 5 échecs pour un même compte en 15 minutes bloquent ce compte pendant 15 minutes.
- **CAPTCHA** : inactif tant que les clés Turnstile ne sont pas déclarées dans Vercel (portée Preview).
- **Données remises à zéro** : uniquement si la base `gmao_dev` est vidée ; un redéploiement ne recharge pas la démonstration.
- **Où sont les réglages** (aucun secret dans ce fichier) : Vercel → projet `gmao` → Settings → Environment Variables (portée *Preview*) ; Neon → projet GMAO → branche `develop`, base `gmao_dev` ; GitHub → Settings → Secrets and variables → Actions.

Ce fichier n'est pas commité : il reste sur ce poste.
