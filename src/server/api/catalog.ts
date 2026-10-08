import "server-only";
import { z } from "zod";
import type { Permission } from "@/server/authz/permissions";
import { documentDeleteInput, documentInput, documentListInput } from "@/server/services/documents";
import { assignmentInput, equipmentFilters, equipmentInput, equipmentUpdateInput, retireInput } from "@/server/services/equipment";
import { decisionInput } from "@/server/services/approvals";
import { preferencesInput } from "@/server/services/email";
import { executeInput } from "@/server/services/imports";
import { indicatorFilters } from "@/server/services/kpi";
import { readingInput, replacementInput, reviewInput } from "@/server/services/meters";
import { weekInput } from "@/server/services/planning";
import { applyPlanInput, dueFilters, planInput } from "@/server/services/preventive";
import { cancelInput, purchaseRequestFilters, purchaseRequestInput } from "@/server/services/purchase-requests";
import { movementInput, partFilters, partInput, supplierInput } from "@/server/services/stock";
import {
  partLineInput,
  planningInput,
  reportInput,
  taskResultInput,
  timeEntryInput,
  transitionSchema,
  workOrderFilters,
  workOrderInput,
} from "@/server/services/work-orders";
import { qualifyInput, rejectInput, workRequestFilters, workRequestInput } from "@/server/services/work-requests";

/**
 * Catalogue de l'API REST v1 (TEC-09, INT-01) : chaque point d'entrée appelle le même service que
 * l'écran correspondant, avec les mêmes règles et les mêmes droits. Les schémas des corps et des
 * filtres sont générés depuis les schémas Zod de validation : la documentation ne peut pas diverger du code.
 */
type Endpoint = {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Corps multipart/form-data (envoi de fichier) au lieu de JSON. */
  multipart?: boolean;
  path: string;
  summary: string;
  permission?: Permission;
  query?: z.ZodType;
  body?: z.ZodType;
};

export const ENDPOINTS: Endpoint[] = [
  { method: "GET", path: "/api/v1/me", summary: "Utilisateur connecté, rôles et droits effectifs par périmètre" },
  { method: "GET", path: "/api/v1/dashboard", summary: "Compteurs du tableau de bord dans le périmètre" },

  { method: "GET", path: "/api/v1/equipment", summary: "Liste paginée des équipements", permission: "equipment.read", query: equipmentFilters },
  {
    method: "POST",
    path: "/api/v1/equipment",
    summary: "Création d'un équipement (plans de la catégorie appliqués)",
    permission: "equipment.write",
    body: equipmentInput,
  },
  { method: "GET", path: "/api/v1/equipment/{id}", summary: "Fiche équipement : compteurs, échéances, interventions", permission: "equipment.read" },
  {
    method: "PATCH",
    path: "/api/v1/equipment/{id}",
    summary: "Modification (null efface un champ facultatif)",
    permission: "equipment.write",
    body: equipmentUpdateInput,
  },
  { method: "GET", path: "/api/v1/equipment/by-qr/{token}", summary: "Résolution de l'étiquette QR (EQP-09)", permission: "equipment.read" },
  {
    method: "POST",
    path: "/api/v1/equipment/{id}/assignments",
    summary: "Affectation à un chantier, un site ou un atelier",
    permission: "assignment.write",
    body: assignmentInput,
  },
  {
    method: "POST",
    path: "/api/v1/equipment/{id}/plans",
    summary: "Application d'un plan d'entretien",
    permission: "plan.write",
    body: applyPlanInput,
  },
  {
    method: "POST",
    path: "/api/v1/equipment/{id}/retire",
    summary: "Réforme (refusée si un OT est ouvert)",
    permission: "equipment.write",
    body: retireInput,
  },

  { method: "GET", path: "/api/v1/meters/{id}/readings", summary: "Derniers relevés d'un compteur", permission: "meter.read" },
  {
    method: "POST",
    path: "/api/v1/meters/{id}/readings",
    summary: "Relevé de compteur, idempotent par clientId",
    permission: "meter.write",
    body: readingInput,
  },
  {
    method: "POST",
    path: "/api/v1/meters/{id}/replacement",
    summary: "Remplacement de compteur (usage cumulé conservé)",
    permission: "meter.correct",
    body: replacementInput,
  },
  {
    method: "POST",
    path: "/api/v1/meter-readings/{id}/review",
    summary: "Validation ou rejet d'un relevé « à vérifier »",
    permission: "meter.correct",
    body: reviewInput,
  },

  {
    method: "GET",
    path: "/api/v1/work-requests",
    summary: "Liste paginée des demandes d'intervention",
    permission: "request.read",
    query: workRequestFilters,
  },
  {
    method: "POST",
    path: "/api/v1/work-requests",
    summary: "Signalement d'une panne ; renvoie les doublons possibles",
    permission: "request.create",
    body: workRequestInput,
  },
  { method: "GET", path: "/api/v1/work-requests/{id}", summary: "Fiche DI", permission: "request.read" },
  {
    method: "POST",
    path: "/api/v1/work-requests/{id}/qualify",
    summary: "Qualification : priorité, type, immobilisation",
    permission: "request.qualify",
    body: qualifyInput,
  },
  {
    method: "POST",
    path: "/api/v1/work-requests/{id}/reject",
    summary: "Rejet motivé (le déclarant est notifié)",
    permission: "request.qualify",
    body: rejectInput,
  },
  { method: "POST", path: "/api/v1/work-requests/{id}/convert", summary: "Transformation en OT correctif", permission: "workorder.manage" },

  { method: "GET", path: "/api/v1/work-orders", summary: "Liste paginée des OT", permission: "workorder.read", query: workOrderFilters },
  { method: "POST", path: "/api/v1/work-orders", summary: "Création d'un OT", permission: "workorder.create", body: workOrderInput },
  {
    method: "GET",
    path: "/api/v1/work-orders/{id}",
    summary: "Fiche OT : coûts, transitions possibles et conditions manquantes",
    permission: "workorder.read",
  },
  {
    method: "PATCH",
    path: "/api/v1/work-orders/{id}",
    summary: "Planification et affectation ; renvoie les avertissements",
    permission: "workorder.manage",
    body: planningInput,
  },
  {
    method: "POST",
    path: "/api/v1/work-orders/{id}/transitions",
    summary: "Changement de statut (machine à états COR-06)",
    permission: "workorder.read",
    body: transitionSchema,
  },
  {
    method: "POST",
    path: "/api/v1/work-orders/{id}/time-entries",
    summary: "Pointage : start, stop ou durée saisie",
    permission: "workorder.execute",
    body: timeEntryInput,
  },
  {
    method: "PATCH",
    path: "/api/v1/work-orders/{id}/tasks/{taskId}",
    summary: "Point de checklist",
    permission: "workorder.execute",
    body: taskResultInput,
  },
  {
    method: "POST",
    path: "/api/v1/work-orders/{id}/parts",
    summary: "Pièces : réservation, sortie, retour",
    permission: "workorder.execute",
    body: partLineInput,
  },
  {
    method: "PUT",
    path: "/api/v1/work-orders/{id}/report",
    summary: "Compte rendu et codification des défauts",
    permission: "workorder.execute",
    body: reportInput,
  },

  { method: "GET", path: "/api/v1/maintenance-plans", summary: "Plans d'entretien", permission: "plan.read" },
  {
    method: "POST",
    path: "/api/v1/maintenance-plans",
    summary: "Création d'un plan et de ses opérations",
    permission: "plan.write",
    body: planInput,
  },
  { method: "GET", path: "/api/v1/maintenance-plans/{id}", summary: "Plan, opérations, déclencheurs et checklists", permission: "plan.read" },
  { method: "GET", path: "/api/v1/due-items", summary: "Échéances préventives ouvertes", permission: "plan.read", query: dueFilters },
  { method: "POST", path: "/api/v1/preventive/generate", summary: "Génération des OT préventifs (idempotente)", permission: "workorder.manage" },

  { method: "GET", path: "/api/v1/parts", summary: "Catalogue des pièces et quantités", permission: "part.read", query: partFilters },
  { method: "POST", path: "/api/v1/parts", summary: "Création d'un article", permission: "part.write", body: partInput },
  { method: "GET", path: "/api/v1/parts/{id}", summary: "Article, stock par magasin, derniers mouvements", permission: "part.read" },
  { method: "GET", path: "/api/v1/stock-levels", summary: "Niveaux de stock (filtre belowReorder)", permission: "stock.read" },
  { method: "GET", path: "/api/v1/stock-movements", summary: "Journal des mouvements", permission: "stock.read" },
  {
    method: "POST",
    path: "/api/v1/stock-movements",
    summary: "Réception, transfert, ajustement, rebut (idempotent par clientId)",
    permission: "stock.move",
    body: movementInput,
  },
  { method: "GET", path: "/api/v1/suppliers", summary: "Fournisseurs et prestataires", permission: "supplier.read" },
  { method: "POST", path: "/api/v1/suppliers", summary: "Création d'un fournisseur", permission: "supplier.write", body: supplierInput },

  {
    method: "GET",
    path: "/api/v1/planning",
    summary: "Planning hebdomadaire par technicien et carnet à planifier",
    permission: "planning.read",
    query: weekInput,
  },
  {
    method: "GET",
    path: "/api/v1/documents",
    summary: "Documents actifs d'un équipement ou d'un OT (factures réservées aux profils achats)",
    permission: "equipment.read",
    query: documentListInput,
  },
  {
    method: "POST",
    path: "/api/v1/documents",
    summary:
      "Ajout d'un document (multipart/form-data, champ « file ») : equipment.write sur un équipement, workorder.execute ou workorder.manage sur un OT (EQP-07, MOB-05)",
    permission: "equipment.write",
    body: documentInput,
    multipart: true,
  },
  { method: "GET", path: "/api/v1/documents/{id}", summary: "Métadonnées d'un document", permission: "equipment.read" },
  {
    method: "GET",
    path: "/api/v1/documents/{id}/content",
    summary: "Contenu du fichier (?download=1 pour forcer le téléchargement)",
    permission: "equipment.read",
  },
  {
    method: "DELETE",
    path: "/api/v1/documents/{id}",
    summary: "Retrait logique (gestionnaire, ou auteur tant que l'OT n'est pas clôturé)",
    body: documentDeleteInput,
  },
  {
    method: "GET",
    path: "/api/v1/imports/templates/{kind}",
    summary: "Modèle Excel d'import : equipment, parts ou initial_stock (codes limités au périmètre)",
    permission: "equipment.write",
  },
  { method: "GET", path: "/api/v1/imports", summary: "Derniers imports des types autorisés" },
  {
    method: "POST",
    path: "/api/v1/imports",
    summary:
      "Simulation d'un import (multipart/form-data : kind, file .xlsx) : tous les contrôles de saisie, rien n'est créé. Droit : equipment.write, part.write ou stock.move selon le type",
    multipart: true,
  },
  { method: "GET", path: "/api/v1/imports/{id}", summary: "Diagnostic ligne par ligne d'un import" },
  {
    method: "POST",
    path: "/api/v1/imports/{id}/execute",
    summary: "Exécution : « tout ou rien » ou « lignes valides seulement » ; les lignes déjà présentes sont ignorées",
    body: executeInput,
  },
  { method: "GET", path: "/api/v1/imports/{id}/report", summary: "Rapport Excel : statut et anomalies de chaque ligne" },
  { method: "GET", path: "/api/v1/approvals", summary: "Validations en attente que l'utilisateur peut trancher (valideur ou suppléant)" },
  { method: "GET", path: "/api/v1/approvals/{id}", summary: "Demande de validation : étapes figées, décisions, droit de trancher" },
  {
    method: "POST",
    path: "/api/v1/approvals/{id}/decision",
    summary: "Approbation ou refus de l'étape en cours (commentaire obligatoire en cas de refus, HAB-04)",
    body: decisionInput,
  },
  { method: "GET", path: "/api/v1/approval-workflows", summary: "Circuits de validation et leurs étapes", permission: "settings.manage" },
  {
    method: "GET",
    path: "/api/v1/purchase-requests",
    summary: "Demandes d'achat du périmètre",
    permission: "purchase.read",
    query: purchaseRequestFilters,
  },
  {
    method: "POST",
    path: "/api/v1/purchase-requests",
    summary: "Création d'une demande d'achat, soumise au circuit (ACH-01, ACH-02)",
    permission: "purchase.create",
    body: purchaseRequestInput,
  },
  { method: "GET", path: "/api/v1/purchase-requests/{id}", summary: "Demande d'achat et historique de validation", permission: "purchase.read" },
  { method: "POST", path: "/api/v1/purchase-requests/{id}/cancel", summary: "Annulation motivée", permission: "purchase.create", body: cancelInput },
  {
    method: "GET",
    path: "/api/v1/notifications/preferences",
    summary: "Préférences de notification par courriel (alertes obligatoires toujours actives)",
  },
  {
    method: "PUT",
    path: "/api/v1/notifications/preferences",
    summary: "Événements reçus par courriel",
    body: preferencesInput,
  },
  { method: "GET", path: "/api/v1/kpis", summary: "Indicateurs de la période", permission: "kpi.read", query: indicatorFilters },
];

function schemaOf(schema: z.ZodType | undefined) {
  if (!schema) return undefined;
  return z.toJSONSchema(schema, { io: "input", unrepresentable: "any" });
}

export function apiCatalog() {
  return {
    name: "GMAO — API REST v1",
    authentication:
      "Cookie de session (application web) ou en-tête « Authorization: Bearer <jeton> » obtenu par POST /api/auth/sign-in/email. En-tête « x-client: mobile » pour tracer le canal mobile.",
    conventions: {
      response: "{ data } en cas de succès ; { error: { code, message, details } } sinon",
      errors: {
        400: "validation : details.fieldErrors par champ",
        401: "non authentifié",
        403: "droit absent sur ce périmètre",
        404: "introuvable ou hors périmètre",
        409: "conflit (doublon)",
        422: "règle métier : details = liste de toutes les conditions manquantes",
      },
      dates: "ISO 8601 ; une date-heure sans fuseau est interprétée dans le fuseau d'exploitation (Europe/Paris)",
      idempotency: "clientId (8 à 100 caractères) sur les créations hors connexion : un renvoi ne crée pas de doublon",
    },
    endpoints: ENDPOINTS.map((e) => ({
      method: e.method,
      path: e.path,
      summary: e.summary,
      permission: e.permission ?? null,
      query: schemaOf(e.query),
      body: schemaOf(e.body),
      contentType: e.body ? (e.multipart ? "multipart/form-data" : "application/json") : undefined,
    })),
  };
}
