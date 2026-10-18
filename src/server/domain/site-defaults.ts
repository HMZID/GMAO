import type { SiteIcon, SiteItemKind } from "./site";

/**
 * Contenu initial du site commercial, chargé une seule fois dans une base neuve (`ensureSiteContent`) :
 * l'administrateur le modifie, le complète ou le supprime ensuite depuis l'administration.
 * Les témoignages sont livrés non publiés : à remplacer par de vrais clients, avec leur accord.
 */

type DefaultItem = { kind: SiteItemKind; title: string; body?: string; meta?: string; icon?: SiteIcon; published?: boolean };

export const DEFAULT_SITE_ITEMS: DefaultItem[] = [
  { kind: "HIGHLIGHT", title: "30", meta: "jours", body: "d'essai sur votre propre espace, sans carte bancaire" },
  { kind: "HIGHLIGHT", title: "0", meta: "DT", body: "par utilisateur : toutes les offres sont en utilisateurs illimités" },
  { kind: "HIGHLIGHT", title: "100", meta: "%", body: "des saisies terrain possibles hors connexion sur mobile" },
  { kind: "HIGHLIGHT", title: "1", meta: "semaine", body: "pour importer votre parc depuis vos fichiers Excel" },

  { kind: "SECTOR", title: "Travaux publics", icon: "hardhat" },
  { kind: "SECTOR", title: "Carrières et granulats", icon: "mountain" },
  { kind: "SECTOR", title: "Transport et logistique", icon: "truck" },
  { kind: "SECTOR", title: "Location de matériel", icon: "container" },
  { kind: "SECTOR", title: "Collectivités", icon: "landmark" },
  { kind: "SECTOR", title: "Industrie", icon: "factory" },

  {
    kind: "FEATURE",
    title: "Préventif au compteur",
    body: "Plans par heures moteur, kilomètres, cycles ou calendrier, en échéance fixe ou glissante. Les pré-alertes partent avant l'échéance, pas après la casse.",
    meta: "Préventif",
    icon: "gauge",
  },
  {
    kind: "FEATURE",
    title: "Pannes et interventions",
    body: "Du signalement du conducteur à la clôture : diagnostic, pièces, temps passés, immobilisation et remise en service validée.",
    meta: "Correctif",
    icon: "wrench",
  },
  {
    kind: "FEATURE",
    title: "Fiche engin complète",
    body: "Historique, compteurs, affectations, documents et contrôles réglementaires, étiquette QR à coller sur la machine.",
    meta: "Équipements",
    icon: "truck",
  },
  {
    kind: "FEATURE",
    title: "Planning d'atelier",
    body: "Charge par atelier et par technicien, postes de travail, absences et habilitations : chacun sait quoi faire demain.",
    meta: "Planning",
    icon: "calendar",
  },
  {
    kind: "FEATURE",
    title: "Pièces, magasins et camions atelier",
    body: "Stock par magasin, emplacements, points de commande, inventaires tournants et sorties imputées à l'intervention.",
    meta: "Stock",
    icon: "package",
  },
  {
    kind: "FEATURE",
    title: "Achats et validations",
    body: "Demandes d'achat, circuits de validation par seuils, suppléants : les dépenses sont approuvées avant d'être engagées.",
    meta: "Achats",
    icon: "cart",
  },
  {
    kind: "FEATURE",
    title: "Application mobile terrain",
    body: "Interventions à réaliser, checklists, photos, relevés et signalements depuis le chantier, même sans réseau : tout se synchronise au retour.",
    meta: "Mobile",
    icon: "smartphone",
  },
  {
    kind: "FEATURE",
    title: "Indicateurs qui parlent",
    body: "Disponibilité, MTBF, MTTR, coûts par engin et par famille : les chiffres pour décider de réparer, remplacer ou louer.",
    meta: "Pilotage",
    icon: "chart",
  },
  {
    kind: "FEATURE",
    title: "Multi-sociétés, droits fins",
    body: "Groupe, sociétés, sites : chacun voit son périmètre. Journal d'audit complet, connecteur API pour votre ERP.",
    meta: "Organisation",
    icon: "shield",
  },

  {
    kind: "STEP",
    title: "Vous demandez votre espace",
    body: "Deux minutes de formulaire. Nous ouvrons votre organisation avec son atelier, son magasin et ses familles d'engins.",
  },
  {
    kind: "STEP",
    title: "Vous importez votre parc",
    body: "Engins, compteurs, pièces, fournisseurs, techniciens : depuis vos fichiers Excel, avec contrôle des doublons.",
  },
  {
    kind: "STEP",
    title: "L'atelier démarre",
    body: "Plans préventifs appliqués, premières pannes saisies sur mobile, premières interventions clôturées.",
  },
  {
    kind: "STEP",
    title: "Vous décidez",
    body: "À la fin de l'essai, vous passez en abonnement et gardez tout. Ou vous partez, sans engagement.",
  },

  {
    kind: "TESTIMONIAL",
    title: "Prénom Nom",
    meta: "Responsable maintenance, Société exemple",
    body: "Exemple de témoignage : remplacez-le par la citation d'un client, avec son accord, puis publiez-le.",
    published: false,
  },

  {
    kind: "FAQ",
    title: "Comment se passe l'essai gratuit ?",
    body: "Vous remplissez le formulaire, nous validons la demande et vous recevez par courriel le lien de connexion, votre identifiant et un mot de passe provisoire. Vous choisissez votre mot de passe à la première connexion. L'espace est le vôtre : vos données n'y côtoient celles de personne.",
  },
  {
    kind: "FAQ",
    title: "Que deviennent mes données à la fin de l'essai ?",
    body: "Elles sont conservées. Si vous passez en abonnement, vous reprenez exactement où vous en étiez ; sinon l'accès est simplement fermé.",
  },
  {
    kind: "FAQ",
    title: "Faut-il payer par utilisateur ?",
    body: "Non. Le prix dépend du nombre d'équipements suivis ; techniciens, conducteurs, magasiniers et direction sont inclus sans limite.",
  },
  {
    kind: "FAQ",
    title: "L'application fonctionne-t-elle sans réseau sur les chantiers ?",
    body: "Oui pour les saisies : interventions, relevés, photos et signalements sont enregistrés sur le téléphone puis envoyés au retour du réseau, sans doublon.",
  },
  {
    kind: "FAQ",
    title: "Peut-on relier la GMAO à notre ERP ?",
    body: "Oui : une API documentée et des clés d'accès par organisation permettent l'export, l'extraction incrémentale et les imports automatisés.",
  },
];

type DefaultPlan = {
  name: string;
  tagline: string;
  priceMonthly: number | null;
  priceUnit: string;
  priceNote: string;
  features: string[];
  ctaLabel: string;
  badge?: string;
  highlighted?: boolean;
};

export const DEFAULT_SITE_PLANS: DefaultPlan[] = [
  {
    name: "Atelier",
    tagline: "Un site, un atelier, l'essentiel bien fait.",
    priceMonthly: null,
    priceUnit: "Sur devis",
    priceNote: "En dinars tunisiens, selon la taille du parc · dès 10 équipements",
    features: [
      "Équipements, compteurs et documents",
      "Préventif au compteur et au calendrier",
      "Demandes et interventions",
      "Application mobile terrain",
      "Utilisateurs illimités",
    ],
    ctaLabel: "Demander un devis Atelier",
  },
  {
    name: "Flotte",
    tagline: "Plusieurs sites, le stock et les achats sous contrôle.",
    priceMonthly: null,
    priceUnit: "Sur devis",
    priceNote: "En dinars tunisiens, selon la taille du parc · dès 20 équipements",
    features: [
      "Tout Atelier, plus :",
      "Multi-sites et planning d'atelier",
      "Pièces, magasins et inventaires",
      "Achats et circuits de validation",
      "Indicateurs : disponibilité, MTBF, MTTR, coûts",
      "Imports Excel accompagnés",
    ],
    ctaLabel: "Demander un devis Flotte",
    badge: "Le plus choisi",
    highlighted: true,
  },
  {
    name: "Groupe",
    tagline: "Multi-sociétés, intégrations et accompagnement dédié.",
    priceMonthly: null,
    priceUnit: "Sur devis",
    priceNote: "En dinars tunisiens · au-delà de 200 équipements ou plusieurs sociétés",
    features: [
      "Tout Flotte, plus :",
      "Multi-sociétés et périmètres fins",
      "Connecteur API et ETL",
      "Reprise de données et formation sur site",
      "Interlocuteur dédié",
    ],
    ctaLabel: "Parler de votre projet",
  },
];

type DefaultPage = { slug: string; title: string; summary: string; body: string };

export const DEFAULT_SITE_PAGES: DefaultPage[] = [
  {
    slug: "mentions-legales",
    title: "Mentions légales",
    summary: "Éditeur du site, hébergement et propriété intellectuelle.",
    body: `## Éditeur

À compléter : raison sociale, forme juridique, capital, adresse du siège, numéro d'immatriculation, directeur de la publication.

## Hébergement

Application hébergée par Vercel Inc. (région Francfort, Union européenne) ; base de données hébergée par Neon (Union européenne).

## Propriété intellectuelle

Les contenus de ce site (textes, visuels, logiciel) sont protégés. Toute reproduction sans autorisation est interdite.`,
  },
  {
    slug: "confidentialite",
    title: "Politique de confidentialité",
    summary: "Données collectées par le formulaire de demande de démonstration et vos droits.",
    body: `## Données collectées

Le formulaire de demande de démonstration collecte : société, nom, fonction, courriel, téléphone, taille du parc, secteur et message. Ces données servent uniquement à traiter votre demande et à ouvrir votre espace.

## Durée de conservation

Les demandes sont conservées trois ans après le dernier contact, puis supprimées.

## Vos droits

Vous pouvez demander l'accès, la rectification ou l'effacement de vos données en écrivant à l'adresse de contact indiquée en bas de page.

- Aucune donnée n'est revendue.
- Aucun cookie publicitaire n'est déposé.`,
  },
];
