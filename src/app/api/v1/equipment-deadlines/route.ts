import { apiRoute, queryOf, readJson } from "@/server/api/handler";
import { createDeadline, listDeadlines } from "@/server/services/fleet-deadlines";

/** Échéances administratives du parc : assurance, visite technique, vignette. */
export const GET = apiRoute(async (ctx, request) => listDeadlines(ctx, queryOf(request)));

export const POST = apiRoute(async (ctx, request) => createDeadline(ctx, await readJson(request)), { status: 201 });
