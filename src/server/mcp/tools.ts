import { plainText } from "@/i18n/translate";
import "server-only";
import { z } from "zod";
import type { AuthContext } from "@/server/authz/context";
import { EXPORT_DATASETS, MAX_PAGE_SIZE } from "@/server/domain/exports";
import { AppError, ValidationError } from "@/server/errors";
import { getBranding } from "@/server/services/branding";
import { getEquipment, listEquipment } from "@/server/services/equipment";
import { exportPage } from "@/server/services/exports";
import { getIndicator, listIndicators } from "@/server/services/indicators";
import { getIndicators } from "@/server/services/kpi";
import { listDueItems } from "@/server/services/preventive";
import { getWorkOrder, listWorkOrders } from "@/server/services/work-orders";
import { createWorkRequest, listWorkRequests } from "@/server/services/work-requests";
import type { McpServer, McpTool } from "./protocol";

/* ------------------------------------------------------------------ */
/* Outils MCP de la GMAO : mêmes services, mêmes droits que l'API      */
/* ------------------------------------------------------------------ */

/** Outil décrit par un schéma Zod : le schéma JSON publié est généré depuis la validation. */
function tool<S extends z.ZodObject>(
  definition: Omit<McpTool<AuthContext>, "inputSchema" | "run"> & { input: S; run: (ctx: AuthContext, args: z.output<S>) => Promise<unknown> },
): McpTool<AuthContext> {
  const { input, run, ...rest } = definition;
  return {
    ...rest,
    inputSchema: z.toJSONSchema(input, { io: "input", unrepresentable: "any" }) as Record<string, unknown>,
    run: async (ctx, args) => {
      const parsed = input.safeParse(args);
      if (!parsed.success) throw new ValidationError(z.flattenError(parsed.error).fieldErrors as Record<string, string[]>, "Arguments invalides.");
      return run(ctx, parsed.data);
    },
  };
}

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;
const limit = (max = 50) => z.number().int().min(1).max(max).default(20).describe("Nombre maximal de résultats");

export const MCP_TOOLS: McpTool<AuthContext>[] = [
  tool({
    name: "get_organization",
    title: "Organisation",
    description: "Nom de l'organisation (client) et de l'utilisateur ou du connecteur qui interroge la GMAO.",
    annotations: READ_ONLY,
    input: z.object({}),
    run: async (ctx) => {
      const branding = await getBranding(ctx);
      return { organization: branding.label, caller: ctx.name, channel: ctx.channel };
    },
  }),
  tool({
    name: "search_equipment",
    title: "Rechercher des équipements",
    description:
      "Recherche d'engins, véhicules et équipements par code parc, désignation, marque ou numéro de série, avec leur statut (disponible, en service, en maintenance, immobilisé…).",
    annotations: READ_ONLY,
    input: z.object({
      query: z.string().max(100).optional().describe("Texte recherché : code parc (ex. PE-007), désignation, marque…"),
      status: z.enum(["AVAILABLE", "IN_SERVICE", "IN_MAINTENANCE", "IMMOBILIZED", "RETIRED"]).optional().describe("Filtre sur le statut"),
      limit: limit(),
    }),
    run: (ctx, a) => listEquipment(ctx, { q: a.query, status: a.status, pageSize: a.limit }),
  }),
  tool({
    name: "get_equipment",
    title: "Fiche d'un équipement",
    description: "Fiche complète d'un équipement (identification, compteurs, affectation, échéances, historique) par identifiant ou code parc.",
    annotations: READ_ONLY,
    input: z.object({
      id: z.uuid().optional().describe("Identifiant (UUID)"),
      code: z.string().max(40).optional().describe("Code parc, ex. PE-007"),
    }),
    run: async (ctx, a) => {
      let id = a.id;
      if (!id && a.code) {
        const found = await listEquipment(ctx, { q: a.code, pageSize: 10, includeRetired: true });
        id = found.items.find((e: { code: string }) => e.code.toUpperCase() === a.code!.toUpperCase())?.id;
      }
      if (!id)
        throw new ValidationError({ code: ["Équipement introuvable : donner l'identifiant ou un code parc exact."] }, "Équipement introuvable.");
      return getEquipment(ctx, id);
    },
  }),
  tool({
    name: "list_work_orders",
    title: "Interventions à réaliser",
    description: "Interventions à réaliser (préventives, correctives, réglementaires) filtrées par statut, type, priorité ou équipement.",
    annotations: READ_ONLY,
    input: z.object({
      status: z
        .enum(["OPEN", "ALL", "CREATED", "PLANNED", "ON_HOLD", "IN_PROGRESS", "WORK_DONE", "TECH_CLOSED", "CLOSED", "CANCELLED"])
        .default("OPEN")
        .describe("OPEN = toutes les interventions non clôturées"),
      type: z.enum(["PREVENTIVE", "CORRECTIVE", "REGULATORY", "IMPROVEMENT", "ACCIDENT"]).optional(),
      priority: z.enum(["P1", "P2", "P3", "P4"]).optional().describe("P1 urgente … P4 planifiable"),
      equipmentId: z.uuid().optional(),
      query: z.string().max(100).optional().describe("Numéro ou intitulé"),
      limit: limit(),
    }),
    run: (ctx, a) =>
      listWorkOrders(ctx, { status: a.status, type: a.type, priority: a.priority, equipmentId: a.equipmentId, q: a.query, pageSize: a.limit }),
  }),
  tool({
    name: "get_work_order",
    title: "Détail d'une intervention",
    description: "Détail d'une intervention : équipement, planification, intervenants, temps, pièces, points de contrôle, compte rendu et coûts.",
    annotations: READ_ONLY,
    input: z.object({ id: z.uuid().describe("Identifiant de l'intervention") }),
    run: async (ctx, a) => {
      // Les éléments propres à l'écran (transitions possibles, état interne) ne sont pas utiles à un assistant.
      const { snapshot: _snapshot, transitions: _transitions, canExecute: _e, canManage: _m, ...wo } = await getWorkOrder(ctx, a.id);
      return wo;
    },
  }),
  tool({
    name: "list_work_requests",
    title: "Demandes d'intervention",
    description: "Demandes d'intervention (signalements de pannes) avec leur statut et leur priorité.",
    annotations: READ_ONLY,
    input: z.object({
      status: z.enum(["NEW", "QUALIFIED", "CONVERTED", "REJECTED", "MERGED", "OPEN"]).default("OPEN"),
      equipmentId: z.uuid().optional(),
      limit: limit(),
    }),
    run: (ctx, a) => listWorkRequests(ctx, { status: a.status, equipmentId: a.equipmentId, pageSize: a.limit }),
  }),
  tool({
    name: "create_work_request",
    title: "Créer une demande d'intervention",
    description:
      "Crée une demande d'intervention (signalement de panne ou d'anomalie) sur un équipement. Elle sera qualifiée par le chef d'atelier. Demander confirmation à l'utilisateur avant de l'appeler.",
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    input: z.object({
      equipmentId: z.uuid().describe("Identifiant de l'équipement (voir search_equipment)"),
      symptom: z.string().min(1).max(200).describe("Symptôme constaté, en une phrase"),
      description: z.string().max(2000).optional(),
      isStopped: z.boolean().default(false).describe("L'engin est-il à l'arrêt ?"),
      isSafetyRisk: z.boolean().default(false).describe("Y a-t-il un risque pour la sécurité ?"),
    }),
    run: (ctx, a) => createWorkRequest(ctx, a),
  }),
  tool({
    name: "list_due_items",
    title: "Échéances de maintenance",
    description: "Échéances de maintenance préventive et réglementaire (pré-alerte, échues, en retard).",
    annotations: READ_ONLY,
    input: z.object({
      status: z.enum(["UPCOMING", "PRE_ALERT", "DUE", "OVERDUE", "OPEN"]).default("OPEN").describe("OPEN = pré-alerte, échues et en retard"),
      equipmentId: z.uuid().optional(),
    }),
    run: (ctx, a) => listDueItems(ctx, a),
  }),
  tool({
    name: "get_maintenance_kpis",
    title: "Indicateurs de maintenance",
    description: "Disponibilité, MTBF, MTTR, MDT, respect du préventif et coûts de maintenance sur une période (par défaut les 30 derniers jours).",
    annotations: READ_ONLY,
    input: z.object({
      from: z.string().optional().describe("Début de période, AAAA-MM-JJ"),
      to: z.string().optional().describe("Fin de période, AAAA-MM-JJ"),
    }),
    run: (ctx, a) => getIndicators(ctx, a),
  }),
  tool({
    name: "list_custom_indicators",
    title: "Indicateurs personnalisés",
    description: "Indicateurs composés par l'organisation, avec leur valeur calculée.",
    annotations: READ_ONLY,
    input: z.object({ id: z.uuid().optional().describe("Un seul indicateur") }),
    run: (ctx, a) => (a.id ? getIndicator(ctx, a.id) : listIndicators(ctx)),
  }),
  tool({
    name: "export_dataset",
    title: "Extraire des données",
    description:
      "Lignes d'un jeu de données (équipements, interventions, demandes, relevés, fournisseurs, ouvriers, articles, stocks, mouvements), paginées, éventuellement depuis une date de modification.",
    annotations: READ_ONLY,
    input: z.object({
      dataset: z.enum(EXPORT_DATASETS),
      updatedSince: z.string().optional().describe("Date ISO 8601 : lignes créées ou modifiées depuis"),
      companyId: z.uuid().optional().describe("Une seule société de l'organisation"),
      limit: z.number().int().min(1).max(Math.min(MAX_PAGE_SIZE, 500)).default(100),
      offset: z.number().int().min(0).default(0),
    }),
    run: (ctx, a) => exportPage(ctx, a.dataset, { updatedSince: a.updatedSince, companyId: a.companyId, limit: a.limit, offset: a.offset }),
  }),
];

/** Message d'une erreur prévue (droit, règle, validation, introuvable) ; null pour une erreur interne. */
function describeError(error: unknown): string | null {
  const text = describeErrorText(error);
  return text === null ? null : plainText(text);
}

function describeErrorText(error: unknown): string | null {
  if (error instanceof ValidationError) {
    const fields = Object.entries(error.fieldErrors ?? {}).flatMap(([field, messages]) => (messages ?? []).map((m) => `${field} : ${m}`));
    return [error.message, ...fields].join("\n");
  }
  if (error instanceof AppError) {
    const details = (error.details as { errors?: string[] } | undefined)?.errors;
    return details?.length ? [error.message, ...details].join("\n") : error.message;
  }
  return null;
}

export const MCP_SERVER: McpServer<AuthContext> = {
  name: "gmao",
  version: "1.0.0",
  instructions:
    "GMAO de maintenance des engins, véhicules et équipements. Les données sont celles de l'organisation de l'appelant, dans son périmètre. " +
    "Les codes de statut sont en anglais (OPEN, CLOSED, IMMOBILIZED…) ; présenter les résultats en français. " +
    "Avant create_work_request, rechercher l'équipement (search_equipment) et faire confirmer le signalement par l'utilisateur.",
  tools: MCP_TOOLS,
  describeError,
};
