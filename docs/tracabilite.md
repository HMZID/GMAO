# Traçabilité des exigences

Couverture de chaque exigence du cahier des charges (`cahier-des-charges.md`) par ce dépôt. À tenir à jour à chaque évolution : une exigence passe à « Fait » quand son critère d'acceptation est vérifié par un test ou un scénario de recette.

Statuts : **Fait** (critère d'acceptation couvert), **Partiel** (l'essentiel est en place, le reste est précisé), **À faire**, ou la phase prévue au §14.3 pour les exigences hors MVP. La colonne MVP signale les exigences du lot MVP (§14.1).

## Synthèse

| | Fait | Partiel | À faire | Phases suivantes | Total |
| --- | --- | --- | --- | --- | --- |
| Exigences du MVP | 59 | 33 | 11 | 0 | 103 |
| Toutes les exigences | 65 | 44 | 11 | 43 | 163 |

Vérification : 70 tests unitaires des règles métier (`npm test`) et 14 tests de bout en bout (`npm run test:e2e`), dont le cycle complet d'une panne (scénario R-02) et le remplacement de compteur (R-05).

## Habilitations (HAB)

| Exigence | Priorité | MVP | Statut | Couverture et reste à faire | Code |
| --- | --- | --- | --- | --- | --- |
| **HAB-01** Rôles paramétrables | Must | oui | Partiel | Rôles attribuables par l'administrateur, cumulables, par périmètre ; la matrice rôle → droits est figée dans le code. | `src/server/authz/permissions.ts`, `src/app/(app)/administration/utilisateurs` |
| **HAB-02** Cloisonnement par périmètre | Must | oui | Fait | Périmètre appliqué à toutes les listes, recherches et API ; hors périmètre = introuvable. | `src/server/services/_shared.ts (scopeWhere)`, `src/server/pages.ts` |
| **HAB-03** Cumul et délégation | Should |  | Fait | Rôles cumulés, délégation bornée dans le temps (validFrom, validTo). | `src/server/authz/context.ts` |
| **HAB-04** Circuits de validation | Must | oui | Fait | Circuits paramétrables par type d'objet (DI, demande d'achat, dépense de maintenance) et par société : étapes ordonnées, rôle valideur dans le périmètre de l'objet ou personne nommée, seuils financiers, priorités, suppléants datés. Étapes figées à la soumission, décision tracée (auteur, date, commentaire obligatoire en cas de refus), demandeur exclu, un valideur par étape. Restent : relances et escalades automatiques (NOT-02). Validations existantes conservées : remise en service, écart d'inventaire. | `src/server/services/approvals.ts`, `src/server/domain/approvals.ts`, `e2e/approvals.spec.ts` |
| **HAB-05** Séparation des tâches | Must | oui | Partiel | Le technicien exécutant ne peut pas valider la remise en service d'un équipement A. Demandes d'achat : avec le flux achats. | `src/server/domain/work-order-status.ts` |
| **HAB-06** Journal d'audit | Must | oui | Fait | Journal en ajout seul écrit dans la transaction de chaque modification, avec le canal ; consultation filtrable. | `src/server/services/_shared.ts (audit)`, `src/app/(app)/administration/journal` |
| **HAB-07** Accès prestataire | Should |  | Partiel | Rôle Prestataire externe et ses droits ; portail restreint aux OT confiés à construire. | `src/server/authz/permissions.ts` |
| **HAB-08** Désactivation sans perte | Must | oui | Fait | Désactivation sans suppression, sessions fermées, connexion refusée. | `src/server/services/users.ts`, `src/server/auth/auth.ts` |
| **HAB-09** Revue des habilitations | Should |  | Phase 2 | Revue périodique des habilitations (campagne, export signé). |  |

## Équipements (EQP)

| Exigence | Priorité | MVP | Statut | Couverture et reste à faire | Code |
| --- | --- | --- | --- | --- | --- |
| **EQP-01** Fiche équipement | Must | oui | Fait | Fiche complète, création et modification. | `src/app/(app)/equipements/`, `src/server/services/equipment.ts` |
| **EQP-02** Unicité et anti-doublon | Must | oui | Fait | Code parc unique, doublon marque + n° de série et immatriculation refusés. | `src/server/services/equipment.ts` |
| **EQP-03** Catégories et attributs | Should |  | Partiel | Catégories et modèles ; attributs par catégorie définis et affichés, saisie à ajouter au formulaire. | `src/app/(app)/administration/referentiel` |
| **EQP-04** Compteurs multiples | Must | oui | Partiel | Modèle de données multi-compteurs (unité, principal) ; l'écran ne crée que le compteur principal. | `src/server/services/meters.ts` |
| **EQP-05** États opérationnels | Must | oui | Fait | Cinq états historisés, distincts du statut des OT. | `src/server/services/equipment-status.ts` |
| **EQP-06** Criticité | Must | oui | Fait | Criticité héritée de la catégorie ; A relève la priorité et impose la validation de remise en service. | `src/server/services/work-requests.ts` |
| **EQP-07** Documents et photos | Must | oui | Fait | Documents et photos sur les fiches équipement et OT : types, expiration facultative, format et contenu contrôlés, taille paramétrable, stockage local ou S3, droits, audit ; alerte par courriel à J-30, J-7 et à l'échéance (§11.1). | `src/server/services/documents.ts`, `src/server/storage`, `src/server/services/email.ts`, `e2e/documents.spec.ts` |
| **EQP-08** Sous-ensembles | Should |  | Phase 2 | Sous-ensembles (table prévue). |  |
| **EQP-09** QR code et code-barres | Must | oui | Partiel | Jeton QR par équipement et résolution par l'API ; impression des étiquettes et scan mobile à faire. | `src/app/api/v1/equipment/by-qr` |
| **EQP-10** Historique des affectations | Must | oui | Fait | Affectations historisées, une seule active, sans chevauchement. | `src/server/services/equipment.ts` |
| **EQP-11** Historique des compteurs | Must | oui | Fait | Historique des relevés et des remplacements de compteur. | `src/server/services/meters.ts` |
| **EQP-12** Garanties et contrats | Should |  | Partiel | Fin de garantie (date ou compteur) sur la fiche ; contrats à faire. |  |
| **EQP-13** Import en masse | Must | oui | Fait | Import Excel des équipements, articles et stocks initiaux : modèle téléchargeable, simulation avec les contrôles de la saisie, rapport ligne par ligne (écran et Excel), « tout ou rien » ou « lignes valides », réimportation sans doublon. Import CSV non proposé. | `src/server/services/imports.ts`, `src/server/domain/imports.ts`, `e2e/imports.spec.ts` |
| **EQP-14** Réforme | Should |  | Partiel | Réforme refusée avec OT ouvert, plans désactivés, fiche en lecture seule ; circuit de validation à faire. | `src/server/services/equipment.ts` |
| **EQP-15** Dernière position | Could |  | Phase 3 | Dernière position (télématique). |  |

## Préventif (PRV)

| Exigence | Priorité | MVP | Statut | Couverture et reste à faire | Code |
| --- | --- | --- | --- | --- | --- |
| **PRV-01** Plans types et surcharge | Must | oui | Partiel | Plans par catégorie ou modèle appliqués à la création, version incrémentée à chaque ajout d'opération ; surcharge locale à faire. | `src/server/services/preventive.ts` |
| **PRV-02** Déclencheurs date et compteur | Must | oui | Fait | Déclencheurs calendaire et compteur. | `src/server/domain/preventive.ts` |
| **PRV-03** Premier seuil atteint | Must | oui | Fait | Premier seuil atteint (testé sur l'exemple du CDC §4.4). | `src/server/domain/__tests__/preventive.test.ts` |
| **PRV-04** Mode fixe ou glissant | Must | oui | Fait | Modes fixe et glissant. | `src/server/domain/preventive.ts (nextBaseline)` |
| **PRV-05** Paliers imbriqués | Should |  | Phase 2 | Paliers imbriqués (statut « soldée par palier » prévu). |  |
| **PRV-06** Pré-alertes | Must | oui | Fait | Pré-alertes en jours et en compteur. | `src/server/domain/preventive.ts` |
| **PRV-07** Projection des échéances compteur | Should |  | Fait | Projection par l'usage moyen sur 30 jours. | `src/server/domain/meters.ts`, `src/server/domain/preventive.ts` |
| **PRV-08** Génération automatique des OT | Must | oui | Partiel | Génération idempotente avec la checklist, depuis l'écran ou l'API ; tâche planifiée quotidienne à brancher, pièces de gamme à reprendre sur l'OT. | `src/server/services/preventive.ts` |
| **PRV-09** Retards et tolérances | Must | oui | Fait | Tolérance en % de l'intervalle, statut « en retard ». | `src/server/domain/preventive.ts` |
| **PRV-10** Report et replanification | Must | oui | Partiel | Report daté et motivé, interdit au-delà de l'échéance légale d'un contrôle réglementaire ; validation au-delà de la tolérance à faire. | `src/server/services/preventive.ts` |
| **PRV-11** Gammes et checklists | Must | oui | Fait | Checklists obligatoires, mesures avec bornes (hors bornes = non conforme). | `src/server/services/work-orders.ts` |
| **PRV-12** Contrôles réglementaires | Must | oui | Fait | Contrôle réglementaire échu bloquant : équipement immobilisé jusqu'à la réalisation. | `src/server/services/preventive.ts`, `src/server/services/equipment-status.ts` |
| **PRV-13** Suspension des plans | Should |  | Phase 2 | Suspension d'un plan (colonnes prévues). |  |
| **PRV-14** Regroupement d'opérations | Could |  | Phase 3 |  |  |
| **PRV-15** Prévision de charge | Could |  | Phase 3 |  |  |

## Correctif et OT (COR)

| Exigence | Priorité | MVP | Statut | Couverture et reste à faire | Code |
| --- | --- | --- | --- | --- | --- |
| **COR-01** Signalement rapide | Must | oui | Partiel | Signalement web en quelques champs, priorité proposée ; saisie mobile avec photo à faire. | `src/app/(app)/demandes/nouvelle` |
| **COR-02** Détection des doublons | Should |  | Fait | DI et OT ouverts sur le même équipement signalés, rattachement possible. | `src/server/services/work-requests.ts` |
| **COR-03** Qualification | Must | oui | Fait | Qualification (priorité, type, immobilisation), rejet motivé avec notification. | `src/app/(app)/demandes/[id]` |
| **COR-04** Codification des défauts | Should |  | Partiel | Codes symptôme, cause, remède en saisie libre ; listes de référence à faire. |  |
| **COR-05** Ordres de travail | Must | oui | Fait | OT depuis une DI, le préventif ou en création directe ; numérotation par société et par an. | `src/server/services/work-orders.ts` |
| **COR-06** Statuts et transitions | Must | oui | Fait | Machine à états complète, transitions interdites refusées (API comprise). | `src/server/domain/work-order-status.ts` |
| **COR-07** État de l'équipement distinct | Must | oui | Fait | État de l'équipement distinct, immobilisations datées. | `src/server/services/equipment-status.ts` |
| **COR-08** Affectation des intervenants | Must | oui | Fait | Intervenants internes ou prestataire. | `src/app/(app)/ordres-de-travail/[id]` |
| **COR-09** Saisie du temps | Must | oui | Fait | Chronomètre ou durée saisie, un pointage à la fois par technicien. | `src/server/services/work-orders.ts (recordTime)` |
| **COR-10** Pièces consommées | Must | oui | Fait | Réservation, sortie et retour de pièces sur l'OT. | `src/server/services/stock.ts` |
| **COR-11** Compte rendu | Must | oui | Fait | Compte rendu et relevé de compteur obligatoires pour terminer les travaux. | `src/server/domain/work-order-status.ts` |
| **COR-12** Validation de remise en service | Must | oui | Fait | Validation par une personne habilitée, différente de l'exécutant, pour les équipements A et la sécurité. | `src/server/domain/work-order-status.ts` |
| **COR-13** Clôtures technique et administrative | Must | oui | Fait | Clôture technique puis administrative (coût prestataire requis). | `src/server/domain/work-order-status.ts` |
| **COR-14** Réouverture et récidive | Should |  | Fait | Réouverture motivée sous 7 jours, puis OT de récidive lié. | `src/server/domain/work-order-status.ts` |
| **COR-15** OT externe simple | Must | oui | Fait | OT externe : prestataire, provision puis montant facturé. | `src/server/services/work-orders.ts (setExternalCost)` |
| **COR-16** Garanties | Should |  | Phase 2 |  |  |
| **COR-17** Sinistres | Could |  | Phase 3 | Type d'OT « accident / sinistre » prévu. |  |

## Planification (PLA)

| Exigence | Priorité | MVP | Statut | Couverture et reste à faire | Code |
| --- | --- | --- | --- | --- | --- |
| **PLA-01** Calendrier des interventions | Must | oui | Fait | Planning hebdomadaire par technicien, navigation par semaine et par site. | `src/app/(app)/planning/` |
| **PLA-02** Disponibilité des techniciens | Must | oui | Fait | Absences saisies, bloquantes à la planification, déduites de la capacité. | `src/server/services/work-orders.ts (updatePlanning)` |
| **PLA-03** Compétences et habilitations | Should |  | Partiel | Compétences et habilitations enregistrées et affichées (échéances) ; non vérifiées à l'affectation. | `src/app/(app)/administration/techniciens` |
| **PLA-04** Charge et capacité | Should |  | Fait | Capacité nette avec réserve d'urgence, charge par technicien, carnet à planifier. | `src/server/services/planning.ts` |
| **PLA-05** Interventions sur chantier | Should |  | Partiel | Chantier porté par l'OT ; organisation des interventions sur chantier à faire. |  |
| **PLA-06** Urgences | Must | oui | Partiel | P1 proposée et notifiée en urgence ; proposition des OT à décaler et notification des décalages à faire. |  |
| **PLA-07** Détection des conflits | Must | oui | Fait | Absence = blocage, chevauchement = avertissement. | `src/server/services/work-orders.ts (updatePlanning)` |
| **PLA-08** Atelier et postes | Should |  | Partiel | Ateliers et nombre de postes ; affectation à un poste à faire. |  |
| **PLA-09** Outillage spécial | Could |  | Phase 3 |  |  |
| **PLA-10** Optimisation de tournées | Could |  | Phase 3 |  |  |

## Stocks (STK)

| Exigence | Priorité | MVP | Statut | Couverture et reste à faire | Code |
| --- | --- | --- | --- | --- | --- |
| **STK-01** Catalogue articles | Must | oui | Fait | Catalogue sans doublon (référence interne, fabricant + référence fabricant). | `src/server/services/stock.ts` |
| **STK-02** Compatibilités et alternatives | Should |  | Phase 2 | Compatibilités (table prévue). |  |
| **STK-03** Magasins et emplacements | Must | oui | Partiel | Magasins fixes et mobiles, un emplacement par défaut ; gestion des emplacements à faire. |  |
| **STK-04** Mouvements | Must | oui | Fait | Réception, sortie, retour, transfert, ajustement, rebut. | `src/app/(app)/stock/mouvements` |
| **STK-05** Réservations | Must | oui | Fait | Réservations sur OT, libérées à l'annulation. | `src/server/services/stock.ts` |
| **STK-06** Transferts | Should |  | Partiel | Transfert immédiat ; transit en deux temps à faire. |  |
| **STK-07** Inventaires | Must | oui | Partiel | Ajustement d'inventaire, validation exigée au-delà du seuil (refusé sans le droit) ; inventaires complets et tournants, écarts « à valider », saisie mobile à faire. | `src/server/services/stock.ts` |
| **STK-08** Seuils et alertes | Must | oui | Partiel | Mini, point de commande, maxi par magasin, articles « à commander » et compteur au tableau de bord ; alerte au magasinier et à l'acheteur à faire. | `src/app/(app)/stock/articles/[id]` |
| **STK-09** Proposition de réapprovisionnement | Could |  | Phase 3 |  |  |
| **STK-10** Numéros de série et lots | Should |  | Phase 2 | Mode de suivi (quantité, lot, série) prévu sur l'article. |  |
| **STK-11** Montage et démontage | Should |  | Phase 2 |  |  |
| **STK-12** Réparables | Should |  | Partiel | Indicateur « réparable » sur l'article ; circuit de réparation à faire. |  |
| **STK-13** Échanges standard | Should |  | Phase 2 |  |  |
| **STK-14** Intégrité des stocks | Must | oui | Fait | Verrou de ligne, stock physique jamais négatif, idempotence par clientId. | `src/server/services/stock.ts` |
| **STK-15** Valorisation | Must | oui | Fait | Coût moyen pondéré recalculé à chaque réception. | `src/server/domain/stock.ts` |

## Achats (ACH)

| Exigence | Priorité | MVP | Statut | Couverture et reste à faire | Code |
| --- | --- | --- | --- | --- | --- |
| **ACH-01** Demandes d'achat | Should | oui | Partiel | Demande manuelle ou depuis l'OT, rattachement obligatoire à un OT, un équipement ou un centre de coût, visible dans l'OT avec son statut. Restent : création depuis une alerte de seuil, commande, réception, facture (ACH-03 à ACH-06). | `src/server/services/purchase-requests.ts` |
| **ACH-02** Validation | Should | oui | Fait | Circuit « demande d'achat » : responsable achats, puis direction au-delà du seuil ; le demandeur ne valide pas sa demande. | `src/server/services/approvals.ts` |
| **ACH-03** Devis | Should |  | Phase 2 |  |  |
| **ACH-04** Commandes | Should |  | Phase 2 |  |  |
| **ACH-05** Réceptions | Should |  | Phase 2 |  |  |
| **ACH-06** Rapprochement des factures | Should |  | Phase 2 |  |  |
| **ACH-07** Contrats de maintenance | Should |  | Phase 2 |  |  |
| **ACH-08** Suivi des délais | Should |  | Phase 2 |  |  |
| **ACH-09** Évaluation des prestataires | Could |  | Phase 2 |  |  |
| **ACH-10** Imputation des coûts | Must | oui | Partiel | Coûts de prestation imputés à l'OT et à l'équipement ; imputation aux centres de coûts et rapprochement facture à faire. | `src/server/services/work-orders.ts`, `src/server/services/kpi.ts` |

## Indicateurs (KPI)

| Exigence | Priorité | MVP | Statut | Couverture et reste à faire | Code |
| --- | --- | --- | --- | --- | --- |
| **KPI-01** Coût complet par OT | Must | oui | Fait | Coût complet par OT : main-d'œuvre, pièces, prestataire, autres. | `src/server/services/work-orders.ts (costSummary)` |
| **KPI-02** Taux horaires datés | Must | oui | Fait | Taux horaires datés, appliqués à la date du pointage. | `src/server/db/schema/resources.ts (labor_rates)` |
| **KPI-03** Disponibilité et immobilisations | Must | oui | Fait | Disponibilité et immobilisations par période, catégorie, équipement. | `src/server/services/kpi.ts` |
| **KPI-04** MTBF, MTTR, MDT | Must | oui | Fait | MTBF, MTTR (attentes déduites), MDT, seuil de signification. | `src/server/domain/kpi.ts` |
| **KPI-05** Préventif et retards | Must | oui | Fait | Respect du préventif et échéances en retard. | `src/server/services/kpi.ts` |
| **KPI-06** Pannes récurrentes | Should |  | Phase 2 | Dépend de la codification des défauts. |  |
| **KPI-07** Pièces et ruptures | Must | oui | Partiel | Consommations de pièces ; taux de service et OT en attente de pièces à ajouter. | `src/app/(app)/indicateurs/` |
| **KPI-08** Budget et réalisé | Should |  | Phase 2 |  |  |
| **KPI-09** Réparer ou remplacer | Should |  | Phase 3 | Fonction de calcul prête dans le domaine. | `src/server/domain/kpi.ts (repairOrReplaceRatio)` |
| **KPI-10** Tableaux de bord par profil | Must | oui | Partiel | Tableau de bord filtré par droits et périmètre, liens vers les listes ; vues propres à chaque profil à faire. | `src/app/(app)/page.tsx` |
| **KPI-11** Export et outils de BI | Should |  | Phase 3 |  |  |
| **KPI-12** Calculs documentés | Must | oui | Fait | Conventions de calcul documentées (écran Indicateurs, docs/architecture.md, tests). | `src/server/domain/kpi.ts` |
| **KPI-13** Fraîcheur des données | Must | oui | Fait | Calcul à la demande sur les données du moment. |  |

## Mobile (MOB)

| Exigence | Priorité | MVP | Statut | Couverture et reste à faire | Code |
| --- | --- | --- | --- | --- | --- |
| **MOB-01** Application iOS et Android | Must | oui | Partiel | Application Expo (React Native) : onglets selon les droits de `GET /api/v1/me`, mêmes droits et périmètres que le web. Restent : contrôle de prise de poste, réception, transfert et inventaire du magasinier, qualification des DI par le chef d'atelier sur mobile. | `mobile/` |
| **MOB-02** Scan | Must | oui | Fait | Lecture QR code et code-barres par la caméra (`expo-camera`) ; code inconnu signalé sans bloquer ; équipements déjà consultés retrouvés hors connexion. | `mobile/src/app/(tabs)/scan.tsx`, `mobile/src/lib/qr.ts` |
| **MOB-03** Demandes d'intervention | Must | oui | Partiel | Signalement en un écran depuis la fiche équipement, hors connexion, idempotent. Reste : suivi du statut de ses DI sur mobile. | `mobile/src/app/request/new.tsx` |
| **MOB-04** Relevé de compteurs | Must | oui | Fait | Relevé depuis la fiche équipement ou l'OT ; un relevé inférieur au précédent est signalé avant envoi ; contrôles DON-01 à DON-03 au serveur. | `mobile/src/app/equipment/[id].tsx` |
| **MOB-05** Checklists, photos, comptes rendus | Must | oui | Fait | Checklist (OK / NOK / N/A, mesures), diagnostic (symptôme, cause, remède) et compte rendu, photos compressées (1 920 px) envoyées après les données ; points obligatoires contrôlés par le serveur à « Travaux terminés ». | `mobile/src/app/work-order/[id].tsx` |
| **MOB-06** Temps et pièces | Must | oui | Partiel | Temps passé (raccourcis) et pièces consommées (article, magasin, quantité), idempotents ; stock jamais négatif, refus affiché « à revoir ». Reste : consommation par scan de l'article. | `mobile/src/app/work-order/[id].tsx` |
| **MOB-07** Hors connexion | Must | oui | Partiel | Saisies hors connexion (DI, relevés, checklist, compte rendu, temps, pièces, photos, transitions) et consultation des données déjà vues ; bandeau permanent (connexion, dernière synchronisation, saisies en attente). Restent : préchargement complet du périmètre et essai d'autonomie de 7 jours. | `mobile/src/lib/sync.ts`, `mobile/src/context/sync.tsx` |
| **MOB-08** Synchronisation sans doublon | Must | oui | Fait | `clientId` à la création, envoi dans l'ordre, photos en dernier, succès retirés aussitôt de la file, transition déjà appliquée reconnue ; vérifié contre le serveur avec coupure réseau et renvoi en double. | `mobile/src/lib/sync.ts`, `mobile/scripts/verify-sync.ts` |
| **MOB-09** Gestion des conflits | Must | oui | Partiel | Refus du serveur (droit, règle, stock insuffisant, OT annulé) : saisie « à revoir » avec motif, relancée ou abandonnée par l'utilisateur, jamais perdue. Restent : règles du tableau §10.4 côté serveur (mouvement « à régulariser », pointage « à vérifier », alerte au chef d'atelier). | `mobile/src/app/(tabs)/sync.tsx` |
| **MOB-10** Inventaire mobile | Should |  | Phase 2 |  |  |
| **MOB-11** Signature | Should |  | Phase 2 |  |  |
| **MOB-12** Dictée vocale | Could |  | Phase 3 |  |  |
| **MOB-13** Sécurité du terminal | Must | oui | Partiel | Jeton dans le trousseau chiffré du système, cache effacé à la déconnexion, HTTPS en production. Restent : chiffrement du cache, code ou biométrie, durée hors connexion limitée, effacement à distance. | `mobile/src/lib/storage.ts` |

## Notifications (NOT)

| Exigence | Priorité | MVP | Statut | Couverture et reste à faire | Code |
| --- | --- | --- | --- | --- | --- |
| **NOT-01** Règles de notification | Must | oui | Partiel | Notifications dans l'application et par courriel selon les droits et le périmètre ; préférences par utilisateur ; file d'envoi transactionnelle, envoi en arrière-plan avec reprises, clé anti-doublon par événement, suivi et relance par l'administrateur. Reste : règles paramétrables par l'administrateur (événement, condition, destinataires, canaux), notification mobile. | `src/server/services/notifications.ts`, `src/server/services/email.ts`, `scripts/worker.ts`, `e2e/notifications.spec.ts` |
| **NOT-02** Escalade | Must | oui | À faire | Escalade. |  |
| **NOT-03** Notifications par défaut | Must | oui | Partiel | Livré, dans l'application et par courriel : DI P1 (obligatoire), validation en attente et remise en service à valider (obligatoires), décision sur une demande, affectation à un OT, échéances en pré-alerte, préventifs en retard et OT en attente depuis plus de 5 jours, articles sous le point de commande, documents arrivant à échéance. Restent : pièce réservée reçue, compteur non relevé, échec d'interface, escalades (NOT-02). | `src/server/domain/email.ts` |
| **NOT-04** Récapitulatif quotidien | Should | oui | Fait | Récapitulatifs quotidiens des échéances, retards et alertes de stock : un courriel par destinataire et par jour, à partir de l'heure paramétrée (`EMAIL_DIGEST_HOUR`). | `src/server/services/email.ts` |
| **NOT-05** SMS et messagerie d'équipe | Could |  | Phase 3 |  |  |

## Intégrations (INT)

| Exigence | Priorité | MVP | Statut | Couverture et reste à faire | Code |
| --- | --- | --- | --- | --- | --- |
| **INT-01** Imports et exports | Must | oui | Partiel | Imports Excel des équipements, articles et stocks initiaux (voir EQP-13), aussi par l'API (`/api/v1/imports`). Reste : autres modèles du §11.2 (compteurs, plans, fournisseurs, utilisateurs…), import CSV, exports filtrés des listes. | `src/app/api/v1/imports` |
| **INT-02** API ouverte | Must | oui | Fait | API REST v1 : mêmes règles et droits que les écrans, idempotence, catalogue public (GET /api/v1). | `src/app/api/v1`, `src/server/api/catalog.ts` |
| **INT-03** Authentification unique | Must | oui | Partiel | SSO Microsoft Entra ID activable par configuration, sans création implicite de compte ; à recetter sur le tenant de l'entreprise. | `src/server/auth/auth.ts` |
| **INT-04** ERP et comptabilité | Should |  | Phase 2 |  |  |
| **INT-05** Télématique | Should |  | Phase 3 | Source « télématique » des relevés déjà gérée (mise « à vérifier » si incohérente). |  |
| **INT-06** Supervision des interfaces | Should |  | Phase 2 |  |  |
| **INT-07** GPS et zones de chantier | Could |  | Phase 3 |  |  |
| **INT-08** Maintenance conditionnelle | Could |  | Phase 3 |  |  |
| **INT-09** Maintenance prédictive | Won't |  | Phase 4 |  |  |

## Technique (TEC)

| Exigence | Priorité | MVP | Statut | Couverture et reste à faire | Code |
| --- | --- | --- | --- | --- | --- |
| **TEC-01** Web et mobile | Must | oui | Partiel | Application web responsive ; application mobile à faire. |  |
| **TEC-02** Isolation des clients | Must | oui | Fait | tenant_id sur toutes les tables métier, contrôlé dans chaque service. |  |
| **TEC-03** Cloisonnement des sociétés | Must | oui | Fait | Périmètres société et site. | `src/server/authz/context.ts` |
| **TEC-04** Authentification | Must | oui | Partiel | Mot de passe (10 caractères minimum), SSO, sessions de 12 h ; double facteur obligatoire pour les administrateurs à faire. | `src/server/auth/auth.ts` |
| **TEC-05** Journal d'audit | Must | oui | Fait | Journal d'audit sans API de modification ni de suppression. |  |
| **TEC-06** Chiffrement | Must | oui | À faire | Chiffrement en transit et au repos : configuration d'hébergement. |  |
| **TEC-07** Sauvegarde et restauration | Must | oui | À faire | Sauvegardes et tests de restauration : exploitation. |  |
| **TEC-08** Disponibilité | Must | oui | Partiel | Sonde de santé /api/health ; supervision et engagements de disponibilité : exploitation. | `src/app/api/health` |
| **TEC-09** API documentée | Must | oui | Fait | Catalogue des points d'entrée avec schémas JSON générés depuis la validation. | `src/server/api/catalog.ts` |
| **TEC-10** Performance | Must | oui | À faire | Index en place ; mesures de performance à réaliser. |  |
| **TEC-11** Volumétrie et montée en charge | Should |  | Avant déploiement général |  |  |
| **TEC-12** Sécurité applicative | Must | oui | Partiel | Validation de toutes les entrées, droits contrôlés côté serveur, Server Actions protégées par l'origine ; revue de sécurité et test d'intrusion à faire. |  |
| **TEC-13** Données personnelles | Must | oui | À faire | Registre, durées de conservation, purge. |  |
| **TEC-14** Réversibilité | Must | oui | Partiel | PostgreSQL standard et API complète ; export de réversibilité outillé à faire. |  |
| **TEC-15** Paramétrage sans code | Should |  | Partiel | Organisation, utilisateurs, référentiels et plans paramétrables à l'écran. | `src/app/(app)/administration/` |
| **TEC-16** Hébergement sur site | Could |  | Option | Déploiement autonome possible (Node.js + PostgreSQL). |  |

## Règles de données (DON)

| Exigence | Priorité | MVP | Statut | Couverture et reste à faire | Code |
| --- | --- | --- | --- | --- | --- |
| **DON-01** Compteurs croissants | Must | oui | Fait | Relevé inférieur au précédent refusé en saisie manuelle. | `src/server/domain/meters.ts` |
| **DON-02** Plausibilité | Must | oui | Fait | Écart invraisemblable mis « à vérifier », validation ou rejet par un rôle habilité. | `src/server/domain/meters.ts`, `src/server/services/meters.ts (reviewReading)` |
| **DON-03** Relevés datés et sourcés | Must | oui | Fait | Relevés datés, sourcés (saisie, OT, télématique, import), relevé futur refusé. | `src/server/domain/meters.ts` |
| **DON-04** Remplacement de compteur | Must | oui | Fait | Remplacement de compteur avec usage cumulé conservé (scénario R-05). | `src/server/services/meters.ts (replaceMeter)` |
| **DON-05** Correction de relevé | Must | oui | Partiel | Traitement des relevés « à vérifier » ; correction motivée d'un relevé déjà validé à faire. | `src/server/services/meters.ts` |
| **DON-06** Conservation de l'historique | Must | oui | Fait | Aucune suppression des objets métier : désactivation, annulation, réforme. |  |
| **DON-07** Remise en service d'un équipement critique | Must | oui | Fait | Remise en service d'un équipement critique validée par une personne habilitée. | `src/server/domain/work-order-status.ts` |
| **DON-08** OT annulé | Must | oui | Fait | Annulation motivée, refusée si du temps ou des pièces sont imputés. | `src/server/domain/work-order-status.ts` |
| **DON-09** OT reporté | Must | oui | Partiel | Replanification tracée dans le journal ; historique des reports avec motif à faire. |  |
| **DON-10** OT rouvert | Should |  | Fait | Réouverture motivée, compteur de réouvertures, historique des statuts. |  |
| **DON-11** Données obligatoires par étape | Must | oui | Fait | Toutes les conditions manquantes renvoyées en une fois, écran et API. | `src/server/domain/work-order-status.ts` |
| **DON-12** Doublons | Must | oui | Fait | Doublons refusés : équipements, articles, fournisseurs (identifiant fiscal), comptes. |  |
| **DON-13** Affectation unique | Must | oui | Fait | Une seule affectation active, pas de chevauchement. | `src/server/services/equipment.ts` |
| **DON-14** Équipement réformé | Must | oui | Fait | Équipement réformé en lecture seule, ni DI, ni OT, ni relevé. |  |
| **DON-15** Clôture de période | Should |  | Phase 2 |  |  |
| **DON-16** Horodatage | Must | oui | Fait | Horodatages avec fuseau, affichage et saisie en Europe/Paris. | `src/server/validation.ts`, `src/lib/format.ts` |
