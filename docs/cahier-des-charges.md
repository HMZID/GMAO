# Cahier des charges GMAO – Engins, véhicules et équipements

Oct 7, 2026 · @Hassan MZID

## Objet du document et conventions

Ce cahier des charges décrit la GMAO cible pour une ou plusieurs sociétés exploitant des engins de chantier, véhicules, machines industrielles et équipements mobiles. Il sert de base commune à la consultation des prestataires, au chiffrage et à la conception de la solution.

Les valeurs chiffrées que l'entreprise n'a pas fournies (délais, seuils, volumétries, taux de disponibilité) sont des **propositions marquées \[AC\] — à confirmer** en atelier de cadrage. Aucune contrainte propre à l'entreprise n'est supposée acquise.

### Format des exigences

Chaque exigence majeure est présentée sous la forme : **Identifiant | Besoin | Description | Priorité | Règle métier | Critère d'acceptation**. Les identifiants sont préfixés par domaine (HAB, EQP, PRV, COR, PLA, STK, ACH, KPI, MOB, NOT, INT, TEC, DON).

| Priorité | Signification | Conséquence pour le prestataire |
| --- | --- | --- |
| Must | Indispensable : sans elle, la solution n'est pas recevable | Incluse dans le chiffrage de base et dans le MVP sauf mention contraire |
| Should | Importante, attendue, peut être décalée en phase 2 si justifié | Chiffrée séparément, planning de livraison indiqué |
| Could | Souhaitable si le budget le permet | Chiffrée en option |
| Won't | Exclue de cette version | Non chiffrée, mais l'architecture ne doit pas l'empêcher |

Pour chaque exigence, le prestataire indique : **Standard** (disponible sans développement), **Paramétrage**, **Développement spécifique** (avec charge en jours) ou **Non couvert**.

### Vocabulaire

| Terme | Définition |
| --- | --- |
| Équipement | Tout bien maintenu et suivi individuellement : engin, véhicule, machine, groupe électrogène, chariot, outillage lourd |
| Sous-ensemble | Partie maintenable d'un équipement, suivie séparément (moteur, transmission, circuit hydraulique, pneus, batterie, godet) |
| Compteur | Grandeur d'usage relevée : kilomètres, heures moteur, cycles, litres, heures prise de force, etc. |
| Plan d'entretien | Ensemble d'opérations préventives avec leurs déclencheurs, rattaché à une catégorie, un modèle ou un équipement |
| Gamme | Mode opératoire d'une opération : tâches, checklist, pièces, durée, compétences, consignes de sécurité |
| DI | Demande d'intervention : signalement d'un défaut ou d'un besoin, avant décision |
| OT | Ordre de travail : intervention décidée, planifiée, exécutée et clôturée |
| Immobilisation | Période pendant laquelle un équipement est inapte à l'exploitation pour une raison technique ou réglementaire |
| Remise en service | Décision tracée qui rend un équipement de nouveau apte à l'exploitation |
| Criticité | Classe A, B ou C de l'impact d'un arrêt de l'équipement (définie en 3.2) |

## 1. Contexte, objectifs et périmètre

La GMAO doit faire passer la maintenance d'un suivi dispersé (papier, tableurs, mémoire des chefs d'atelier) à un pilotage par les échéances, les coûts et la disponibilité de chaque équipement, sur plusieurs sociétés, sites, ateliers et chantiers.

### 1.1 Problèmes métier adressés

| Problème constaté | Conséquence | Réponse attendue de la GMAO |
| --- | --- | --- |
| Entretiens suivis sur tableur ou papier, échéances oubliées | Pannes évitables, perte de garantie constructeur, contrôles réglementaires dépassés | Échéancier automatique sur date, kilométrage, heures ou cycles, avec alertes et blocage |
| Compteurs relevés irrégulièrement ou faux | Échéances calculées sur des données erronées | Relevé mobile, contrôles de cohérence, intégration télématique |
| Pannes signalées oralement ou par téléphone | Prise en charge tardive, aucun historique exploitable | Demande d'intervention mobile avec photo, compteur et position |
| Immobilisations prolongées faute de pièces | Chantiers retardés, location d'engins de remplacement | Réservation de pièces, seuils de réapprovisionnement, visibilité multi-magasins |
| Coûts de maintenance non consolidés par équipement | Renouvellement décidé sans données, budgets non tenus | Coût complet par équipement, par heure ou par kilomètre |
| Prestataires peu suivis | Factures non rapprochées, garanties non exploitées | OT externes, rapprochement devis / commande / facture, suivi des garanties |
| Sociétés et sites sans vision commune | Stocks et techniciens non mutualisés, indicateurs incomparables | Référentiels communs, vision consolidée, cloisonnement des droits |

### 1.2 Objectifs mesurables

Les cibles ci-dessous sont des propositions \[AC\]. La valeur de référence est mesurée dans la GMAO pendant les trois premiers mois d'exploitation, sauf si l'entreprise dispose d'un historique fiable.

| Objectif | Indicateur (défini en section 9) | Cible proposée \[AC\] | Échéance |
| --- | --- | --- | --- |
| Tracer toute l'activité de maintenance | Part des interventions réalisées avec un OT dans la GMAO | ≥ 95 % | 6 mois après déploiement |
| Respecter le préventif | Taux de réalisation du préventif dans la tolérance | ≥ 90 % | 12 mois |
| Réduire les pannes | Pannes pour 1 000 heures de fonctionnement | − 20 % par rapport à la référence | 12 mois |
| Réduire les immobilisations | Temps moyen d'immobilisation par panne (équipements de criticité A) | − 15 % | 12 mois |
| Améliorer la disponibilité | Disponibilité technique des équipements critiques | ≥ 92 % | 12 mois |
| Limiter les attentes de pièces | Nombre d'OT en attente de pièces plus de 48 h | − 50 % | 12 mois |
| Maîtriser les coûts | Équipements avec coût par heure ou par km calculé | 100 % des équipements à compteur | 6 mois |
| Adoption terrain | Techniciens actifs chaque semaine sur l'application mobile | ≥ 80 % | 3 mois après déploiement du site |

Le projet est réussi si : le MVP est en production sur le site pilote dans le délai contractuel ; la recette se termine sans anomalie bloquante ; le référentiel repris est validé par les métiers ; et les indicateurs ci-dessus sont calculables dès la fin du pilote.

### 1.3 Organisation cible prise en charge

La solution doit gérer la structure suivante, chaque niveau pouvant porter des droits, des paramètres et des indicateurs :

- **Groupe** (client de la solution) : référentiels partageables (catégories, modèles, catalogue de pièces, plans types).
  - **Société** : entité juridique propriétaire des équipements, des stocks et des coûts.
    - **Site** : dépôt, usine, agence ou base vie permanente.
      - **Atelier** : lieu d'intervention avec capacité (postes, ponts, techniciens).
      - **Magasin** : stock de pièces, avec emplacements ; un camion atelier est un magasin mobile.
    - **Chantier** : lieu temporaire et géolocalisé, avec dates d'ouverture et de fermeture, où les équipements sont affectés.

Un équipement appartient à une seule société à un instant donné. Son affectation à un chantier ou un site d'une autre société du groupe (prêt ou location interne) doit être possible, avec imputation des coûts selon une règle à confirmer \[AC\].

### 1.4 Périmètre

| Domaine | Périmètre initial (MVP) | Évolutions futures |
| --- | --- | --- |
| Équipements et compteurs | Référentiel, compteurs manuels et importés, affectations, QR codes | Sous-ensembles sérialisés avancés, compteurs télématiques |
| Maintenance | Préventif multi-déclencheurs, correctif, OT, contrôles réglementaires | Maintenance conditionnelle, puis prédictive |
| Terrain | Application mobile avec mode hors connexion | Signature, dictée vocale, réalité assistée |
| Pièces | Catalogue, magasins, mouvements, réservations, seuils, inventaire | Réparables, échanges standard, réapprovisionnement automatique |
| Achats et prestataires | OT externe simple avec coût et documents | Demandes d'achat, commandes, factures, contrats, évaluation |
| Pilotage | Tableaux de bord principaux | Budget / réalisé, aide à la décision réparer ou remplacer, BI |
| Intégrations | Imports / exports Excel et CSV, API, authentification unique | ERP, comptabilité, télématique, capteurs IoT |

**Hors périmètre** de ce cahier des charges : paie et gestion RH complète, comptabilité générale, facturation des locations d'engins aux clients, fourniture de boîtiers télématiques ou de capteurs (la GMAO s'y intègre mais ne les fournit pas).

### 1.5 Informations à confirmer

Le document retient des valeurs par défaut pour pouvoir être chiffré. Elles doivent être remplacées par les données réelles avant la consultation.

| Information | Sections concernées | Valeur retenue par défaut |
| --- | --- | --- |
| Nombre de sociétés, sites, ateliers, magasins et chantiers actifs | 1, 12 | Hypothèse de dimensionnement en 12.4 |
| Taille et composition du parc par catégorie | 3, 12 | Hypothèse de dimensionnement en 12.4 |
| Nombre d'utilisateurs par rôle, dont utilisateurs mobiles | 2, 10, 15 | Hypothèse de dimensionnement en 12.4 |
| Pays d'exploitation et réglementations applicables | 4.6, 12.7 | À identifier par pays et par type d'équipement |
| Part de la maintenance réalisée en interne et par des prestataires | 5.6, 8 | Les deux modes sont couverts |
| Outils existants : ERP, comptabilité, achats, télématique, annuaire | 8, 11 | Intégration par API ou fichiers |
| Langues d'usage et devises | 12 | Français ; autres langues en option |
| Couverture réseau des chantiers | 10 | Usage hors connexion jusqu'à 7 jours \[AC\] |
| Seuils de validation financière | 2.4, 8 | Seuils paramétrables, valeurs à fixer |

## 2. Utilisateurs et habilitations

Les droits résultent de la combinaison d'un **rôle** (ce que l'utilisateur peut faire) et d'un **périmètre** (sur quelles sociétés, sites, chantiers et équipements). Toute action est tracée.

### 2.1 Rôles

| Rôle | Missions principales | Accès |
| --- | --- | --- |
| Administrateur | Paramétrage, utilisateurs, rôles, périmètres, référentiels, imports, intégrations | Web |
| Responsable maintenance | Politique de maintenance, plans d'entretien, arbitrages, validations, indicateurs | Web, mobile |
| Gestionnaire de flotte | Référentiel équipements, affectations, compteurs, échéances réglementaires, documents | Web, mobile |
| Chef d'atelier | Qualification des DI, création et planification des OT, affectation des techniciens, clôture | Web, mobile |
| Technicien | Exécution des OT, temps, pièces, checklists, comptes rendus, relevés | Mobile, web |
| Conducteur ou opérateur | Signalement de défauts, relevé de compteurs, contrôles de prise de poste | Mobile |
| Magasinier | Catalogue, réceptions, sorties, réservations, transferts, inventaires | Web, mobile |
| Responsable achats | Demandes d'achat, commandes, fournisseurs, contrats, rapprochement des factures | Web |
| Direction | Consultation des indicateurs et coûts, validations au-delà des seuils | Web, mobile |
| Prestataire externe | Consultation et compte rendu des seuls OT qui lui sont confiés | Web, mobile |

### 2.2 Matrice des droits par défaut

Légende : **C** créer, **L** lire, **M** modifier, **V** valider, **—** aucun accès. Les droits s'appliquent uniquement dans le périmètre de l'utilisateur. La matrice est paramétrable par l'administrateur.

| Objet ou action | Adm | Resp. maint. | Gest. flotte | Chef atelier | Tech. | Conduct. | Magas. | Achats | Dir. | Prest. |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Paramétrage, utilisateurs, rôles | CLM | L | — | — | — | — | — | — | — | — |
| Fiche équipement | CLM | CLM | CLM | L | L | L | L | L | L | L |
| Affectation à un site ou chantier | CLM | L | CLMV | L | — | L | — | — | L | — |
| Relevé de compteur | CLM | CLM | CLMV | CL | CL | CL | — | — | L | CL |
| Plan d'entretien | CLM | CLMV | L | CL | L | — | L | — | L | — |
| Demande d'intervention | CLM | CLMV | CLV | CLMV | CL | CL | — | — | L | CL |
| OT : création, planification, affectation | CLM | CLMV | L | CLMV | CL | L | L | L | L | L |
| OT : temps, travaux, pièces | L | LM | — | CLM | CLM | — | CLM | — | L | CLM |
| Remise en service d'un équipement critique | L | V | L | V | — | — | — | — | L | — |
| Catalogue de pièces | CLM | L | — | L | L | — | CLM | CLM | L | — |
| Mouvements de stock | L | L | — | CL | C | — | CLM | L | L | — |
| Ajustement d'inventaire | L | V | — | — | — | — | C | — | L | — |
| Demande d'achat | L | CV | — | C | — | — | C | CLMV | V | — |
| Commande, réception, facture | L | L | — | — | — | — | C | CLMV | V | — |
| Coûts et tableaux de bord | L | L | L | L | — | — | L | L | L | — |
| Journal d'audit | L | L | — | — | — | — | — | — | L | — |

Un technicien ne modifie que les OT qui lui sont affectés. Un conducteur ne voit que les équipements qui lui sont affectés. La validation de la remise en service par le chef d'atelier suppose une habilitation nominative.

### 2.3 Périmètres de données

Un utilisateur peut cumuler plusieurs couples rôle × périmètre (par exemple chef d'atelier sur le site A et technicien sur le site B). Le périmètre se définit par société, site, atelier, magasin, chantier, catégorie d'équipement ou liste d'équipements. Il s'applique à tous les canaux : écrans, recherche, exports, notifications, application mobile et API.

### 2.4 Circuits de validation

| Objet | Valideur proposé | Déclenchement \[AC\] | Sans réponse |
| --- | --- | --- | --- |
| DI de priorité P1 | Chef d'atelier du site | Toujours | Escalade à la direction du site après 1 h |
| OT dont le coût estimé dépasse un seuil | Responsable maintenance | Montant à fixer | Relance après 24 h, puis suppléant |
| Devis de prestataire | Responsable maintenance, puis direction au-delà d'un second seuil | Montants à fixer | Relance après 48 h |
| Demande d'achat | Responsable achats, puis direction au-delà d'un seuil | Montants à fixer | Relance après 48 h, puis suppléant |
| Remise en service (criticité A ou défaut de sécurité) | Personne habilitée, différente de l'exécutant | Toujours | L'équipement reste immobilisé |
| Report d'un préventif au-delà de la tolérance | Responsable maintenance | Toujours | L'OT reste en retard |
| Correction ou remplacement de compteur | Gestionnaire de flotte | Toujours | Relevé en statut « à vérifier » |
| Ajustement d'inventaire | Responsable maintenance | Écart en valeur supérieur à un seuil | Ajustement non comptabilisé |
| Réforme d'un équipement | Direction | Toujours | Équipement maintenu au parc |
| Modification d'un plan d'entretien type | Responsable maintenance | Toujours | Ancienne version appliquée |

Chaque valideur peut désigner un suppléant pour une période donnée. Une validation enregistre l'auteur, la date, la décision et un commentaire obligatoire en cas de refus.

### 2.5 Exigences

| Identifiant | Besoin | Description | Priorité | Règle métier | Critère d'acceptation |
| --- | --- | --- | --- | --- | --- |
| HAB-01 | Rôles paramétrables | Rôles livrés selon 2.1 et 2.2, modifiables et duplicables par l'administrateur | Must | Un droit non accordé est refusé par défaut | Un rôle créé sans droit de modification ne voit aucun bouton d'édition et reçoit un refus via l'API |
| HAB-02 | Cloisonnement par périmètre | Restriction par société, site, atelier, magasin, chantier, catégorie ou équipement | Must | Aucune donnée hors périmètre n'est visible, exportée ou notifiée | Un utilisateur du site A ne trouve aucun équipement du site B en liste, recherche, export, notification ou API |
| HAB-03 | Cumul et délégation | Plusieurs couples rôle × périmètre ; délégation temporaire datée | Should | Une délégation expire automatiquement à sa date de fin | Le lendemain de la date de fin, le délégué ne peut plus valider |
| HAB-04 | Circuits de validation | Valideurs, seuils et suppléants paramétrables par société et type d'objet | Must | Un objet soumis à validation ne change pas d'état sans décision tracée | Une demande d'achat au-dessus du seuil reste « à valider » tant que la direction n'a pas décidé |
| HAB-05 | Séparation des tâches | Interdire de valider ce que l'on a soi-même créé ou exécuté | Must | Le technicien exécutant ne valide pas la remise en service d'un équipement A ; le demandeur ne valide pas sa demande d'achat | La tentative est refusée avec un message explicite |
| HAB-06 | Journal d'audit | Qui, quoi, quand, valeur avant et après, canal (web, mobile, API, import) | Must | Le journal n'est modifiable par personne, administrateur compris | Toute modification d'un relevé, d'un OT ou d'un stock apparaît dans le journal avec ses valeurs avant et après |
| HAB-07 | Accès prestataire | Compte nominatif, date d'expiration, accès limité aux OT confiés | Should | Aucun accès aux coûts internes ni aux autres prestataires | Un prestataire ne voit que ses OT ; son compte est inactif après la date d'expiration |
| HAB-08 | Désactivation sans perte | Désactiver un utilisateur sans supprimer ses saisies | Must | Les saisies restent attribuées à leur auteur | Un utilisateur désactivé ne peut plus se connecter ; son nom reste visible dans l'historique |
| HAB-09 | Revue des habilitations | Export des utilisateurs, rôles, périmètres et dernière connexion | Should | Revue au moins annuelle \[AC\] | L'export liste chaque utilisateur avec ses rôles, périmètres et date de dernière connexion |

## 3. Référentiel des équipements

Chaque équipement dispose d'une fiche unique, identifiable par scan, qui porte son organisation, ses compteurs, son état, sa criticité, ses documents et tout son historique. Le référentiel est structuré en **catégorie → modèle → équipement → sous-ensembles**.

### 3.1 Contenu de la fiche équipement

| Groupe | Champs | Obligatoire à la création |
| --- | --- | --- |
| Identification | Identifiant interne unique (généré, non modifiable), code parc, numéro de série ou VIN, immatriculation, marque, modèle, catégorie, année de fabrication | Identifiant, code parc, catégorie, marque, modèle, numéro de série (sauf petits équipements paramétrés \[AC\]) |
| Organisation | Société propriétaire, site de rattachement, affectation courante (site, atelier ou chantier), responsable, centre de coût | Société, site |
| Cycle de vie | Mode d'acquisition (achat, crédit-bail, location longue ou courte durée), date et valeur d'acquisition, date de mise en service, fin de vie prévue, date et motif de réforme, valeur de cession | Mode d'acquisition, date de mise en service |
| Garanties et contrats | Fin de garantie constructeur (date et compteur), extensions, contrat de maintenance, loueur, assurance \[AC\] | Non |
| Compteurs | Un ou plusieurs compteurs : type, unité, valeur, date, source ; un compteur principal | Compteur principal si l'équipement en possède un |
| État | État opérationnel (3.2), criticité (3.3) | Oui |
| Caractéristiques | Attributs propres à la catégorie : puissance, capacité de levage, poids, carburant, dimensions des pneus, volume du réservoir, etc. | Selon paramétrage de la catégorie |
| Documents | Notices, schémas, certificats, rapports de contrôle, carte grise, photos ; chaque document peut porter une date d'expiration | Non |
| Identification physique | QR code ou code-barres généré, étiquette imprimable | Généré automatiquement |
| Historique | Affectations, états, relevés et remplacements de compteurs, DI, OT, pièces montées, coûts, documents | Alimenté automatiquement |

### 3.2 États opérationnels

L'état de l'équipement est distinct du statut de ses OT (voir 5.5). Chaque changement d'état est daté, motivé et conservé.

| État | Définition | Entrée | Effet |
| --- | --- | --- | --- |
| Disponible | Apte, non affecté à une exploitation | Fin d'affectation, remise en service sans affectation | Peut être affecté |
| En service | Apte et affecté à un site ou un chantier | Affectation active | Compte dans le temps de fonctionnement |
| En maintenance | Indisponible pendant une intervention prévue (préventif, contrôle) | Démarrage d'un OT marqué « immobilisant » prévu | Compte en immobilisation pour maintenance programmée |
| Immobilisé | Inapte à l'exploitation : panne, défaut de sécurité, contrôle réglementaire échu | Décision lors de la qualification d'une DI ou blocage automatique | Compte en immobilisation non programmée ; aucune affectation possible |
| Réformé | Sorti du parc (vendu, détruit, restitué) | Validation de la réforme par la direction | Lecture seule ; plans désactivés ; historique conservé |

### 3.3 Criticité

| Classe | Définition proposée \[AC\] | Effets dans la GMAO |
| --- | --- | --- |
| A | Son arrêt bloque une production ou un chantier, ou présente un risque pour la sécurité ou la conformité ; pas de remplacement sous 24 h | Priorité relevée d'un niveau, validation obligatoire de la remise en service, pièces critiques en stock de sécurité |
| B | Arrêt gênant ; remplacement possible sous 24 à 48 h | Priorité standard, suivi de la disponibilité |
| C | Impact faible ou équipement facilement remplaçable | Interventions regroupées, pas de stock dédié |

### 3.4 Sous-ensembles, affectations et compteurs

- **Sous-ensembles** : moteur, transmission, circuit hydraulique, pneus, batterie, godet, nécelle, etc. Chacun peut avoir un numéro de série, un compteur propre, ses plans d'entretien et son historique. Un sous-ensemble démonté peut être remonté sur un autre équipement ; son historique le suit.
- **Affectations** : chaque affectation porte un lieu, une date de début, une date de fin et un responsable. Un équipement n'a qu'une affectation active à un instant donné.
- **Compteurs** : le remplacement d'un compteur (tableau de bord, calculateur, horamètre) est un événement tracé qui préserve l'usage cumulé (règles en 13.2).

### 3.5 Exigences

| Identifiant | Besoin | Description | Priorité | Règle métier | Critère d'acceptation |
| --- | --- | --- | --- | --- | --- |
| EQP-01 | Fiche équipement | Fiche complète selon 3.1, consultable sur web et mobile | Must | Champs obligatoires contrôlés à l'enregistrement | Une fiche sans société ou sans catégorie est refusée avec le champ manquant signalé |
| EQP-02 | Unicité et anti-doublon | Identifiant généré ; contrôle du couple marque + numéro de série et de l'immatriculation | Must | Un couple marque + numéro de série est unique dans le groupe ; une immatriculation est unique parmi les équipements non réformés | La création d'un doublon est bloquée et l'équipement existant est proposé |
| EQP-03 | Catégories et attributs | Arborescence de catégories ; attributs techniques propres à chaque catégorie, sans développement | Should | Un modèle appartient à une seule catégorie | L'administrateur ajoute un attribut « capacité de levage (kg) » aux chariots ; il apparaît sur toutes leurs fiches |
| EQP-04 | Compteurs multiples | Plusieurs compteurs par équipement et par sous-ensemble, chacun avec son unité | Must | Un compteur principal par équipement à compteur | Un camion-grue porte un compteur km et un compteur heures de grue, relevés séparément |
| EQP-05 | États opérationnels | États selon 3.2 avec historique daté et motivé | Must | Un équipement immobilisé ou réformé ne peut pas être affecté | L'affectation d'un équipement immobilisé est refusée ; l'historique montre chaque état avec dates et auteur |
| EQP-06 | Criticité | Classe A, B ou C par équipement, héritée de la catégorie et modifiable | Must | La criticité modifie la priorité et la validation de remise en service | Une DI sur un équipement A est créée avec la priorité relevée d'un niveau |
| EQP-07 | Documents et photos | Pièces jointes typées avec date d'expiration facultative | Must | Formats PDF, images, vidéos courtes ; taille maximale paramétrable | Un rapport de contrôle joint avec expiration déclenche l'alerte prévue en 11.1 |
| EQP-08 | Sous-ensembles | Composants avec numéro de série, compteur, plans et historique propres ; transfert entre équipements | Should | Un sous-ensemble est monté sur un seul équipement à la fois | Un moteur transféré d'une chargeuse à une autre conserve ses heures et son historique |
| EQP-09 | QR code et code-barres | Génération, impression d'étiquettes par lot, scan ouvrant la fiche | Must | Un code ne désigne qu'un équipement ; une étiquette réimprimée garde le même code | Le scan ouvre la fiche en moins de 2 s en ligne et moins de 1 s hors connexion |
| EQP-10 | Historique des affectations | Lieu, dates, responsable pour chaque affectation | Must | Pas de chevauchement de deux affectations | La saisie d'une affectation qui chevauche une autre est refusée |
| EQP-11 | Historique des compteurs | Tous les relevés, corrections et remplacements avec leur source | Must | Voir règles DON en 13.2 | Le graphe d'usage d'un équipement reste continu après un remplacement de compteur |
| EQP-12 | Garanties et contrats | Garanties par équipement, sous-ensemble ou pièce, en date et en compteur | Should | La garantie expire au premier seuil atteint | Un OT créé sur un équipement sous garantie affiche un avertissement |
| EQP-13 | Import en masse | Import Excel ou CSV avec simulation et rapport d'erreurs | Must | Les mêmes contrôles qu'en saisie s'appliquent | Un fichier de 2 000 lignes dont 15 erronées produit un rapport listant les 15 lignes et leur motif |
| EQP-14 | Réforme | Circuit de réforme avec motif, date et valeur de cession | Should | Pas de réforme avec un OT ouvert | Après réforme, la fiche est en lecture seule et ses plans sont désactivés |
| EQP-15 | Dernière position | Affichage de la dernière position connue (télématique) | Could | Donnée soumise aux règles de 12.7 | La carte affiche la position et son horodatage |

## 4. Maintenance préventive

Le préventif est calculé automatiquement à partir des plans d'entretien et des compteurs : la GMAO projette chaque échéance, prévient avant qu'elle soit atteinte, génère l'OT et signale tout retard.

### 4.1 Plans d'entretien et gammes

- Un **plan type** est défini par catégorie ou par modèle (par exemple « chargeuse sur pneus, modèle X »). Il est appliqué aux équipements concernés, qui peuvent le surcharger localement ; toute surcharge est tracée.
- Un plan contient des **opérations** (vidange moteur, filtres hydrauliques, graissage, contrôle des freins…). Chaque opération a un ou plusieurs déclencheurs et un mode de calcul (fixe ou glissant).
- Chaque opération renvoie à une **gamme** : tâches ordonnées, checklist (conforme / non conforme / valeur mesurée avec bornes), pièces et consommables prévus, durée standard, compétences requises, consignes de sécurité et de consignation.
- Les plans types sont versionnés : une nouvelle version s'applique aux échéances futures et ne modifie pas les OT déjà générés.

### 4.2 Déclencheurs

| Type | Exemple | Calcul de l'échéance |
| --- | --- | --- |
| Calendaire | Tous les 3 mois | Date de référence + intervalle en jours, semaines, mois ou années |
| Compteur | Toutes les 250 h, 10 000 km ou 5 000 cycles | Valeur de référence + intervalle, sur le compteur cumulé |
| Combiné, premier seuil atteint | 250 h ou 3 mois | Échéance atteinte dès que l'un des seuils est franchi |
| Unique | Première vidange de rodage à 50 h | Une seule occurrence, puis l'opération est soldée |
| Conditionnel (évolution) | Code défaut télématique, mesure hors bornes dans une checklist | DI ou OT créé quand la condition est remplie (voir 11.4) |

Les mois sont calculés en mois calendaires : 10 janvier + 3 mois = 10 avril ; 31 janvier + 1 mois = dernier jour de février.

### 4.3 Échéances fixes et échéances recalculées

| Mode | Règle | Usage type | Exemple : intervalle 250 h, prévu à 1 000 h, réalisé à 1 040 h |
| --- | --- | --- | --- |
| Fixe | Prochaine échéance = échéance théorique précédente + intervalle, quelle que soit la date de réalisation | Plans constructeur par paliers (250 / 500 / 1 000 / 2 000 h) | Prochaine échéance : 1 250 h |
| Glissant (recalculé) | Prochaine échéance = valeur réelle à la réalisation + intervalle | Entretiens courants, opérations combinées date + compteur | Prochaine échéance : 1 290 h |

Le mode fixe s'applique aux opérations à déclencheur unique. Pour un déclencheur combiné, le mode glissant est la règle par défaut \[AC\]. Pour les contrôles réglementaires, le mode est fixé selon le texte applicable.

**Paliers imbriqués** : quand plusieurs paliers tombent ensemble (à 1 000 h, les opérations de 250, 500 et 1 000 h), seul le palier le plus complet génère un OT ; les autres sont soldés par lui et leur historique l'indique.

### 4.4 Exemple : chargeuse, 250 heures moteur ou 3 mois, au premier seuil atteint

Paramètres : mode glissant ; pré-alerte à 25 h ou 15 jours avant l'échéance ; tolérance de retard de 10 % de l'intervalle, soit 25 h ou 9 jours \[AC\]. Dernière réalisation : 10/01/2026 à 4 120 h. Prochaine échéance : **4 370 h ou 10/04/2026**.

| Étape | Cas A : usage intensif (environ 40 h par semaine) | Cas B : usage faible (environ 40 h par mois) |
| --- | --- | --- |
| Projection | 4 370 h atteint vers le 23/02/2026 | Compteur projeté à environ 4 240 h le 10/04/2026 |
| Seuil déclenchant | Heures moteur | Date |
| Pré-alerte et génération de l'OT | À 4 345 h, vers le 18/02/2026 | Le 26/03/2026 (J−15) |
| Échéance dépassée | Au-delà de 4 370 h | Après le 10/04/2026 |
| Passage « en retard » (hors tolérance) | Au-delà de 4 395 h | Après le 19/04/2026 |
| Réalisation | 24/02/2026 à 4 378 h (dans la tolérance) | 14/04/2026 à 4 245 h (dans la tolérance) |
| Prochaine échéance (glissant) | 4 628 h ou 24/05/2026 | 4 495 h ou 14/07/2026 |

La date projetée d'un seuil compteur se calcule ainsi : date du dernier relevé + (seuil − dernier relevé) ÷ utilisation moyenne journalière des 30 derniers jours \[AC\]. Elle est recalculée à chaque nouveau relevé.

### 4.5 Alertes, retards et replanification

- **Génération** : l'OT préventif est créé à la pré-alerte, ou au plus tard 14 jours avant l'échéance projetée \[AC\], avec la gamme, les pièces prévues et les compétences.
- **Unicité** : il ne peut exister qu'un OT ouvert par opération et par équipement. Si l'échéance suivante arrive alors que l'OT précédent est encore ouvert, aucun nouvel OT n'est créé et le retard s'accumule sur l'OT existant.
- **Statuts d'échéance** : à venir, en pré-alerte, échue, en retard (au-delà de la tolérance), réalisée, soldée par un palier supérieur.
- **Report** : motif obligatoire et nouvelle date ou valeur ; au-delà de la tolérance, validation du responsable maintenance. En mode fixe, le report ne déplace pas la grille théorique.
- **Contrôles réglementaires** : aucun report au-delà de l'échéance légale. À échéance dépassée, l'équipement passe en « Immobilisé » (comportement paramétrable par type de contrôle \[AC\]).
- **Suspension** : les plans d'un équipement réformé sont désactivés ; pour un équipement immobilisé longtemps ou stocké, les déclencheurs calendaires peuvent être suspendus avec motif \[AC\].

### 4.6 Contrôles périodiques et obligations réglementaires

Les contrôles réglementaires sont gérés comme des opérations de type « Contrôle réglementaire » avec : organisme ou personne habilitée, rapport joint obligatoire, résultat (conforme, conforme avec réserves, non conforme), réserves à lever avec échéance, et effet sur l'état de l'équipement.

La liste, les périodicités et les organismes **sont à confirmer pour chaque pays et chaque type d'équipement**. Exemples de familles à vérifier : vérifications périodiques des appareils de levage et chariots élévateurs ; contrôle ou visite technique des véhicules immatriculés ; équipements sous pression ; chronotachygraphes ; extincteurs embarqués ; installations électriques des groupes électrogènes.

### 4.7 Exigences

| Identifiant | Besoin | Description | Priorité | Règle métier | Critère d'acceptation |
| --- | --- | --- | --- | --- | --- |
| PRV-01 | Plans types et surcharge | Plans par catégorie ou modèle appliqués aux équipements, surchargeables et versionnés | Must | Une surcharge locale est tracée et prime sur le plan type | Modifier l'intervalle d'un plan type met à jour les échéances futures des équipements non surchargés uniquement |
| PRV-02 | Déclencheurs date et compteur | Calendaire, km, heures, cycles ou autre unité | Must | Calcul sur le compteur cumulé | Un plan à 10 000 km génère la bonne échéance après import d'un relevé |
| PRV-03 | Premier seuil atteint | Combinaison de deux déclencheurs ou plus | Must | L'échéance est atteinte au premier seuil franchi | Les cas A et B de 4.4 donnent exactement les dates et valeurs du tableau |
| PRV-04 | Mode fixe ou glissant | Choix par opération | Must | Voir 4.3 | Prévu 1 000 h, réalisé 1 040 h : prochaine échéance 1 250 h en fixe, 1 290 h en glissant |
| PRV-05 | Paliers imbriqués | Supersession des paliers inférieurs | Should | Un seul OT généré quand plusieurs paliers coïncident | À 1 000 h, un seul OT « palier 1 000 h » ; les paliers 250 et 500 h sont soldés |
| PRV-06 | Pré-alertes | Seuil d'anticipation en jours, en unités de compteur ou en % de l'intervalle | Must | Paramétrable par opération | L'échéance passe en pré-alerte à 4 345 h dans le cas A |
| PRV-07 | Projection des échéances compteur | Date estimée d'atteinte d'un seuil compteur | Should | Moyenne d'usage sur 30 jours glissants \[AC\] | La date projetée affichée correspond à la formule de 4.4 à un jour près |
| PRV-08 | Génération automatique des OT | OT créés dans l'horizon paramétré, avec gamme et pièces | Must | Un seul OT ouvert par opération et équipement | Relancer la génération deux fois de suite ne crée aucun doublon |
| PRV-09 | Retards et tolérances | Statut « en retard » au-delà de la tolérance, avec escalade | Must | Tolérance par opération, en valeur ou en % | Dans le cas A, l'échéance passe « en retard » au premier relevé supérieur à 4 395 h |
| PRV-10 | Report et replanification | Report motivé, validé au-delà de la tolérance | Must | Historique de tous les reports conservé | Un report sans motif est refusé ; le nombre de reports par OT est consultable |
| PRV-11 | Gammes et checklists | Tâches, contrôles avec bornes, pièces, durée, compétences, sécurité | Must | Une mesure hors bornes rend le point non conforme | Une pression saisie hors bornes est signalée et propose de créer une DI |
| PRV-12 | Contrôles réglementaires | Organisme, rapport obligatoire, réserves, blocage à échéance | Must | Pas de clôture sans rapport joint | Un contrôle échu passe l'équipement à « Immobilisé » si le paramètre de blocage est actif |
| PRV-13 | Suspension des plans | Suspension et réactivation selon l'état de l'équipement | Should | Motif obligatoire ; réformes : désactivation définitive | Un équipement réformé ne génère plus aucun OT |
| PRV-14 | Regroupement d'opérations | Regrouper dans un même OT les opérations dont les échéances sont proches | Could | Fenêtre paramétrable, par exemple 10 % de l'intervalle \[AC\] | Deux opérations à 3 jours d'écart sont proposées dans un seul OT |
| PRV-15 | Prévision de charge | Projection sur 12 mois des heures de main-d'œuvre et des pièces du préventif | Could | Basée sur les projections de PRV-07 | La prévision par mois et par atelier est exportable |

## 5. Maintenance corrective et ordres de travail

Toute panne suit le même chemin tracé : signalement, qualification, diagnostic, OT, exécution, essais, validation, clôture. Le statut de l'OT et l'état de l'équipement évoluent séparément, selon des règles explicites.

### 5.1 Processus

| Étape | Acteur | Actions et données saisies | Résultat |
| --- | --- | --- | --- |
| 1. Signalement | Conducteur, opérateur, chef de chantier, technicien | Scan de l'équipement, symptôme (liste + texte libre), photos, compteur, position GPS, équipement à l'arrêt oui / non, risque sécurité oui / non | DI « Nouvelle », notification du chef d'atelier |
| 2. Qualification | Chef d'atelier ou responsable maintenance | Priorité (5.2), type (panne, dégât ou accident, défaut de sécurité, amélioration), décision d'immobilisation, rejet motivé ou rattachement à une DI existante | DI « Qualifiée » ; équipement « Immobilisé » si décidé |
| 3. Diagnostic | Technicien, sur place ou à distance | Constat, codes symptôme / cause / remède, pièces et temps estimés | Diagnostic rattaché à la DI ou à l'OT |
| 4. Création de l'OT | Chef d'atelier | OT créé depuis une ou plusieurs DI : tâches, durée estimée, lieu (atelier ou chantier), interne ou externe | OT « Créé » |
| 5. Affectation et planification | Chef d'atelier | Techniciens ou prestataire, date et créneau, ressources (section 6) | OT « Planifié » |
| 6. Réservation des pièces | Chef d'atelier, magasinier | Réservation sur stock ; si manque : demande d'achat ou transfert | OT « En attente » (motif pièces) tant que les pièces critiques manquent |
| 7. Exécution | Technicien ou prestataire | Temps passé, pièces consommées, travaux réalisés, mesures, photos, pièces démontées | OT « En cours » puis « Travaux terminés » |
| 8. Essais et validation | Technicien, valideur habilité | Checklist de remise en service, essai fonctionnel, compteur de sortie ; validation par une personne habilitée si criticité A ou défaut de sécurité | Équipement remis en service |
| 9. Clôture | Chef d'atelier | Clôture technique, puis clôture administrative quand tous les coûts sont connus | Historique et indicateurs mis à jour |

### 5.2 Priorités

| Priorité | Définition | Prise en charge cible \[AC\] | Remise en service cible \[AC\] |
| --- | --- | --- | --- |
| P1 Urgence | Risque pour la sécurité, ou équipement de criticité A à l'arrêt bloquant l'activité | 1 h | 24 h |
| P2 Haute | Équipement à l'arrêt, ou équipement A en mode dégradé | 4 h | 48 h |
| P3 Normale | Équipement utilisable en mode dégradé | 2 jours ouvrés | 5 jours ouvrés |
| P4 Planifiable | Défaut mineur, intervention regroupable avec le prochain préventif | Prochain créneau disponible | Prochain préventif |

Les délais se mesurent à partir de la création de la DI. La prise en charge est l'affectation d'un intervenant ; la remise en service est la validation finale de l'étape 8.

### 5.3 Statuts de la demande d'intervention

**Nouvelle** → **Qualifiée** → **Transformée en OT**. Une DI peut aussi être **Rejetée** (motif obligatoire, déclarant notifié) ou **Rattachée** à une autre DI ou à un OT ouvert sur le même équipement. Le déclarant suit l'avancement depuis l'application mobile.

### 5.4 Statuts de l'OT et transitions

&#91;embedded content: cycle de vie de l'OT · 8 statuts, 2 états finaux\]

Le chemin principal descend de « Créé » à « Clôturé » ; l'attente, l'annulation, l'essai non concluant et la réouverture sont les seuls écarts autorisés, chacun avec ses conditions ci-dessous.

| De | Vers | Qui | Conditions de passage |
| --- | --- | --- | --- |
| Créé | Planifié | Chef d'atelier | Date prévue et au moins un intervenant (technicien ou prestataire) |
| Créé, Planifié, En cours | En attente | Chef d'atelier, technicien | Motif obligatoire : pièces, prestataire, accès à l'équipement, validation de devis, autre |
| En attente | Planifié ou En cours | Chef d'atelier, technicien | Motif levé (pièce reçue, devis validé…), levée horodatée |
| Planifié | En cours | Technicien affecté | Démarrage horodaté, sur mobile ou web |
| En cours | Travaux terminés | Technicien | Au moins une ligne de travaux ; checklist obligatoire complète ; compteur relevé si l'équipement en a un ; temps saisi (sauf OT externe) |
| Travaux terminés | En cours | Technicien, valideur | Essai non concluant, motif saisi |
| Travaux terminés | Clôturé technique | Chef d'atelier ou valideur | Essais conformes ; remise en service validée par une personne habilitée différente de l'exécutant si criticité A ou défaut de sécurité ; toutes les réservations de pièces soldées (consommées ou retournées) |
| Clôturé technique | Clôturé | Chef d'atelier | Aucun pointage ouvert ; factures des prestataires rapprochées ou coût provisionné |
| Clôturé technique | En cours (rouvert) | Chef d'atelier | Dans les 7 jours suivant la clôture \[AC\], motif obligatoire ; au-delà, un nouvel OT lié de type « récidive » est créé |
| Créé, Planifié, En attente | Annulé | Chef d'atelier, responsable maintenance | Motif obligatoire ; aucun temps ni aucune pièce imputés ; réservations libérées automatiquement |

**Clôturé** et **Annulé** sont des états finaux : l'OT n'est plus modifiable, une correction passe par un mouvement ou un OT lié. Un OT sur lequel du temps ou des pièces ont été imputés ne peut pas être annulé : il est clôturé avec le résultat « diagnostic seul » ou « sans suite ».

### 5.5 Statut de l'OT et état de l'équipement

| Situation | Statut de l'OT | État de l'équipement |
| --- | --- | --- |
| Panne bloquante qualifiée, OT créé | Créé | Immobilisé |
| Défaut mineur, réparation différée, l'engin continue à travailler | Planifié | En service |
| Préventif en atelier | En cours | En maintenance |
| Réparation interrompue faute de pièce | En attente (pièces) | Immobilisé |
| Travaux terminés, essais en cours | Travaux terminés | Inchangé (Immobilisé ou En maintenance) |
| Remise en service validée | Clôturé technique | En service si une affectation est active, sinon Disponible |

Un OT est marqué « immobilisant » ou non lors de la qualification. L'équipement ne redevient apte que lorsque tous ses OT immobilisants sont clôturés techniquement et, pour un équipement A, après validation. La période d'immobilisation (décision → remise en service) alimente les indicateurs de disponibilité (section 9).

### 5.6 Interventions externes et garanties

- **OT externe** : prestataire, devis (montant, délai, validité), validation selon seuil, commande, sortie et retour de l'équipement si l'intervention a lieu chez le prestataire, rapport d'intervention, facture rapprochée (section 8).
- **Garantie** : à la création d'un OT, la GMAO vérifie les garanties de l'équipement, du sous-ensemble et des pièces montées (en date et en compteur). Si l'une est active, un avertissement s'affiche et l'utilisateur peut ouvrir un dossier de prise en charge : numéro de série, compteur, photos, pièces défectueuses conservées, échanges avec le constructeur.
- **Suivi du dossier** : Déposé, Accepté, Refusé, Avoir ou remboursement reçu. Le coût de l'OT est provisionné puis neutralisé à hauteur de la prise en charge.

### 5.7 Exigences

| Identifiant | Besoin | Description | Priorité | Règle métier | Critère d'acceptation |
| --- | --- | --- | --- | --- | --- |
| COR-01 | Signalement rapide | DI sur mobile ou web avec scan, symptôme, photos, compteur, position, arrêt oui / non | Must | Équipement et description obligatoires ; jusqu'à 5 photos \[AC\] | Un opérateur formé crée une DI avec 2 photos en moins de 60 secondes |
| COR-02 | Détection des doublons | Avertissement si une DI ou un OT est déjà ouvert sur l'équipement | Should | Proposition de rattachement, sans blocage | La seconde DI sur un même équipement affiche la DI existante et propose le rattachement |
| COR-03 | Qualification | Priorité, type, décision d'immobilisation, rejet motivé | Must | Le déclarant est notifié du rejet et de son motif | Une DI rejetée sans motif est refusée par le système |
| COR-04 | Codification des défauts | Listes symptôme / cause / remède par catégorie et sous-ensemble | Should | Cause obligatoire à la clôture d'un OT de type panne \[AC\] | Le rapport des pannes récurrentes (9.2) se filtre par cause |
| COR-05 | Ordres de travail | Création depuis DI, préventif ou manuelle ; types : préventif, correctif, réglementaire, amélioration, accident | Must | Numéro unique par société, non réutilisable | Deux OT créés simultanément reçoivent deux numéros différents |
| COR-06 | Statuts et transitions | Machine à états selon 5.4 | Must | Toute transition non listée est refusée | Passer un OT « Créé » directement en « Clôturé » est impossible, y compris par API |
| COR-07 | État de l'équipement distinct | Gestion de l'état selon 5.5 et historique des immobilisations | Must | Une immobilisation a une date de début, une date de fin et un motif | La durée d'immobilisation d'une panne est calculée de la décision à la remise en service |
| COR-08 | Affectation des intervenants | Un ou plusieurs techniciens, ou un prestataire | Must | Contrôles de disponibilité et de compétence (section 6) | Un OT affecté à deux techniciens apparaît sur leurs deux plannings |
| COR-09 | Saisie du temps | Chronomètre démarrer / arrêter et saisie manuelle, par technicien | Must | Un technicien ne peut pas pointer deux OT en même temps | Démarrer un second OT arrête le premier ou est refusé, selon paramétrage |
| COR-10 | Pièces consommées | Consommation depuis les réservations ou ajout, retours | Must | Règles de stock de 7.5 | Une pièce consommée apparaît dans le coût de l'OT et sort du stock |
| COR-11 | Compte rendu | Travaux réalisés, mesures, photos avant / après, pièces démontées | Must | Au moins une ligne de travaux pour terminer | Le bon d'intervention PDF reprend toutes ces informations |
| COR-12 | Validation de remise en service | Validation par une personne habilitée pour les équipements A et les défauts de sécurité | Must | Valideur différent de l'exécutant | Sans validation, l'équipement reste « Immobilisé » |
| COR-13 | Clôtures technique et administrative | Deux étapes distinctes | Must | Les coûts d'un OT clôturé ne sont plus modifiables | Une facture reçue après clôture technique est rattachée avant la clôture administrative |
| COR-14 | Réouverture et récidive | Réouverture dans le délai, sinon OT lié « récidive » | Should | Les réouvertures sont comptées dans les indicateurs | Le taux de réouverture par technicien et par prestataire est consultable |
| COR-15 | OT externe simple | Prestataire, coût, documents, rapport | Must | Le coût externe est imputé à l'OT | Un OT externe clôturé apparaît dans le coût de l'équipement en « prestations » |
| COR-16 | Garanties | Contrôle automatique et dossier de prise en charge | Should | La garantie est active jusqu'au premier seuil atteint (date ou compteur) | Un OT sur un équipement sous garantie affiche l'avertissement et permet d'ouvrir le dossier |
| COR-17 | Sinistres | Déclaration d'accident ou de dégât liée à l'assurance | Could | Coûts des sinistres isolés des coûts de maintenance | Le tableau de bord distingue coûts de maintenance et coûts de sinistres |

## 6. Planification et ressources

Le chef d'atelier planifie les OT sur un calendrier qui confronte la charge (OT préventifs et correctifs) à la capacité réelle (techniciens présents et compétents, postes d'atelier, pièces disponibles, équipement accessible). Les conflits sont détectés avant d'être subis.

### 6.1 Ressources gérées

| Ressource | Données | Usage en planification |
| --- | --- | --- |
| Technicien | Site de rattachement, horaires, absences (congés, formation, maladie sans motif détaillé), compétences, habilitations, taux horaire | Capacité en heures, contrôle de compétence |
| Équipe | Liste de techniciens, chef d'équipe | Affectation groupée |
| Prestataire | Domaines, zones d'intervention, contrats, délais contractuels | Affectation d'OT externes |
| Atelier et postes | Nombre de postes, ponts, fosses, capacités particulières (levage, poids lourd) | Capacité d'accueil simultanée |
| Atelier mobile | Véhicule équipé, magasin mobile associé | Interventions sur chantier |
| Outillage spécial (évolution) | Valise de diagnostic, banc d'essai, outillage calibré avec date d'étalonnage | Réservation par OT |

### 6.2 Compétences et habilitations

Le référentiel distingue les **compétences** (mécanique moteur, hydraulique, électricité, climatisation, soudure, pneumatique…) avec un niveau, et les **habilitations** à validité limitée (habilitation électrique, autorisation de conduite d'engins, permis), dont la nature est à confirmer selon le pays. Une gamme indique les compétences requises. L'affectation d'un technicien sans la compétence affiche un avertissement ; sans une habilitation exigée, elle est bloquée \[AC\].

### 6.3 Calendrier et charge

- Vues jour, semaine et mois ; planning par technicien, par atelier et par équipement ; déplacement des OT par glisser-déposer.
- Carnet de commandes (backlog) : heures à réaliser par atelier et par semaine, comparées à la capacité disponible, avec les OT non planifiés triés par priorité et échéance.
- Capacité d'un technicien = heures de présence prévues − absences − temps réservé aux urgences (par exemple 15 % \[AC\]).
- Interventions sur chantier : lieu géolocalisé, temps de trajet saisi ou paramétré par zone, regroupement des OT d'un même chantier ou d'une même tournée.

### 6.4 Gestion des urgences

Une DI ou un OT de priorité P1 s'affiche en tête de planning avec les techniciens disponibles, compétents et les plus proches (site ou dernière position connue de l'atelier mobile). Si son insertion décale d'autres OT, la GMAO liste les OT impactés, propose une nouvelle date et notifie les techniciens et demandeurs concernés.

### 6.5 Conflits détectés

| Conflit | Détection | Comportement |
| --- | --- | --- |
| Technicien absent | Absence enregistrée sur le créneau | Affectation bloquée |
| Technicien surchargé | Heures planifiées supérieures à sa capacité sur la journée | Avertissement, dépassement accepté avec confirmation |
| Compétence ou habilitation manquante | Comparaison gamme / technicien | Avertissement (compétence) ou blocage (habilitation exigée) |
| Pièce manquante | Réservation non satisfaite ou date de réception prévue postérieure au créneau | OT signalé « pièces non disponibles », proposition de date après réception |
| Équipement inaccessible | Équipement affecté à un chantier sur le créneau, en transport ou chez un prestataire | Avertissement et demande d'accord au gestionnaire de flotte |
| Intervention concurrente | Deux OT sur le même équipement sur des créneaux qui se chevauchent | Proposition de regroupement ou avertissement |
| Atelier saturé | Postes occupés supérieurs à la capacité | Avertissement |
| Échéance réglementaire pendant une affectation | Contrôle échu avant la fin prévue d'une affectation chantier | Alerte au gestionnaire de flotte au moment de l'affectation |

### 6.6 Exigences

| Identifiant | Besoin | Description | Priorité | Règle métier | Critère d'acceptation |
| --- | --- | --- | --- | --- | --- |
| PLA-01 | Calendrier des interventions | Vues jour, semaine, mois par technicien, atelier, équipement ; glisser-déposer | Must | Seuls les OT du périmètre sont visibles | Déplacer un OT met à jour sa date et notifie le technicien |
| PLA-02 | Disponibilité des techniciens | Horaires et absences saisis ou importés | Must | Pas d'affectation sur une absence | Affecter un OT à un technicien en congé est refusé |
| PLA-03 | Compétences et habilitations | Référentiel avec niveaux et dates d'expiration | Should | Avertissement ou blocage selon 6.2 | Une habilitation expirée bloque l'affectation à un OT qui l'exige |
| PLA-04 | Charge et capacité | Backlog en heures comparé à la capacité par atelier et par semaine | Should | Capacité nette selon 6.3 | Le taux de charge affiché est égal à heures planifiées ÷ capacité nette |
| PLA-05 | Interventions sur chantier | Lieu, trajet, regroupement par chantier | Should | Le trajet est compté dans la charge du technicien | Trois OT d'un même chantier sont proposés dans une même tournée |
| PLA-06 | Urgences | Insertion des P1 avec propositions de ressources et d'OT à décaler | Must | Les décalages sont notifiés | L'insertion d'un P1 liste les OT décalés et notifie leurs techniciens |
| PLA-07 | Détection des conflits | Conflits du tableau 6.5 | Must | Blocage ou avertissement selon le type | Chaque conflit du tableau 6.5 est reproduit en recette avec le comportement attendu |
| PLA-08 | Atelier et postes | Capacité d'accueil par atelier | Should | Avertissement au-delà de la capacité | Un quatrième équipement planifié dans un atelier à 3 postes déclenche l'avertissement |
| PLA-09 | Outillage spécial | Réservation d'outillage par OT, étalonnage | Could | Un outil non étalonné n'est pas réservable | La réservation d'un outil hors étalonnage est refusée |
| PLA-10 | Optimisation de tournées | Proposition d'ordre de passage sur plusieurs chantiers | Could | Basée sur les positions des chantiers | La tournée proposée est affichée sur une carte avec les temps estimés |

## 7. Pièces détachées et stocks

La GMAO tient un stock exact par magasin et par emplacement, réserve les pièces des OT, alerte avant la rupture et trace chaque pièce sérialisée jusqu'à l'équipement sur lequel elle est montée. Aucun mouvement ne peut être compté deux fois.

### 7.1 Organisation des stocks

- **Magasin** rattaché à un site, avec des **emplacements** (zone, allée, étagère, casier). Un camion atelier ou un conteneur de chantier est un magasin mobile.
- Pour chaque article et emplacement : **stock physique**, **réservé**, **disponible** (= physique − réservé), **en commande** et **en transit**.
- Valorisation au coût moyen pondéré par société \[AC\] ; méthode à aligner sur la comptabilité.

### 7.2 Catalogue et compatibilités

Une fiche article comprend : référence interne, désignation normalisée, famille, unité de stock et d'achat (avec conversion), référence et marque du fabricant, références fournisseurs avec prix et délais, **références alternatives** (équivalences validées), **compatibilités** avec des modèles, équipements ou sous-ensembles, mode de suivi (quantité, lot ou numéro de série), caractère réparable, criticité, photo. Depuis un équipement, le technicien voit les pièces compatibles et leur disponibilité dans chaque magasin de son périmètre.

### 7.3 Mouvements de stock

| Mouvement | Contrepartie obligatoire | Effet sur le stock | Effet sur les coûts |
| --- | --- | --- | --- |
| Réception d'achat | Ligne de commande (ou réception libre motivée) | + physique | Valorisation au prix de réception |
| Réservation | OT | + réservé, − disponible | Aucun |
| Sortie sur OT | OT ouvert | − physique, − réservé si réservée | Imputée à l'OT et à l'équipement |
| Sortie hors OT | Centre de coût et motif | − physique | Imputée au centre de coût |
| Retour sur stock | Sortie d'origine | + physique | Annule l'imputation à due concurrence |
| Transfert entre magasins | Magasins d'origine et de destination | − physique à l'expédition, + en transit, + physique à la réception | Aucun (ou coût de transport séparé) |
| Ajustement d'inventaire | Session d'inventaire, motif | ± physique | Écart valorisé, validé au-delà d'un seuil |
| Retour fournisseur ou garantie | Commande ou dossier de garantie | − physique | Avoir attendu |
| Envoi et retour de réparation | Commande de réparation | Changement d'état de la pièce réparable | Coût de réparation |
| Mise au rebut | Motif, validation | − physique | Perte valorisée |

### 7.4 Réapprovisionnement, lots et numéros de série

- **Seuils** par article et magasin : stock minimum, point de commande, quantité de réapprovisionnement ou stock maximum, stock de sécurité pour les pièces critiques des équipements A.
- **Alerte** quand disponible + en commande ≤ point de commande. En évolution : proposition automatique de demande d'achat.
- **Numéros de série** obligatoires pour les articles paramétrés comme tels (par exemple moteurs, turbos, pompes hydrauliques, batteries, pneus \[AC\]) : saisis à la réception, à la sortie et au montage.
- **Lots** pour les articles qui l'exigent (huiles, produits chimiques) \[AC\], avec date de péremption le cas échéant.
- **Fournisseurs** : plusieurs par article, avec fournisseur préféré, prix, délai, quantité minimale de commande.

### 7.5 Règles contre les doubles consommations et les incohérences

1. Le stock physique ne peut pas devenir négatif. Une sortie supérieure au stock est refusée en ligne ; si elle vient d'une synchronisation hors connexion, elle est enregistrée « à régulariser » et le magasinier est alerté (voir 10.4).
2. Chaque mouvement porte un identifiant unique généré à sa création, y compris sur mobile : un même mouvement reçu deux fois n'est enregistré qu'une fois.
3. Une sortie sur OT ne peut dépasser la quantité réservée pour cet OT augmentée du disponible.
4. Aucune consommation sur un OT annulé ou clôturé ; une régularisation postérieure passe par un mouvement de correction lié à l'OT.
5. Un mouvement validé n'est ni modifié ni supprimé : il est corrigé par un mouvement inverse référençant l'original.
6. Un numéro de série se trouve à un seul endroit à la fois : emplacement, monté sur un équipement, en réparation, chez un fournisseur, ou mis au rebut.
7. Un transfert ne peut être réceptionné pour une quantité supérieure à l'expédié ; tout écart est motivé.
8. Pendant le comptage d'un emplacement, les mouvements sur cet emplacement sont soit bloqués, soit enregistrés à part et intégrés au calcul de l'écart \[AC\].
9. Deux saisies simultanées sur le même article et le même emplacement sont sérialisées : la seconde est recalculée sur le stock à jour ou refusée.

### 7.6 Pièces montées, réparables et échanges standard

- **Montage et démontage** : la sortie d'une pièce sérialisée sur un OT l'enregistre comme montée sur l'équipement ou le sous-ensemble. La pièce déposée est saisie (numéro de série, état : réparable, rebut, sous garantie) et retourne en magasin dans l'état correspondant.
- **Pièces réparables** : cycle bon état → montée → déposée « à réparer » → en réparation (interne ou prestataire) → réparée en stock ou rebut. Le stock « à réparer » n'est pas disponible pour les OT.
- **Échange standard** : achat d'une pièce reconditionnée avec consigne. La GMAO suit le retour de la pièce usagée au fournisseur dans le délai contractuel et alerte avant expiration de la consigne.

### 7.7 Exigences

| Identifiant | Besoin | Description | Priorité | Règle métier | Critère d'acceptation |
| --- | --- | --- | --- | --- | --- |
| STK-01 | Catalogue articles | Fiche article selon 7.2, partageable au niveau du groupe | Must | Une référence fabricant + marque est unique | La création d'un article en doublon est bloquée et l'article existant est proposé |
| STK-02 | Compatibilités et alternatives | Liens article ↔ modèle, équipement, sous-ensemble ; équivalences | Should | Une alternative n'est proposée que si elle est validée | Depuis une chargeuse, la liste des filtres compatibles et leur stock par magasin s'affichent |
| STK-03 | Magasins et emplacements | Multi-magasins, multi-emplacements, magasins mobiles | Must | Un stock appartient à une société | Le stock d'un article est consultable par magasin et par emplacement |
| STK-04 | Mouvements | Mouvements du tableau 7.3 | Must | Contrepartie obligatoire | Chaque mouvement sans contrepartie est refusé |
| STK-05 | Réservations | Réservation par OT, libération automatique à l'annulation | Must | Une réservation réduit le disponible, pas le physique | Annuler un OT libère ses réservations dans la seconde |
| STK-06 | Transferts | Expédition, transit, réception en deux temps | Should | Voir 7.5 règle 7 | Une quantité expédiée apparaît « en transit » jusqu'à sa réception |
| STK-07 | Inventaires | Inventaire complet et tournant, saisie mobile par scan, écarts validés | Must | Validation au-delà d'un seuil d'écart en valeur | Un écart supérieur au seuil reste « à valider » et ne modifie pas le stock avant validation |
| STK-08 | Seuils et alertes | Minimum, point de commande, stock de sécurité | Must | Alerte quand disponible + en commande ≤ point de commande | Une sortie qui franchit le seuil déclenche l'alerte au magasinier et à l'acheteur |
| STK-09 | Proposition de réapprovisionnement | Demande d'achat proposée automatiquement | Could | Quantité = maximum − (disponible + en commande) | La proposition calculée correspond à la formule |
| STK-10 | Numéros de série et lots | Suivi sérialisé et par lot selon paramétrage de l'article | Should | Voir 7.5 règle 6 | Un numéro de série déjà monté ne peut pas être réceptionné en stock |
| STK-11 | Montage et démontage | Historique des pièces montées et déposées par équipement | Should | Toute pose d'une pièce sérialisée enregistre la pièce déposée | L'historique d'un équipement liste les numéros de série posés et déposés avec les OT |
| STK-12 | Réparables | Cycle de 7.6, stock « à réparer » distinct | Should | Le stock à réparer n'est pas disponible | Une pompe déposée réparable n'apparaît pas dans le disponible |
| STK-13 | Échanges standard | Suivi des consignes et des retours | Should | Alerte avant expiration de la consigne | La liste des consignes ouvertes affiche leur échéance |
| STK-14 | Intégrité des stocks | Règles 1 à 9 de 7.5 | Must | Idempotence et absence de stock négatif | Rejouer 10 fois la même synchronisation laisse le stock inchangé après la première |
| STK-15 | Valorisation | Coût moyen pondéré, valeur de stock par magasin et société | Must | Méthode identique à la comptabilité | La valeur de stock calculée sur un jeu de test est égale au résultat attendu à l'unité monétaire près |

## 8. Achats et prestataires

Chaque dépense de pièces ou de prestations doit être rattachée à un besoin de maintenance, validée selon les seuils, reçue, facturée et imputée à l'équipement concerné. La répartition des rôles entre GMAO et ERP est à confirmer.

### 8.1 Flux d'achat

1. **Besoin** : réservation non satisfaite, alerte de seuil, OT externe, demande manuelle.
2. **Demande d'achat** : articles ou prestation, quantité, date de besoin, OT ou équipement concerné, fournisseur suggéré.
3. **Validation** selon les seuils de 2.4.
4. **Consultation et devis** : un ou plusieurs devis joints, comparaison, choix motivé.
5. **Commande** : numéro, fournisseur, lignes, prix, date de livraison promise, conditions.
6. **Réception** totale ou partielle, contrôle de conformité, entrée en stock ou affectation directe à l'OT.
7. **Facture** et **rapprochement à trois termes** (commande, réception, facture).
8. **Imputation** du coût à l'OT, à l'équipement et au centre de coût.

Deux scénarios d'architecture sont à chiffrer : **A**, la GMAO gère tout le flux pour les achats de maintenance ; **B**, l'ERP est maître des commandes et factures, la GMAO émet les demandes d'achat et reçoit en retour commandes, réceptions et montants facturés (section 11).

### 8.2 Règles de rapprochement

- Une facture est rapprochée automatiquement si quantités et prix correspondent à la commande et à la réception, dans une tolérance paramétrable (par exemple 2 % en prix \[AC\]).
- Hors tolérance, la facture est bloquée « à justifier » et l'acheteur est notifié.
- Un OT externe ne passe en clôture administrative qu'avec une facture rapprochée ou un coût provisionné égal au montant commandé.
- L'écart entre devis validé et facture est conservé et exploité dans l'évaluation des prestataires.

### 8.3 Contrats, devis et garanties

Un contrat de maintenance porte : prestataire, type (maintenance complète, préventif seul, forfait à l'heure moteur, location avec maintenance), équipements couverts, prestations incluses et exclues, délais d'intervention contractuels, prix et règles de révision, dates de début et de fin, préavis de résiliation, documents. La GMAO alerte avant l'échéance et avant la date limite de préavis. Les OT réalisés sous contrat sont repérés pour éviter une double facturation.

### 8.4 Évaluation des prestataires et fournisseurs

| Indicateur | Formule | Source |
| --- | --- | --- |
| Respect du délai d'intervention | OT pris en charge dans le délai contractuel ÷ OT confiés | Horodatages des OT |
| Respect du délai de livraison | Lignes livrées à la date promise ÷ lignes commandées | Commandes et réceptions |
| Taux de reprise | OT rouverts ou récidives sous 30 jours ÷ OT réalisés | OT liés |
| Écart de prix | (Montant facturé − montant du devis) ÷ montant du devis | Devis et factures |
| Appréciation | Note de 1 à 5 saisie à la clôture de l'OT, commentaire | Chef d'atelier |

### 8.5 Exigences

| Identifiant | Besoin | Description | Priorité | Règle métier | Critère d'acceptation |
| --- | --- | --- | --- | --- | --- |
| ACH-01 | Demandes d'achat | Création manuelle ou depuis un OT ou une alerte de seuil | Should | Rattachement à un OT, un équipement ou un centre de coût obligatoire | Une demande créée depuis un OT reste visible dans l'OT avec son statut |
| ACH-02 | Validation | Circuits et seuils de 2.4 | Should | Le demandeur ne valide pas sa demande | Une demande au-dessus du seuil est routée vers la direction |
| ACH-03 | Devis | Plusieurs devis par besoin, comparaison, choix motivé | Should | Un devis a une date de validité | Un devis expiré ne peut pas être validé |
| ACH-04 | Commandes | Bon de commande généré en PDF ou transmis à l'ERP | Should | Une commande n'est émise qu'après validation | Le PDF de commande reprend les lignes, prix et date de livraison |
| ACH-05 | Réceptions | Totales ou partielles, sur web et mobile | Should | Réception ≤ quantité commandée, sauf tolérance | Une réception partielle laisse le reliquat « en commande » |
| ACH-06 | Rapprochement des factures | Rapprochement à trois termes avec tolérance | Should | Voir 8.2 | Une facture hors tolérance est bloquée « à justifier » |
| ACH-07 | Contrats de maintenance | Fiche contrat, équipements couverts, alertes d'échéance et de préavis | Should | Alerte à J−90 et J−30 de la date de préavis \[AC\] | L'alerte est reçue par le responsable achats aux deux dates |
| ACH-08 | Suivi des délais | Commandes en retard et délais d'intervention des prestataires | Should | Une commande est en retard au lendemain de la date promise | La liste des commandes en retard est disponible et filtrable par fournisseur |
| ACH-09 | Évaluation des prestataires | Indicateurs de 8.4 | Could | Calcul mensuel | Le classement des prestataires par indicateur est exportable |
| ACH-10 | Imputation des coûts | Coûts d'achat et de prestation imputés à l'OT et à l'équipement | Must | Pas de coût de maintenance sans imputation | Le coût d'un équipement inclut toutes les prestations facturées sur ses OT |

## 9. Coûts et tableaux de bord

Les indicateurs sont calculés par la GMAO selon des formules publiées et testables : deux personnes qui appliquent la même convention au même jeu de données doivent obtenir le même résultat. Toute convention ci-dessous marquée \[AC\] est paramétrable.

### 9.1 Construction des coûts

- **Main-d'œuvre interne** = heures pointées sur l'OT × taux horaire du technicien ou de sa qualification, daté (un changement de taux ne modifie pas les OT passés).
- **Pièces** = quantités sorties sur l'OT × coût moyen pondéré au moment de la sortie, net des retours.
- **Prestations** = montant facturé rapproché ; à défaut, montant commandé en provision, remplacé par le facturé à réception.
- **Exclus du coût de maintenance** et suivis à part : sinistres, carburant, assurance, amortissement. Ils entreront dans le coût total de possession en évolution.
- Un coût est rattaché à la période de réalisation des travaux (date de clôture technique de l'OT) \[AC\].

### 9.2 Formules et conventions des indicateurs clés

Coût de maintenance d'un périmètre sur une période :

```latex
C_{\text{maint}} = \sum C_{\text{MO}} + \sum C_{\text{pièces}} + \sum C_{\text{prestations}}
```

Coût par heure de fonctionnement (ou par kilomètre), où ΔH est l'augmentation du compteur cumulé sur la période, remplacements de compteur neutralisés (13.2) :

```latex
C_{h} = \frac{C_{\text{maint}}}{\Delta H}
```

Disponibilité technique, où T requis est le temps d'exploitation prévu (par défaut 24 h par jour calendaire, ou calendrier d'exploitation du site \[AC\]) et T immo la durée passée en état « Immobilisé » ou « En maintenance » pendant ce temps :

```latex
D = \frac{T_{\text{requis}} - T_{\text{immo}}}{T_{\text{requis}}}
```

MTBF (moyenne des temps de bon fonctionnement), où T fonct est le nombre d'heures moteur réalisées sur la période (ou le temps passé « En service » pour un équipement sans compteur) :

```latex
\text{MTBF} = \frac{T_{\text{fonct}}}{N_{\text{défaillances}}}
```

MTTR (moyenne des temps de réparation), en temps calendaire, du premier passage « En cours » au passage « Travaux terminés », moins les périodes « En attente » intermédiaires :

```latex
\text{MTTR} = \frac{\sum \left( t_{\text{fin travaux}} - t_{\text{début travaux}} - t_{\text{attente}} \right)}{N_{\text{réparations}}}
```

Temps moyen d'immobilisation par panne, de la décision d'immobilisation à la remise en service validée, attentes comprises :

```latex
\text{MDT} = \frac{\sum \left( t_{\text{remise en service}} - t_{\text{immobilisation}} \right)}{N_{\text{pannes}}}
```

Conventions communes :

- **Défaillance** = OT correctif de type « panne » ayant entraîné une immobilisation. Sont exclus : préventif, contrôles réglementaires, accidents et dégâts (suivis séparément), améliorations, DI rejetées. Une réouverture n'est pas une nouvelle défaillance ; un OT « récidive » en est une.
- Moins de 3 défaillances sur la période : MTBF et MTTR affichés « non significatif » \[AC\].
- Une immobilisation à cheval sur deux périodes est répartie au prorata du temps passé dans chacune.
- Pour les véhicules, le MTBF peut s'exprimer en kilomètres entre défaillances.

### 9.3 Catalogue des indicateurs

| Indicateur | Formule ou convention | Données nécessaires | Mailles |
| --- | --- | --- | --- |
| Coût de maintenance | C maint (9.2) | Pointages, taux horaires, sorties valorisées, factures | Équipement, catégorie, site, société, chantier, mois |
| Répartition des coûts | Part de main-d'œuvre, pièces et prestations dans C maint | Idem | Idem |
| Part du préventif | Heures (ou coût) des OT préventifs et réglementaires ÷ total | Type d'OT | Site, catégorie |
| Coût par heure ou par km | C h (9.2) | Compteurs cumulés | Équipement, modèle, catégorie |
| Disponibilité technique | D (9.2) | Historique des états | Équipement, catégorie, chantier |
| Durée d'immobilisation | Somme des durées, ventilée par motif (diagnostic, pièces, prestataire, réparation) | États et motifs d'attente des OT | Équipement, site |
| MTBF, MTTR, MDT | Formules de 9.2 | OT de type panne, horodatages | Équipement, modèle, sous-ensemble |
| Respect du planning préventif | Échéances réalisées dans la tolérance ÷ échéances arrivées à terme sur la période | Échéances et dates de réalisation | Site, atelier, catégorie |
| Interventions en retard | OT ouverts dont l'échéance (préventif) ou le délai cible (correctif, 5.2) est dépassé ; âge moyen du carnet | Échéances, priorités | Atelier, technicien |
| Respect des délais P1 et P2 | DI prises en charge puis remises en service dans les délais cibles ÷ DI de la priorité | Horodatages DI et OT | Site |
| Pannes récurrentes | Équipement avec au moins 3 pannes sur 90 jours glissants, ou même cause sur le même sous-ensemble au moins 2 fois sur 90 jours \[AC\] | Codification des défauts | Équipement, modèle |
| Consommation de pièces | Quantités et valeurs sorties ; 20 premiers articles | Mouvements | Article, famille, équipement |
| Ruptures | Taux de service = lignes servies à la date demandée ÷ lignes demandées ; nombre et durée des OT en attente de pièces | Réservations, statuts d'OT | Magasin, article |
| Stock | Valeur ; rotation = consommation annuelle ÷ stock moyen ; stock dormant sans sortie depuis 12 mois \[AC\] | Mouvements valorisés | Magasin, société |
| Budget et réalisé | Réalisé + engagé (commandé non facturé) comparé au budget ; écart en valeur et en % | Budgets saisis ou importés | Site, catégorie, équipement, mois |

### 9.4 Aide à la décision : réparer ou remplacer

Pour chaque équipement, une fiche d'analyse rassemble : âge et usage cumulé comparés à la durée de vie économique de référence de sa catégorie \[AC\] ; coût de maintenance des 12 derniers mois et tendance du coût par heure ; disponibilité et nombre de pannes sur 12 mois ; position du coût par heure par rapport aux équipements du même modèle ; valeur de marché estimée (saisie ou importée). La GMAO signale l'équipement quand le ratio suivant dépasse un seuil, par exemple 50 % \[AC\] :

```latex
R = \frac{C_{\text{réparation envisagée}} + C_{\text{maint, 12 mois}}}{V_{\text{marché estimée}}}
```

La décision reste humaine ; elle est enregistrée sur la fiche avec son auteur, sa date et sa justification.

### 9.5 Tableaux de bord par profil

| Profil | Contenu principal |
| --- | --- |
| Direction | Coûts par société et site, disponibilité de la flotte, budget et réalisé, 10 équipements les plus coûteux |
| Responsable maintenance | Carnet de commandes, retards préventifs, MTBF, MTTR, pannes récurrentes, part du préventif |
| Gestionnaire de flotte | Équipements immobilisés, disponibilité par catégorie et chantier, échéances réglementaires, compteurs non relevés |
| Chef d'atelier | OT du jour, charge et capacité, OT en attente par motif, DI à qualifier |
| Magasinier | Articles sous seuil, réservations à préparer, transferts en cours, inventaires |
| Responsable achats | Demandes à valider, commandes en retard, factures bloquées, évaluation des prestataires |

### 9.6 Exigences

| Identifiant | Besoin | Description | Priorité | Règle métier | Critère d'acceptation |
| --- | --- | --- | --- | --- | --- |
| KPI-01 | Coût complet par OT | Main-d'œuvre, pièces et prestations selon 9.1 | Must | Chaque coût est rattaché à un OT ou un centre de coût | Sur un OT de test, le coût affiché est égal à la somme recalculée à la main |
| KPI-02 | Taux horaires datés | Taux par technicien ou qualification, avec dates de validité | Must | Le taux applicable est celui à la date du pointage | Changer un taux ne modifie pas le coût des OT déjà clôturés |
| KPI-03 | Disponibilité et immobilisations | Indicateurs D et durées d'immobilisation par motif | Must | Conventions de 9.2 | Sur un jeu de test de 3 équipements et 6 immobilisations, les valeurs sont exactes à la minute |
| KPI-04 | MTBF, MTTR, MDT | Calculs selon 9.2 | Must | Seuil de significativité paramétrable | Les résultats du jeu de test correspondent aux valeurs attendues fournies par l'entreprise |
| KPI-05 | Préventif et retards | Respect du planning, liste des interventions en retard | Must | Une échéance réalisée dans la tolérance est « respectée » | Les cas A et B de 4.4 sont comptés comme respectés |
| KPI-06 | Pannes récurrentes | Détection selon la règle de 9.3 | Should | Seuils paramétrables | Un équipement avec 3 pannes en 60 jours apparaît dans la liste |
| KPI-07 | Pièces et ruptures | Consommations, taux de service, OT en attente de pièces | Must | Conventions de 9.3 | Le taux de service d'un jeu de test est exact |
| KPI-08 | Budget et réalisé | Budgets par site, catégorie, équipement et mois ; réalisé et engagé | Should | L'engagé = commandé non facturé | L'écart affiché est égal à budget − (réalisé + engagé) |
| KPI-09 | Réparer ou remplacer | Fiche d'analyse et alerte selon 9.4 | Should | Seuil paramétrable par catégorie | Un équipement dont R dépasse le seuil est signalé |
| KPI-10 | Tableaux de bord par profil | Tableaux de 9.5, filtres par société, site, catégorie, période ; accès au détail jusqu'à l'OT | Must | Périmètre de l'utilisateur appliqué | Depuis un total, deux clics mènent à la liste des OT qui le composent |
| KPI-11 | Export et outils de BI | Export des indicateurs et accès aux données par API ou entrepôt | Should | Droits appliqués aux exports | Un outil de BI se connecte et lit les coûts par OT |
| KPI-12 | Calculs documentés | Formules publiées et jeu de test de référence | Must | Toute évolution de formule est versionnée | Le prestataire fournit le jeu de test et ses résultats attendus avant la recette |
| KPI-13 | Fraîcheur des données | Mise à jour des tableaux de bord | Must | Délai maximal 15 minutes \[AC\] | Un OT clôturé apparaît dans les indicateurs en moins de 15 minutes |

## 10. Application mobile

L'application mobile est l'outil principal des techniciens, conducteurs et magasiniers. Elle fonctionne sans réseau sur les chantiers et se synchronise sans créer de doublon ni perdre de saisie.

### 10.1 Principes d'ergonomie

- Smartphones et tablettes iOS et Android, y compris terminaux durcis ; versions minimales à confirmer \[AC\].
- Usage avec gants et en plein soleil : grandes zones tactiles, contrastes élevés, saisie minimale (listes, scan, photo, valeurs proposées).
- Un signalement simple en 3 écrans au plus.
- Langues : français par défaut ; autres langues, dont écriture de droite à gauche si l'arabe est retenu, à confirmer \[AC\].

### 10.2 Fonctions par profil

| Fonction | Technicien | Conducteur ou opérateur | Magasinier | Chef d'atelier |
| --- | --- | --- | --- | --- |
| Scan QR code ou code-barres | Oui | Oui | Oui (articles et emplacements) | Oui |
| Consultation de la fiche équipement et de l'historique | Oui | Limitée (état, prochaines échéances) | — | Oui |
| Création et suivi de DI | Oui | Oui | — | Oui |
| Relevé de compteur | Oui | Oui | — | Oui |
| Contrôle de prise de poste (checklist) | — | Oui | — | — |
| Liste des OT affectés, démarrage et arrêt | Oui | — | — | Oui |
| Checklists, mesures, photos, compte rendu | Oui | — | — | Oui |
| Temps passé | Oui | — | — | Oui |
| Pièces consommées et déposées | Oui | — | Oui | Oui |
| Réception, sortie, transfert, inventaire | — | — | Oui | — |
| Qualification de DI, affectation d'OT | — | — | — | Oui |
| Validation de remise en service | — | — | — | Oui (si habilité) |

### 10.3 Fonctionnement hors connexion

- **Données embarquées** : OT affectés à l'utilisateur, équipements de son périmètre (site ou chantiers affectés), gammes et checklists associées, derniers OT de chaque équipement (par exemple les 10 derniers \[AC\]), catalogue et stock du magasin mobile, listes de valeurs.
- **Actions possibles hors connexion** : créer une DI, relever un compteur, démarrer et arrêter un pointage, remplir une checklist, prendre des photos, consommer des pièces, passer un OT en « Travaux terminés », inventorier un magasin mobile.
- **Actions nécessitant une connexion** : validations (achats, remise en service d'un équipement A), création d'équipement, modification de plans d'entretien, consultation hors périmètre embarqué.
- **Autonomie** : au moins 7 jours sans connexion sans perte de données \[AC\]. L'application indique en permanence l'état de connexion, la date de dernière synchronisation et le nombre d'éléments en attente.

### 10.4 Synchronisation, doublons et conflits

- Chaque objet créé sur le mobile reçoit un identifiant unique au moment de sa création ; le serveur ignore un objet déjà reçu. Une synchronisation interrompue reprend là où elle s'est arrêtée.
- Les opérations sont envoyées dans l'ordre de leur création et horodatées avec l'heure du terminal et l'heure serveur ; un écart d'horloge supérieur à 5 minutes \[AC\] est signalé.
- Les photos sont compressées (par exemple 1 920 px et 1 Mo au plus \[AC\]) et envoyées en arrière-plan, après les données.

| Cas de conflit | Règle de résolution |
| --- | --- |
| OT annulé ou réaffecté sur le web pendant que le technicien travaillait hors connexion | Les saisies du technicien (temps, pièces, photos) sont conservées et rattachées à l'OT ; le chef d'atelier est alerté pour arbitrer ; aucune saisie n'est perdue |
| Même champ modifié sur le web et sur le mobile | La version serveur est conservée, la version mobile est enregistrée dans l'historique et l'auteur est notifié ; les champs différents sont fusionnés |
| Deux DI hors connexion sur le même équipement | Les deux sont enregistrées et signalées comme doublons potentiels au chef d'atelier |
| Relevé de compteur antérieur à un relevé déjà reçu (par exemple télématique) | Accepté comme relevé historique s'il est cohérent avec les relevés qui l'encadrent, sinon mis « à vérifier » (13.2) |
| Consommation d'une pièce dont le stock serveur est insuffisant | Mouvement enregistré « à régulariser », stock non négatif, magasinier alerté (7.5) |
| Pointages qui se chevauchent pour un même technicien | Le second est mis « à vérifier », le chef d'atelier corrige |

### 10.5 Sécurité du terminal

Authentification unique de l'entreprise avec réouverture par code ou biométrie ; données locales chiffrées ; session hors connexion limitée dans le temps \[AC\] ; effacement des données locales à la déconnexion ou à distance via l'outil de gestion de flotte mobile de l'entreprise, s'il existe.

### 10.6 Exigences

| Identifiant | Besoin | Description | Priorité | Règle métier | Critère d'acceptation |
| --- | --- | --- | --- | --- | --- |
| MOB-01 | Application iOS et Android | Fonctions de 10.2 selon le rôle | Must | Mêmes droits et périmètres que sur le web | Un conducteur ne voit pas le menu des stocks |
| MOB-02 | Scan | QR code et code-barres via la caméra, y compris en faible luminosité | Must | Un code inconnu affiche un message explicite | Le scan d'une étiquette abîmée ou d'un code inconnu ne bloque pas l'application |
| MOB-03 | Demandes d'intervention | Création et suivi des DI | Must | Voir COR-01 | Le déclarant voit l'évolution du statut de sa DI |
| MOB-04 | Relevé de compteurs | Saisie avec contrôle immédiat de cohérence | Must | Règles DON-01 à DON-03 | Un relevé inférieur au précédent est signalé avant envoi |
| MOB-05 | Checklists, photos, comptes rendus | Saisie guidée, mesures avec bornes, photos annotées | Must | Points obligatoires bloquants pour terminer | Un OT ne passe pas « Travaux terminés » avec un point obligatoire vide |
| MOB-06 | Temps et pièces | Pointage, consommation par scan des articles | Must | Règles 7.5 | Une pièce scannée est consommée sur l'OT ouvert |
| MOB-07 | Hors connexion | Données et actions de 10.3 | Must | Autonomie de 7 jours \[AC\] | En mode avion pendant 7 jours, toutes les saisies sont conservées puis synchronisées |
| MOB-08 | Synchronisation sans doublon | Identifiants uniques, reprise après coupure | Must | Idempotence | Une synchronisation coupée puis relancée trois fois ne crée aucun doublon |
| MOB-09 | Gestion des conflits | Règles du tableau 10.4 | Must | Aucune saisie terrain perdue | Chaque cas du tableau est reproduit en recette avec le résultat attendu |
| MOB-10 | Inventaire mobile | Comptage par scan d'emplacement et d'article | Should | Règle 8 de 7.5 | Un inventaire de 100 lignes est saisi et validé depuis le mobile |
| MOB-11 | Signature | Signature du conducteur ou du client sur le bon d'intervention | Should | Nom, date et heure enregistrés | Le PDF de l'OT affiche la signature |
| MOB-12 | Dictée vocale | Saisie du compte rendu à la voix | Could | Texte modifiable avant validation | Une dictée de 30 secondes est transcrite dans le champ |
| MOB-13 | Sécurité du terminal | Mesures de 10.5 | Must | Données locales chiffrées | Les données locales sont illisibles en dehors de l'application |
|  |  |  |  |  |  |

## 11. Notifications et intégrations

Les alertes vont à la bonne personne, par le bon canal, avec une escalade si personne ne réagit. Les échanges avec les autres systèmes ont chacun une source de référence, une fréquence et une gestion d'erreurs définies.

### 11.1 Notifications

Une règle de notification définit : l'événement, une condition (société, site, criticité, priorité, montant), les destinataires (par rôle et périmètre, ou nominatifs), les canaux (dans l'application, notification mobile, courriel ; SMS et messagerie d'équipe en option), un délai d'escalade et le destinataire de l'escalade. Un récapitulatif quotidien regroupe les alertes non urgentes. Chaque utilisateur règle ses préférences, sauf pour les alertes déclarées obligatoires.

| Événement | Destinataires par défaut | Canal | Escalade proposée \[AC\] |
| --- | --- | --- | --- |
| DI de priorité P1 | Chef d'atelier du site, responsable maintenance | Mobile + courriel | Non prise en charge sous 1 h : direction du site |
| Échéance préventive en pré-alerte | Chef d'atelier, gestionnaire de flotte | Récapitulatif quotidien | — |
| Préventif en retard hors tolérance | Chef d'atelier | Application + courriel | Après 7 jours : responsable maintenance |
| Contrôle réglementaire à J−30, J−7, J0 | Gestionnaire de flotte, responsable maintenance | Courriel | À J0 : direction, et blocage selon PRV-12 |
| Article sous le point de commande | Magasinier, responsable achats | Application | — |
| Pièce réservée reçue | Technicien et chef d'atelier de l'OT | Mobile | — |
| Validation en attente (achat, devis, remise en service) | Valideur | Application + courriel | Relance à 48 h, puis suppléant |
| OT en attente depuis plus de 5 jours | Chef d'atelier | Récapitulatif quotidien | Après 10 jours : responsable maintenance |
| Document, garantie ou contrat arrivant à échéance | Gestionnaire de flotte, responsable achats | Courriel | — |
| Compteur non relevé depuis 15 jours ou relevé « à vérifier » | Gestionnaire de flotte | Récapitulatif quotidien | — |
| Échec d'une interface | Administrateur | Courriel | Après 4 h sans résolution : responsable du SI |

### 11.2 Imports et exports

- Modèles Excel et CSV fournis pour : équipements, compteurs, plans d'entretien, dernières réalisations, articles, stocks initiaux, fournisseurs, utilisateurs, techniciens, budgets.
- Chaque import passe par une **simulation** qui applique tous les contrôles et produit un rapport ligne par ligne, avant exécution réelle. L'utilisateur choisit entre « tout ou rien » et « lignes valides seulement ».
- Toute liste filtrée est exportable en Excel et CSV, dans le respect des droits ; les exports volumineux sont produits en tâche de fond et notifiés.

### 11.3 Interfaces

| Système | Données échangées | Sens | Fréquence \[AC\] | Source de référence |
| --- | --- | --- | --- | --- |
| Annuaire d'entreprise (authentification unique) | Utilisateurs, groupes, statut actif | Annuaire → GMAO | À chaque connexion + synchronisation quotidienne | Annuaire pour l'identité ; GMAO pour rôles et périmètres |
| ERP et comptabilité | Sociétés, centres de coût, fournisseurs, valeurs d'acquisition ; commandes, réceptions, factures (scénario B de 8.1) ; coûts de maintenance par OT et équipement | Dans les deux sens | Quotidien ou temps réel par API ; coûts à la clôture mensuelle | ERP pour fournisseurs, centres de coût, factures ; GMAO pour OT et coûts de maintenance |
| Outil d'achats (s'il est distinct de l'ERP) | Demandes d'achat, commandes, réceptions | Dans les deux sens | Temps réel | Outil d'achats pour les commandes |
| SIRH (option) | Techniciens, absences, taux horaires ; heures pointées en retour | Dans les deux sens | Quotidien | SIRH pour les salariés et absences ; GMAO pour les heures de maintenance |
| Télématique des constructeurs ou agrégateur | Heures moteur, kilométrage, position, codes défaut, consommation, alarmes | Télématique → GMAO | Horaire à quotidien | Télématique pour les compteurs quand elle est disponible ; relevés manuels contrôlés par rapport à elle |
| Boîtiers GPS tiers | Positions, entrées et sorties de zones de chantier | GPS → GMAO | 15 minutes à quotidien | GPS pour la position ; GMAO pour l'affectation (changement proposé, jamais automatique) |
| Capteurs IoT (évolution) | Mesures agrégées (température, pression, vibrations, niveaux), dépassements de seuil | Plateforme IoT → GMAO | Selon capteur ; la GMAO stocke les agrégats et les événements | Plateforme IoT |
| Cartes carburant (option) | Pleins, volumes, kilométrage déclaré | Fournisseur → GMAO | Quotidien | Fournisseur de cartes |
| Outil de BI | Toutes les données autorisées | GMAO → BI | Quotidien ou à la demande | GMAO |

Pour la télématique d'engins de chantier et de camions, le prestataire indique les standards et connecteurs qu'il supporte (par exemple ISO 15143-3, dit AEMP 2.0, pour les engins, et rFMS pour les poids lourds) ; la compatibilité réelle est à vérifier marque par marque sur le parc.

**Gestion des erreurs, commune à toutes les interfaces** : journal de chaque échange (horodatage, volume, statut) ; file des rejets consultable avec motif ; correction et rejeu unitaire ou en masse ; aucun doublon en cas de rejeu (clé fonctionnelle unique : numéro de pièce, numéro de série + horodatage) ; valeurs aberrantes mises en quarantaine sans bloquer le reste du flux ; alerte à l'administrateur ; tableau de bord de supervision des interfaces ; absence de données télématiques sur un équipement pendant 48 h signalée \[AC\].

| Interface | Erreur typique | Traitement attendu |
| --- | --- | --- |
| Annuaire | Utilisateur sans rôle ou périmètre GMAO | Compte créé sans droit, administrateur alerté |
| ERP et comptabilité | Fournisseur ou centre de coût inconnu, facture sans commande | Rejet avec motif, correction dans le système source, rejeu |
| Outil d'achats | Commande sans demande d'achat GMAO correspondante | Commande intégrée « non rattachée », à affecter par l'acheteur |
| SIRH | Absence sur un technicien inconnu | Ligne rejetée, autres lignes intégrées |
| Télématique | Numéro de série inconnu, compteur en recul, saut aberrant | Donnée en quarantaine, gestionnaire de flotte alerté ; aucune échéance recalculée sur une valeur en quarantaine |
| GPS | Position absente ou imprécise | Dernière position connue conservée avec son horodatage |
| Capteurs IoT | Capteur muet ou mesures incohérentes | Alerte de perte de signal ; aucune DI automatique sur une mesure invalide |
| Cartes carburant | Kilométrage déclaré incohérent avec le compteur | Plein intégré, kilométrage ignoré et signalé |
| Outil de BI | Extraction interrompue | Reprise automatique à la prochaine fenêtre, alerte si deux échecs successifs |

### 11.4 Maintenance prédictive : une évolution conditionnée par les données

| Niveau | Principe | Données prérequises | Phase |
| --- | --- | --- | --- |
| Conditionnelle | Un code défaut ou une mesure hors seuil crée une DI ou un OT | Télématique ou capteurs fiables, rattachés aux bons équipements | 3 |
| Surveillance de tendances | Détection de dérives (consommation d'huile, températures, pressions) | 6 à 12 mois de mesures continues | 3 ou 4 |
| Prédictive | Estimation de la probabilité de panne d'un sous-ensemble | 12 à 24 mois de pannes codifiées par sous-ensemble, en nombre suffisant par modèle, et mesures horodatées | 4, après étude de faisabilité |

Le passage au niveau prédictif n'est engagé que si la codification des pannes (COR-04) est renseignée sur au moins 90 % des OT de type panne \[AC\] et si une étude sur les données réelles démontre un gain mesurable.

### 11.5 Exigences

| Identifiant | Besoin | Description | Priorité | Règle métier | Critère d'acceptation |
| --- | --- | --- | --- | --- | --- |
| NOT-01 | Règles de notification | Événement, condition, destinataires, canaux, sans développement | Must | Les destinataires respectent leur périmètre | Une règle créée par l'administrateur s'applique dès l'événement suivant |
| NOT-02 | Escalade | Délai et destinataire d'escalade par règle | Must | L'escalade s'arrête dès la prise en charge | Une DI P1 non prise en charge après 1 h est notifiée à la direction du site |
| NOT-03 | Notifications par défaut | Jeu de règles du tableau 11.1 livré et activable | Must | Alertes obligatoires non désactivables | Chaque ligne du tableau est vérifiée en recette |
| NOT-04 | Récapitulatif quotidien | Regroupement des alertes non urgentes | Should | Heure d'envoi paramétrable | Un utilisateur reçoit un seul courriel par jour pour ses pré-alertes |
| NOT-05 | SMS et messagerie d'équipe | Canaux supplémentaires | Could | Réservés aux alertes P1 et escalades | Une DI P1 déclenche un SMS si le canal est activé |
| INT-01 | Imports et exports | Modèles, simulation, rapport d'erreurs, exports filtrés | Must | Mêmes contrôles qu'en saisie | Voir EQP-13 |
| INT-02 | API ouverte | API documentée couvrant les objets principaux (voir TEC-09) | Must | Droits et périmètres appliqués | Un tiers lit et crée un OT via l'API dans l'environnement de test |
| INT-03 | Authentification unique | Connexion avec l'annuaire de l'entreprise | Must | Un compte désactivé dans l'annuaire n'accède plus à la GMAO | La connexion suivante est refusée immédiatement ; les sessions mobiles ouvertes sont révoquées sous 24 h |
| INT-04 | ERP et comptabilité | Flux du tableau 11.3 selon le scénario retenu | Should | Sources de référence respectées | Une facture saisie dans l'ERP apparaît sur l'OT concerné le lendemain au plus tard |
| INT-05 | Télématique | Récupération des compteurs et codes défaut | Should | Rapprochement par numéro de série ; relevés soumis à DON-01 à DON-03 | Les heures moteur d'un engin connecté sont mises à jour sans saisie et déclenchent les échéances |
| INT-06 | Supervision des interfaces | Journal, rejets, rejeu, alertes | Should | Aucun doublon au rejeu | Un rejet corrigé puis rejoué est intégré une seule fois |
| INT-07 | GPS et zones de chantier | Position et détection d'entrée ou sortie de zone | Could | Changement d'affectation proposé, jamais automatique | La sortie d'un engin de sa zone de chantier est signalée au gestionnaire de flotte |
| INT-08 | Maintenance conditionnelle | DI ou OT créés sur code défaut ou dépassement de seuil | Could | Pas de doublon si une DI est déjà ouverte pour le même code | Un code défaut reçu crée une DI, un second envoi identique ne la duplique pas |
| INT-09 | Maintenance prédictive | Modèles de prédiction de pannes | Won't | Conditions de 11.4 | Hors périmètre de cette version ; l'architecture permet de l'ajouter |

## 12. Exigences techniques et sécurité

Toutes les valeurs chiffrées de cette section sont des propositions à valider \[AC\]. Le prestataire s'engage sur chacune ou propose la sienne, avec ses moyens de mesure.

### 12.1 Architecture et hébergement

- Application web responsive, compatible avec les deux dernières versions de Chrome, Edge, Firefox et Safari.
- Application mobile iOS et Android (native ou multiplateforme) avec base locale chiffrée pour le hors connexion.
- Back-end conçu autour d'API : l'interface web, le mobile et les intégrations utilisent les mêmes API.
- Hébergement en cloud (SaaS) recommandé ; une variante sur site ou en cloud privé est chiffrée séparément, avec ses prérequis. Pays d'hébergement des données à confirmer.
- Environnements : production, recette (préproduction), bac à sable pour les API ; formation en option.

### 12.2 Isolation des données entre sociétés

- **Entre clients** de la solution : isolation garantie au niveau de la base de données (base dédiée, ou identifiant de client imposé à chaque requête et contrôlé par la base). Le prestataire décrit son modèle et ses tests.
- **Entre sociétés d'un même groupe** : cloisonnement par les périmètres (2.3), avec partage explicite et paramétrable de certains référentiels (catalogue de pièces, plans types, modèles).
- Les tests d'intrusion couvrent l'accès aux données d'un autre client et d'une autre société du groupe.

### 12.3 Authentification, droits et journal d'audit

- Authentification unique via SAML 2.0 ou OpenID Connect avec l'annuaire de l'entreprise ; comptes locaux limités aux prestataires, avec double facteur.
- Double facteur obligatoire pour les administrateurs et les comptes externes.
- Expiration de session web après 30 minutes d'inactivité ; verrouillage après 5 échecs de connexion \[AC\].
- API sécurisées par OAuth 2.0 avec des droits limités par application cliente.
- Journal d'audit en ajout seul, conservé 3 ans \[AC\], consultable et exportable par les rôles autorisés.

### 12.4 Performance, disponibilité et volumétrie

| Action | Objectif proposé (95 % des cas) \[AC\] |
| --- | --- |
| Ouverture d'une fiche ou d'une liste de 50 lignes | ≤ 2 s |
| Recherche d'un équipement ou d'un article | ≤ 1 s |
| Scan d'un QR code jusqu'à l'affichage de la fiche | ≤ 2 s en ligne, ≤ 1 s hors connexion |
| Tableau de bord standard | ≤ 5 s |
| Synchronisation des données d'une journée type (20 OT) en 4G, hors photos | ≤ 60 s |
| Recalcul des échéances après un relevé de compteur | ≤ 1 min |
| Import de 10 000 lignes | ≤ 10 min |

**Disponibilité** : 99,5 % par mois hors maintenance planifiée, soit environ 3,6 h d'indisponibilité maximale par mois \[AC\]. Maintenance planifiée annoncée 5 jours ouvrés à l'avance, hors plage 6 h – 20 h heure locale des sites \[AC\]. Le prestataire publie un rapport mensuel de disponibilité.

**Hypothèses de dimensionnement**, à remplacer par les valeurs réelles (1.5) ; la solution doit absorber trois fois ces volumes sans changement d'architecture :

| Élément | Hypothèse \[AC\] |
| --- | --- |
| Sociétés / sites / chantiers actifs simultanés | 10 / 50 / 100 |
| Équipements suivis | 5 000 |
| Utilisateurs nommés, dont mobiles | 500, dont 300 |
| Utilisateurs simultanés en pointe | 150 |
| OT par an / DI par an | 60 000 / 30 000 |
| Relevés de compteurs par an (manuels et télématiques) | environ 2 millions |
| Articles au catalogue / mouvements de stock par an | 30 000 / 300 000 |
| Photos et documents | environ 150 Go par an |

### 12.5 Chiffrement, sauvegardes et continuité

- Chiffrement des flux en TLS 1.2 minimum (1.3 recommandé) ; chiffrement des données stockées en AES-256 ou équivalent, clés gérées dans un service dédié.
- Sauvegarde complète quotidienne et journaux continus ; conservation 30 jours ; copie dans une zone géographique distincte \[AC\].
- Perte de données maximale admissible (RPO) : 1 h ; délai de rétablissement (RTO) : 4 h \[AC\].
- Test de restauration au moins semestriel, avec procès-verbal transmis à l'entreprise.
- Plan de continuité et de reprise documenté. En cas d'indisponibilité du serveur, le mobile continue de fonctionner en mode hors connexion.
- Sécurité applicative : référentiel OWASP ASVS niveau 2 \[AC\] ; test d'intrusion par un tiers avant la mise en production puis chaque année ; correction des vulnérabilités critiques sous 7 jours et élevées sous 30 jours \[AC\] ; hébergeur certifié ISO/IEC 27001 ou équivalent ; liste des sous-traitants communiquée.

### 12.6 API et évolutivité

- API REST documentée au format OpenAPI, versionnée, avec pagination, filtres et limites d'appel publiées ; webhooks sur les événements clés (DI créée, statut d'OT modifié, équipement immobilisé, stock sous seuil).
- Paramétrage sans développement : champs personnalisés, listes de valeurs, modèles de documents (bon d'intervention, étiquettes), règles de notification, circuits de validation.
- Multilingue, multidevise, fuseaux horaires (stockage en UTC, affichage dans le fuseau du site).
- Les montées de version conservent le paramétrage ; le prestataire communique sa feuille de route et un calendrier de versions.

### 12.7 Protection des données et conservation

La GMAO traite des données personnelles : utilisateurs, techniciens (temps, compétences, habilitations), conducteurs (affectations, et positions si la télématique rattache un équipement à une personne). Elle applique la minimisation, restreint l'accès aux positions et aux temps individuels, et permet l'information des salariés. La réglementation applicable est à confirmer par pays avec le conseil juridique de l'entreprise (par exemple le RGPD pour les entités établies dans l'Union européenne, la loi organique n° 2004-63 pour les entités tunisiennes).

| Donnée | Durée de conservation proposée \[AC\] |
| --- | --- |
| Historique de maintenance d'un équipement | Vie de l'équipement + 10 ans après sa réforme |
| Rapports de contrôles réglementaires | Durée réglementaire applicable, au minimum la vie de l'équipement |
| Commandes, réceptions, factures | Durée légale comptable du pays |
| Positions GPS détaillées | 2 mois, puis agrégation par équipement, chantier et jour |
| Journal d'audit | 3 ans |
| Comptes désactivés | Nom conservé pour l'historique ; coordonnées supprimées après 1 an |
| Journaux techniques | 12 mois |

### 12.8 Réversibilité

- Export complet en libre-service à tout moment : données structurées (CSV ou JSON), dictionnaire de données, schéma relationnel, documents et photos avec un index qui relie chaque fichier à son objet, journal d'audit.
- En fin de contrat : remise d'un export complet sous 30 jours, assistance à la migration chiffrée dans l'offre, puis suppression des données et des sauvegardes sous 90 jours avec attestation \[AC\].
- Un test de réversibilité fait partie de la recette.

### 12.9 Exigences

| Identifiant | Besoin | Description | Priorité | Règle métier | Critère d'acceptation |
| --- | --- | --- | --- | --- | --- |
| TEC-01 | Web et mobile | Architecture de 12.1 | Must | Mêmes API pour tous les canaux | Toute action réalisable sur le web l'est aussi par l'API |
| TEC-02 | Isolation des clients | Isolation de 12.2 | Must | Aucune requête sans contexte client | Le test d'intrusion ne montre aucun accès aux données d'un autre client |
| TEC-03 | Cloisonnement des sociétés | Périmètres et partages de référentiels | Must | Partage explicite uniquement | Un référentiel non partagé d'une société est invisible des autres |
| TEC-04 | Authentification | Authentification unique, double facteur, politique de session | Must | Double facteur obligatoire pour les administrateurs | Un administrateur sans second facteur ne peut pas se connecter |
| TEC-05 | Journal d'audit | Journal de 12.3 | Must | Ajout seul | Aucune API ni écran ne permet de modifier une ligne du journal |
| TEC-06 | Chiffrement | Flux et données stockées chiffrés | Must | TLS 1.2 minimum | Un test de configuration refuse les connexions en TLS 1.0 et 1.1 |
| TEC-07 | Sauvegarde et restauration | RPO 1 h, RTO 4 h, test semestriel | Must | Procès-verbal de test transmis | Une restauration complète en recette respecte le RTO |
| TEC-08 | Disponibilité | 99,5 % par mois hors maintenance planifiée | Must | Rapport mensuel | Le rapport de disponibilité est fourni chaque mois avec ses incidents |
| TEC-09 | API documentée | API REST OpenAPI, versionnée, webhooks | Must | Compatibilité ascendante sur une version majeure | La documentation est publiée et un bac à sable est accessible avant la recette |
| TEC-10 | Performance | Objectifs du tableau 12.4 | Must | Mesure au 95e centile | Un test de charge à 150 utilisateurs simultanés respecte tous les objectifs |
| TEC-11 | Volumétrie et montée en charge | Hypothèses de 12.4, ×3 sans changement d'architecture | Should | — | Le prestataire fournit les résultats d'un test sur un volume équivalent |
| TEC-12 | Sécurité applicative | ASVS niveau 2, tests d'intrusion, délais de correction | Must | Aucune vulnérabilité critique ouverte à la mise en production | Le rapport du test d'intrusion avant production est remis avec les corrections |
| TEC-13 | Données personnelles | Minimisation, accès restreint aux positions et temps individuels, durées de 12.7 | Must | Purge automatique selon les durées | Les positions de plus de 2 mois sont agrégées automatiquement |
| TEC-14 | Réversibilité | Export complet et fin de contrat selon 12.8 | Must | Formats ouverts et documentés | Le test de réversibilité permet de recharger les données dans une base vierge sans perte |
| TEC-15 | Paramétrage sans code | Champs, listes, modèles, règles, circuits | Should | Conservé lors des montées de version | Un champ personnalisé créé avant une montée de version est toujours présent après |
| TEC-16 | Hébergement sur site | Variante sur site ou cloud privé | Could | Fonctions identiques à la version cloud | Le prestataire liste les écarts éventuels et leurs prérequis |

## 13. Données et règles métier

L'équipement est l'entité pivot : compteurs, plans, DI, OT, pièces montées et coûts s'y rattachent. Les règles ci-dessous garantissent que l'historique reste complet et que les indicateurs restent justes.

### 13.1 Entités principales

&#91;embedded content: modèle de données · 9 domaines, 13 relations principales\]

Chaque OT porte sur un équipement et concentre le temps, les pièces et les prestations ; les coûts remontent ainsi à l'équipement, au site et à la période.

| Domaine | Entités | Relations principales |
| --- | --- | --- |
| Organisation | Groupe, Société, Site, Atelier, Magasin, Emplacement, Chantier | Un groupe a des sociétés ; une société a des sites et des chantiers ; un site a des ateliers et des magasins ; un magasin a des emplacements |
| Équipements | Catégorie, Modèle, Équipement, Sous-ensemble, Affectation, Compteur, Relevé, Événement de compteur, Document, Garantie | Un équipement appartient à une société et à un modèle ; il a des sous-ensembles, des affectations datées, des compteurs ; un compteur a des relevés et des événements (remplacement, correction) |
| Maintenance | Plan d'entretien, Opération, Déclencheur, Échéance, Gamme, DI, OT, Ligne de travaux, Pointage, Immobilisation | Un plan a des opérations ; une opération a des déclencheurs, une gamme et des échéances par équipement ; une échéance ou une DI produit un OT ; un OT a des lignes de travaux, des pointages, des réservations et des mouvements |
| Ressources | Technicien, Équipe, Compétence, Habilitation, Prestataire, Taux horaire | Un technicien a des compétences, des habilitations datées et des taux datés ; un OT est affecté à des techniciens ou à un prestataire |
| Stocks | Article, Compatibilité, Stock, Mouvement, Réservation, Numéro de série, Lot | Un article a des stocks par emplacement, des compatibilités avec des modèles ; un mouvement référence un article, un emplacement et une contrepartie (OT, commande, inventaire) |
| Achats | Fournisseur, Contrat, Devis, Demande d'achat, Commande, Réception, Facture | Une demande peut venir d'un OT ; une commande a des réceptions et des factures ; un contrat couvre des équipements |
| Coûts | Imputation de coût, Budget, Centre de coût | Une imputation relie un montant à un OT, un équipement, un centre de coût et une période |
| Transverse | Utilisateur, Rôle, Périmètre, Validation, Notification, Journal d'audit | Un utilisateur a des couples rôle × périmètre ; chaque objet a des entrées de journal |

### 13.2 Règles métier

Exemple de remplacement de compteur (DON-04) : l'horamètre d'une pelle est remplacé alors qu'il affiche 6 850 h ; le nouveau démarre à 0 h. Le compteur cumulé vaut 6 850 h + la lecture du nouvel horamètre. Une échéance prévue à 7 000 h cumulées se déclenche quand le nouvel horamètre affiche 150 h.

| Identifiant | Besoin | Description | Priorité | Règle métier | Critère d'acceptation |
| --- | --- | --- | --- | --- | --- |
| DON-01 | Compteurs croissants | Contrôle de chaque relevé par rapport aux relevés voisins du même compteur | Must | Relevé ≥ relevé précédent et ≤ relevé suivant, sauf événement de remplacement | Un relevé de 4 100 h après un relevé de 4 120 h est refusé en saisie ou mis « à vérifier » s'il vient d'une interface |
| DON-02 | Plausibilité | Contrôle de l'écart par rapport au temps écoulé | Must | Heures moteur : au plus 24 h par jour calendaire ; km : au plus la vitesse maximale de la catégorie × temps écoulé \[AC\] | 30 h saisies en une journée sont mises « à vérifier » et ne déclenchent aucune échéance |
| DON-03 | Relevés datés et sourcés | Date, heure et source obligatoires (manuel, OT, télématique, import) | Must | Aucun relevé dans le futur | Un relevé daté du lendemain est refusé |
| DON-04 | Remplacement de compteur | Événement avec valeur finale de l'ancien, valeur initiale du nouveau, date, motif | Must | Le cumul est la somme des segments ; les échéances utilisent le cumul | L'exemple ci-dessus donne exactement le déclenchement à 150 h lues |
| DON-05 | Correction de relevé | Correction par un rôle habilité, avec motif | Must | Valeurs avant et après conservées ; échéances et indicateurs recalculés | Après correction, la prochaine échéance affichée tient compte de la nouvelle valeur |
| DON-06 | Conservation de l'historique | Aucune suppression physique des relevés, OT, mouvements, validations ; référentiels utilisés désactivés et non supprimés | Must | Annulation logique traçée | La suppression d'un article déjà mouvementé est refusée ; sa désactivation est possible |
| DON-07 | Remise en service d'un équipement critique | Validation pour les équipements A et après tout défaut de sécurité | Must | Valideur habilité, différent de l'exécutant ; checklist de remise en service complète | Sans validation, l'équipement reste « Immobilisé » et non affectable |
| DON-08 | OT annulé | Annulation motivée | Must | Impossible si du temps ou des pièces sont imputés ; réservations libérées | L'annulation d'un OT avec une pièce consommée est refusée avec l'invitation à clôturer « sans suite » |
| DON-09 | OT reporté | Nouvelle date et motif | Must | Historique des reports ; en mode fixe, la grille préventive n'est pas déplacée | Trois reports successifs apparaissent avec leurs dates et motifs |
| DON-10 | OT rouvert | Réouverture dans le délai de 5.4, sinon OT de récidive lié | Should | La réouverture n'est pas une nouvelle défaillance (9.2) | Un OT rouvert ne fait pas varier le nombre de défaillances |
| DON-11 | Données obligatoires par étape | Contrôles des transitions de 5.4 et des fiches | Must | Message précisant chaque donnée manquante | Une transition refusée liste toutes les données manquantes en une fois |
| DON-12 | Doublons | Clés de détection : marque + numéro de série ; immatriculation active ; marque + référence fabricant ; identifiant fiscal du fournisseur ; relevé identique (compteur, horodatage, valeur) | Must | Blocage pour les référentiels, avertissement pour les DI, ignoré pour les relevés identiques | Chaque clé est testée en recette avec le comportement attendu |
| DON-13 | Affectation unique | Une seule affectation active par équipement | Must | Pas de chevauchement de périodes | Voir EQP-10 |
| DON-14 | Équipement réformé | Aucun nouvel OT, relevé ou affectation | Must | Plans désactivés, pièces dédiées signalées au magasinier | Une DI sur un équipement réformé est refusée |
| DON-15 | Clôture de période | Les coûts d'une période clôturée sont figés | Should | Corrections imputées à la période ouverte suivante | Un retour de pièce sur un OT d'une période clôturée est imputé au mois en cours |
| DON-16 | Horodatage | Stockage en UTC, affichage dans le fuseau du site | Must | L'heure du terminal et l'heure serveur sont conservées pour les saisies mobiles | Deux sites dans des fuseaux différents affichent chacun leur heure locale pour le même événement |

## 14. MVP et feuille de route

Le MVP couvre l'ensemble des exigences **Must** : il suffit à un site pilote pour gérer son parc, son préventif, ses pannes, ses OT, un stock de base et ses principaux indicateurs, sur le web et sur le mobile hors connexion. Les phases suivantes sont ordonnées par valeur métier, dépendances et complexité. Les durées sont indicatives et à confirmer par les prestataires \[AC\].

### 14.1 Contenu du MVP

| Lot | Contenu | Exigences |
| --- | --- | --- |
| Socle | Organisation multi-sociétés, rôles, périmètres, validations, audit, authentification unique, sécurité, sauvegardes, réversibilité | HAB-01, 02, 04, 05, 06, 08 ; TEC-01 à 10, 12 à 14 |
| Équipements et compteurs | Fiche, compteurs multiples, états, criticité, documents, QR codes, affectations, historique, import | EQP-01, 02, 04 à 07, 09 à 11, 13 ; DON-01 à 09, 11 à 14, 16 |
| Préventif | Plans types, déclencheurs, premier seuil atteint, fixe ou glissant, pré-alertes, génération des OT, retards, reports, gammes, contrôles réglementaires | PRV-01 à 04, 06, 08 à 12 |
| Correctif et OT | DI, qualification, OT et statuts, état de l'équipement, intervenants, temps, pièces, compte rendu, remise en service, clôtures, OT externe simple | COR-01, 03, 05 à 13, 15 |
| Planification de base | Calendrier, disponibilités, urgences, conflits | PLA-01, 02, 06, 07 |
| Stock de base | Catalogue, magasins, mouvements, réservations, inventaires, seuils, intégrité, valorisation | STK-01, 03, 04, 05, 07, 08, 14, 15 |
| Mobile | Fonctions par profil, scan, DI, relevés, checklists, temps, pièces, hors connexion, synchronisation, conflits, sécurité | MOB-01 à 09, 13 |
| Indicateurs | Coûts par OT et équipement, disponibilité, MTBF, MTTR, préventif, pièces, tableaux de bord par profil | KPI-01 à 05, 07, 10, 12, 13 ; ACH-10 |
| Notifications et échanges | Règles, escalades, alertes par défaut, imports et exports, API, authentification unique | NOT-01 à 03 ; INT-01 à 03 |

Recommandation : intégrer la codification des défauts (COR-04) dès le MVP si le budget le permet, car chaque mois sans codification est un mois d'historique perdu pour l'analyse des pannes et la maintenance prédictive.

### 14.2 Phases et jalons

&#91;embedded content: feuille de route · 4 phases, 3 jalons\]

Durées indicatives \[AC\] : MVP 5 à 6 mois pilote inclus, consolidation 4 à 6 mois, télématique 3 à 4 mois ; le prédictif n'est engagé qu'après au moins 12 mois de données exploitables. Le déploiement par vagues des autres sites se déroule pendant la phase 2.

- **G1, fin du pilote** : recette sans anomalie bloquante ; au moins 80 % des techniciens actifs chaque semaine sur le mobile ; 100 % des OT du périmètre pilote dans la GMAO ; référentiel validé (15.4).
- **G2, avant la phase 3** : coûts et compteurs fiabilisés sur les sites déployés ; codification des pannes renseignée ; parc connecté inventorié marque par marque \[AC\].
- **G3, avant la phase 4** : codification renseignée sur au moins 90 % des OT de panne depuis 12 mois ; mesures horodatées disponibles ; étude de faisabilité concluante (11.4).

### 14.3 Fonctionnalités des phases suivantes

| Fonctionnalité | Exigences | Valeur métier | Complexité | Dépendances | Phase |
| --- | --- | --- | --- | --- | --- |
| Flux d'achat complet et rapprochement des factures | ACH-01 à 06, 08 | Haute | Moyenne | Scénario A ou B de 8.1 choisi | 2 |
| Intégration ERP et comptabilité | INT-04, INT-06 | Haute | Haute | Référentiels ERP fiables | 2 |
| Planification avancée : compétences, charge et capacité, chantiers, postes | PLA-03 à 05, 08 | Haute | Moyenne | Référentiel des techniciens complet | 2 |
| Sous-ensembles, numéros de série, montage et démontage | EQP-08, STK-10, STK-11 | Haute pour les engins lourds | Moyenne | Catalogue nettoyé | 2 |
| Garanties et dossiers de prise en charge | EQP-12, COR-16 | Moyenne à haute | Faible | Sous-ensembles | 2 |
| Réparables et échanges standard | STK-12, STK-13 | Moyenne | Moyenne | Numéros de série | 2 |
| Codification des défauts et pannes récurrentes | COR-04, KPI-06 | Haute | Faible | — (avançable au MVP) | 2 |
| Compléments préventifs : paliers, projection, suspension | PRV-05, 07, 13 | Moyenne | Faible | Préventif du MVP | 2 |
| Budgets et budget / réalisé | KPI-08 | Haute pour la direction | Faible | Coûts du MVP fiabilisés | 2 |
| Contrats et évaluation des prestataires | ACH-07, ACH-09 | Moyenne | Faible | Flux d'achat | 2 |
| Compléments organisationnels : délégations, accès prestataires, revue, réforme, attributs | HAB-03, 07, 09 ; EQP-03, 14 | Moyenne | Faible | — | 2 |
| Compléments mobiles et stock : inventaire mobile, signature, transferts, compatibilités | MOB-10, 11 ; STK-02, 06 | Moyenne | Faible | — | 2 |
| Télématique et GPS | INT-05, INT-07, EQP-15 | Haute | Haute | Parc connecté, accès aux données des constructeurs | 3 |
| Maintenance conditionnelle | INT-08 | Haute | Moyenne | Télématique intégrée | 3 |
| Réparer ou remplacer, BI | KPI-09, KPI-11 | Moyenne | Faible | 12 mois d'historique de coûts | 3 |
| Montée en charge à l'échelle du groupe | TEC-11 | Haute au déploiement général | Moyenne | Volumes réels connus | Avant déploiement général |
| Options : SMS, dictée, regroupement, prévision de charge, outillage, tournées, sinistres, réapprovisionnement automatique, hébergement sur site | NOT-05, MOB-12, PRV-14, PRV-15, PLA-09, PLA-10, COR-17, STK-09, TEC-16 | Variable | Faible à moyenne | Selon l'option | 3 ou ultérieure |
| Maintenance prédictive | INT-09 | Potentiellement haute | Très haute | Données de 11.4 | 4 |
| Compléments de contrôle : doublons de DI, réouvertures, clôture de période, récapitulatif quotidien, paramétrage sans code | COR-02, COR-14 ; DON-10, DON-15 ; NOT-04 ; TEC-15 | Moyenne | Faible | Correctif du MVP | 2 |

## 15. Recette, déploiement et livrables

La solution est acceptée sur preuves : exigences Must testées, scénarios de bout en bout conformes, données reprises validées, pilote concluant. Chaque livrable a un responsable et un valideur.

### 15.1 Démarche

1. **Cadrage** : ateliers par domaine, réponses aux questions de la section 16, validation des valeurs \[AC\].
2. **Conception détaillée** : spécifications de paramétrage, contrats d'interface, plan de reprise, plan de recette.
3. **Réalisation** : paramétrage, développements, interfaces, livraisons itératives démontrées aux référents métier.
4. **Reprise des données** : au moins deux répétitions complètes avant la bascule.
5. **Recette** : fonctionnelle, interfaces, performance, sécurité, restauration, réversibilité, terrain hors connexion.
6. **Pilote** : un site et un ou deux chantiers pendant 6 à 8 semaines \[AC\].
7. **Déploiement par vagues** de sites, après validation du jalon G1 (14.2).
8. **Vérification de service régulier** : 2 mois d'exploitation sans anomalie bloquante sur le périmètre déployé \[AC\].

### 15.2 Reprise et nettoyage des données

| Données | Source probable | Nettoyage et règles | Critère de validation |
| --- | --- | --- | --- |
| Équipements | Tableurs, ERP, registres d'immobilisations | Dédoublonnage par marque + numéro de série, normalisation des marques et modèles, codification des catégories, champs obligatoires | ≥ 98 % des équipements actifs repris avec tous les champs obligatoires \[AC\] |
| Compteurs | Derniers relevés connus, télématique | Relevé physique des équipements critiques dans les 15 jours précédant la bascule | 100 % des équipements A avec un relevé daté de moins de 15 jours |
| Plans d'entretien | Manuels constructeurs, pratiques des ateliers | Plans types par modèle ; **date et compteur de la dernière réalisation de chaque opération**, indispensables au calcul de la prochaine échéance | Prochaines échéances contrôlées par sondage par les chefs d'atelier |
| Contrôles réglementaires | Registres, rapports des organismes | Dernier rapport joint, prochaine échéance | 100 % des équipements soumis renseignés |
| Historique des interventions | Tableurs, ERP | Option : 2 à 3 dernières années en format simplifié, non modifiable \[AC\] | Totaux par équipement concordants avec la source |
| Articles et stocks | ERP, tableurs, magasins | Dédoublonnage des articles, désignations normalisées ; stock initial = inventaire physique à la date de bascule | Écart de valeur entre inventaire et stock repris égal à zéro |
| Fournisseurs, contrats, garanties | ERP, dossiers | Identifiant fiscal, dates d'échéance | Contrats en cours tous repris |
| Utilisateurs et techniciens | Annuaire, SIRH | Rôles, périmètres, compétences, taux horaires | Revue des habilitations signée |
| OT en cours à la bascule | Atelier | Saisie des OT ouverts avec leur avancement | Aucun OT ouvert hors GMAO après la bascule |

L'entreprise est responsable de la qualité et de la validation de ses données. Le prestataire fournit les modèles, les outils de contrôle et de chargement, les rapports d'anomalies et exécute les chargements.

### 15.3 Tests et classement des anomalies

- **Prestataire** : tests unitaires et d'intégration, tests de charge (TEC-10), test d'intrusion (TEC-12), test de restauration (TEC-07), jeux de test des indicateurs (KPI-12).
- **Entreprise, avec l'appui du prestataire** : recette fonctionnelle de toutes les exigences Must, scénarios de 15.9, tests terrain hors connexion sur un chantier réellement sans réseau, test de réversibilité (TEC-14).

| Gravité | Définition | Tolérance pour prononcer l'acceptation |
| --- | --- | --- |
| Bloquante | Empêche un processus couvert par une exigence Must, sans contournement, ou entraîne une perte ou une fuite de données | Aucune |
| Majeure | Dégrade un processus Must ; un contournement existe | 5 au plus \[AC\], avec plan de correction daté |
| Mineure | Gêne d'ergonomie ou de présentation | Corrigées dans une version ultérieure planifiée |

### 15.4 Pilote, bascule et déploiement

- Le pilote se termine au jalon G1 : recette sans anomalie bloquante, au moins 80 % des techniciens actifs chaque semaine sur le mobile, 100 % des OT du périmètre pilote dans la GMAO, référentiel validé.
- Bascule d'un site : inventaire physique, relevés de compteurs, saisie des OT ouverts, arrêt des anciens supports à une date annoncée. Double saisie limitée à 2 semaines au plus \[AC\].
- Vagues de sites planifiées avec une équipe d'accompagnement sur place les premiers jours.

### 15.5 Formation par profil

| Profil | Format | Durée indicative \[AC\] | Contenu |
| --- | --- | --- | --- |
| Administrateurs | Atelier | 3 jours | Paramétrage, utilisateurs, imports, interfaces, supervision |
| Référents métier (formateurs internes) | Atelier | 2 jours | Ensemble des processus, animation des formations |
| Responsables maintenance, gestionnaires de flotte | Atelier | 1,5 jour | Plans d'entretien, échéances, validations, indicateurs |
| Chefs d'atelier | Atelier + accompagnement terrain | 1 jour + 2 jours au démarrage | Qualification, OT, planification, clôture |
| Techniciens | Sur site, sur mobile | 0,5 jour + tutoriels vidéo | OT, checklists, temps, pièces, hors connexion |
| Conducteurs et opérateurs | Sur site | 1 h + fiche réflexe | Signalement, relevé de compteur, prise de poste |
| Magasiniers | Atelier | 1 jour | Mouvements, réservations, inventaires, séries |
| Responsables achats | Atelier | 0,5 jour | Demandes, commandes, rapprochement, contrats |
| Direction | Présentation | 2 h | Tableaux de bord et validations |

### 15.6 Documentation, support et maintenance

- **Documentation** en français : guides par profil, guide d'administration, documentation technique et d'exploitation, documentation des API, dictionnaire de données, formules des indicateurs ; tenue à jour à chaque version.
- **Organisation du support** : niveau 1 assuré par les référents de l'entreprise ; niveaux 2 et 3 par le prestataire, via un outil de tickets, jours ouvrés de 8 h à 18 h heure locale des sites \[AC\] ; astreinte en option pour les anomalies bloquantes.
- **Maintenance** : corrective incluse ; évolutive selon une feuille de route partagée ; montées de version annoncées et testées en recette avant la production.

| Gravité | Prise en charge \[AC\] | Contournement \[AC\] | Correction définitive \[AC\] |
| --- | --- | --- | --- |
| Bloquante | 1 h ouvrée | 4 h ouvrées | 2 jours ouvrés |
| Majeure | 4 h ouvrées | 2 jours ouvrés | 15 jours ouvrés |
| Mineure | 2 jours ouvrés | — | Version suivante planifiée |

### 15.7 Livrables et responsabilités

| Livrable | Prestataire | Entreprise |
| --- | --- | --- |
| Plan projet, planning, comitologie | Réalise | Valide |
| Spécifications de paramétrage et contrats d'interface | Réalise | Valide |
| Solution paramétrée et environnements | Réalise | Recette |
| Modèles, outils et rapports de reprise | Réalise | Utilise |
| Données nettoyées et validées | Assiste | Réalise et valide |
| Plan et cahier de recette | Propose | Complète, exécute, valide |
| Jeux de test des indicateurs | Réalise | Fournit les valeurs attendues, valide |
| Procès-verbaux de recette, d'aptitude et de service régulier | Prépare | Signe |
| Supports et sessions de formation | Réalise | Organise, valide |
| Documentation | Réalise | Valide |
| Rapports de sécurité, de restauration, de disponibilité | Réalise | Valide |
| Plan de réversibilité | Réalise | Valide |
| Communication interne et conduite du changement | Conseille | Réalise |

### 15.8 Critères d'acceptation

La **vérification d'aptitude** est prononcée quand : 100 % des exigences Must sont testées conformes ; aucune anomalie bloquante n'est ouverte ; les anomalies majeures respectent la tolérance de 15.3 ; les scénarios R-01 à R-08 sont conformes ; les tests de performance, sécurité, restauration et réversibilité sont réussis ; la reprise respecte les critères de 15.2. La **vérification de service régulier** est prononcée après 2 mois d'exploitation sans anomalie bloquante, avec un taux de disponibilité conforme à TEC-08 et des indicateurs calculés sur le périmètre déployé.

### 15.9 Scénarios de recette

Les données des scénarios sont des exemples ; l'entreprise les remplace par des équipements réels de son parc avant la recette.

| N° | Scénario | Préconditions | Étapes | Résultats attendus |
| --- | --- | --- | --- | --- |
| R-01 | Entretien arrivé à échéance | Chargeuse CH-012, criticité B ; plan « 250 h ou 3 mois », glissant ; dernière réalisation 10/01/2026 à 4 120 h ; pré-alerte 25 h ; pièces de la gamme en stock | 1. Saisir sur mobile un relevé de 4 346 h. 2. Saisir un second relevé de 4 352 h. 3. Planifier l'OT. 4. Le technicien exécute la checklist, consomme les pièces, pointe 3 h, relève 4 378 h le 24/02/2026. 5. Clôturer | À l'étape 1 : échéance en pré-alerte, OT préventif créé avec gamme et pièces réservées, chef d'atelier notifié. À l'étape 2 : aucun second OT. Après clôture : prochaine échéance 4 628 h ou 24/05/2026 ; coût de l'OT = main-d'œuvre + pièces ; échéance comptée « respectée » (dans la tolérance) |
| R-02 | Panne urgente | Pelle PE-007, criticité A, affectée au chantier C-15 ; un technicien disponible et compétent | 1. Le conducteur crée une DI (photo, arrêt oui). 2. Le chef d'atelier la qualifie P1 et immobilise. 3. Affectation, diagnostic, OT, pièce en stock, travaux, essai. 4. Le technicien tente de valider la remise en service. 5. Le responsable maintenance valide | Notification au chef d'atelier et au responsable maintenance en moins d'1 minute ; escalade à la direction du site si aucune prise en charge sous 1 h (testée sur un second cas) ; équipement « Immobilisé » dès la qualification ; validation par l'exécutant refusée ; après validation, équipement « En service » sur C-15 ; MTTR et durée d'immobilisation calculés selon 9.2 |
| R-03 | Rupture de pièce | OT correctif sur le chariot CE-031 ; pompe hydraulique : 0 au magasin du site A, 1 au magasin du site B ; point de commande 1 | 1. Réserver la pompe. 2. Créer le transfert depuis le site B. 3. Réceptionner le transfert. 4. Reprendre l'OT | Réservation impossible sur A, stock de B affiché ; OT « En attente » motif pièces, équipement toujours « Immobilisé » ; pompe « en transit » ; alerte de seuil envoyée pour B ; à la réception, technicien et chef d'atelier notifiés, OT repasse « Planifié » ; durée d'attente comptée dans l'immobilisation au motif « pièces » ; aucun stock négatif |
| R-04 | Intervention mobile hors connexion | Technicien avec 3 OT synchronisés ; terminal en mode avion | 1. Démarrer un OT, remplir la checklist, prendre 3 photos, consommer 2 pièces du magasin mobile, pointer 2 h 30, relever le compteur, terminer les travaux. 2. Créer une DI sur un autre équipement. 3. Pendant ce temps, sur le web, réaffecter un autre de ses OT. 4. Reconnecter, couper la synchronisation en cours, relancer | Toutes les saisies conservées localement ; après synchronisation : une seule DI, 2 pièces sorties une seule fois, un seul pointage, 3 photos reçues ; stock décrémenté une fois ; pour l'OT réaffecté, saisies conservées et chef d'atelier alerté ; horodatages d'origine conservés |
| R-05 | Remplacement de compteur | Pelle PE-002, horamètre à 6 850 h ; plan 250 h en mode fixe ; prochaine échéance 7 000 h cumulées ; pré-alerte 25 h | 1. Enregistrer le remplacement (ancien 6 850 h, nouveau 0 h, date, motif). 2. Saisir 120 h puis 126 h. 3. Saisir par erreur 6 900 h deux jours plus tard. 4. Saisir 150 h. 5. Réaliser l'entretien à 155 h lues | Étape 2 : rien à 120 h (6 970 h cumulées), pré-alerte et OT à 126 h (6 976 h) ; étape 3 : relevé mis « à vérifier », aucune échéance recalculée ; étape 4 : échéance atteinte ; étape 5 : prochaine échéance 7 250 h cumulées, soit 400 h lues ; courbe d'usage continue ; événement présent dans le journal d'audit |
| R-06 | Contrôle réglementaire échu | Chariot CE-020 soumis à un contrôle périodique échu le 31/03/2026 ; paramètre de blocage actif | 1. Ne joindre aucun rapport avant l'échéance. 2. Tenter d'affecter le chariot à un chantier le 01/04/2026. 3. Joindre un rapport « conforme avec réserves » (1 réserve à 30 jours) | Alertes à J−30 et J−7 ; chariot « Immobilisé » le lendemain de l'échéance ; affectation refusée ; après le rapport, chariot remis en service, réserve suivie avec échéance et alerte |
| R-07 | Cloisonnement entre sociétés | Utilisateur de la société B ; catalogue de pièces partagé au niveau du groupe | Rechercher un équipement de la société A par son code, ouvrir son adresse directe, exporter la liste des équipements, appeler l'API | Aucun résultat, accès refusé, export sans l'équipement, API en refus ; catalogue partagé visible |
| R-08 | Inventaire avec écart | Emplacement A-03 : 12 filtres en stock théorique ; seuil de validation dépassé par un écart de 3 filtres | 1. Compter 9 filtres à 10 h. 2. Sortir 1 filtre sur un OT à 10 h 30. 3. Valider l'inventaire | Écart de −3 « à valider », stock inchangé avant validation ; la sortie de 10 h 30 est enregistrée à part ; après validation, stock = 8, ajustement de −3 tracé et valorisé au coût moyen pondéré |

### 15.10 Facteurs de coût et hypothèses de chiffrage

| Facteur | Effet sur le coût | À préciser par le prestataire |
| --- | --- | --- |
| Modèle de licence | Récurrent | Unité (utilisateur nommé ou simultané, équipement, site), paliers, tarif des utilisateurs occasionnels (conducteurs) |
| Nombre de sociétés, sites, langues | Paramétrage, formation, déploiement | Charge par site supplémentaire |
| Mobile hors connexion | Mise en place et tests terrain | Standard ou développement ; limites connues |
| Reprise de données | Ponctuel, sensible à la qualité des sources | Nombre de répétitions, outils, répartition des tâches |
| Interfaces | Ponctuel et récurrent (maintenance des flux) | Chiffrage par interface ; connecteurs télématiques par marque |
| Développements spécifiques | Ponctuel et maintenance | Liste, charge, impact sur les montées de version |
| Hébergement et engagements de service | Récurrent | Disponibilité, RPO / RTO, localisation, variante sur site |
| Formation et accompagnement | Ponctuel | Nombre de sessions, sites, jours d'accompagnement terrain |
| Support et maintenance | Récurrent | Plages, délais, astreinte, évolutions incluses |
| Réversibilité | Fin de contrat | Prestations incluses et tarifées |

Le prestataire chiffre sur la base des hypothèses de 12.4, du périmètre MVP de 14.1, d'un site pilote et de vagues de déploiement qu'il propose, en français, pour une durée de contrat à confirmer (par exemple 3 ans \[AC\]). Il distingue le ponctuel (mise en place) et le récurrent (annuel), par lot du MVP, par interface, puis pour les phases 2 à 4 et chaque option ; il chiffre les scénarios A et B de 8.1 et liste ses exclusions.

### 15.11 Risques du projet

| Risque | Probabilité | Impact | Mesures |
| --- | --- | --- | --- |
| Données existantes incomplètes ou fausses (compteurs, dernières réalisations) | Haute | Élevé | Lot de reprise dédié, relevés physiques avant bascule, responsables des données nommés |
| Charge de paramétrage des plans d'entretien sous-estimée | Haute | Moyen | Priorité aux modèles critiques, plans types par modèle réutilisés |
| Faible couverture réseau des chantiers | Haute | Moyen | Hors connexion testé en zone réellement sans réseau |
| Télématique hétérogène selon les marques | Haute | Moyen | Phase 3, inventaire marque par marque, agrégateur si besoin |
| Adoption terrain insuffisante | Moyenne | Élevé | Mobile simple, référents, pilote, suivi hebdomadaire de l'usage |
| Dérive du périmètre et spécifique excessif | Moyenne | Élevé | MoSCoW, comité de changements, standard privilégié |
| Indisponibilité des équipes métier pendant le projet | Moyenne | Élevé | Charge des référents planifiée et validée par la direction |
| Réglementation mal identifiée selon les pays | Moyenne | Élevé | Revue juridique et sécurité avant le paramétrage des contrôles |
| Dépendance à l'ERP (scénario B) | Moyenne | Moyen | Contrats d'interface figés tôt, simulateurs pour les tests |
| Dépendance au prestataire | Faible | Élevé | Exigences de réversibilité, formats ouverts, test en recette |

## 16. Questions de cadrage indispensables

Les réponses à ces questions remplacent les valeurs \[AC\] et fixent le périmètre à chiffrer.

1. Combien de sociétés, sites, ateliers, magasins et chantiers actifs, dans quels pays, langues et devises ?
2. Quelle est la composition du parc par catégorie et par marque, et quelle part dispose déjà d'une télématique accessible ?
3. Combien d'utilisateurs par rôle, dont combien sur mobile, et quelle est la couverture réseau réelle des chantiers ?
4. Quels outils sont en place (ERP, comptabilité, achats, annuaire, télématique, tableurs) et lequel reste maître de chaque donnée : scénario A ou B de 8.1 ?
5. Quelle part de la maintenance est confiée à des prestataires, et sous quels types de contrats ?
6. Quels contrôles réglementaires s'appliquent, par pays et par type d'équipement, et un contrôle échu doit-il bloquer l'équipement ?
7. Quelles données existantes sont fiables et reprenables : compteurs, dernières réalisations des entretiens, historique, stocks ?
8. Quelles règles de criticité et de priorité, et quels délais d'intervention l'exploitation attend-elle ?
9. Quels seuils et circuits de validation financière, par société ?
10. Comment imputer les coûts quand un équipement est prêté ou loué à une autre société du groupe ?
11. Quelles exigences d'hébergement et de sécurité du groupe : cloud ou sur site, pays de stockage des données, politiques internes ?
12. Quels budget, date cible du MVP et site pilote sont envisagés ?
