import "server-only";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import type { AuthContext } from "@/server/authz/context";
import { getApiContext } from "@/server/auth/session";
import { AppError, ValidationError } from "@/server/errors";

/**
 * Enveloppe commune des routes API v1 (TEC-01, TEC-09) :
 * authentification (cookie ou Bearer), traduction des erreurs en codes HTTP, réponse { data }.
 * Les routes appellent les mêmes services que les écrans : mêmes règles, mêmes droits.
 */
export function apiRoute<RouteCtx = unknown>(
  handler: (ctx: AuthContext, request: Request, routeCtx: RouteCtx) => Promise<unknown>,
  options: { status?: number } = {},
) {
  return async (request: Request, routeCtx: RouteCtx): Promise<Response> => {
    // Routes authentifiées : toujours rendues à la requête, jamais prérendues au build.
    await connection();
    try {
      const ctx = await getApiContext(request);
      const result = await handler(ctx, request, routeCtx);
      if (result instanceof Response) return result;
      return Response.json({ data: result ?? null }, { status: options.status ?? 200 });
    } catch (error) {
      unstable_rethrow(error);
      return errorResponse(error);
    }
  };
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json({ error: { code: error.code, message: error.message, details: error.details ?? null } }, { status: error.status });
  }
  console.error("[api] erreur inattendue", error);
  return Response.json({ error: { code: "internal", message: "Erreur interne." } }, { status: 500 });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError({}, "Corps de requête JSON invalide.");
  }
}

export function queryOf(request: Request): Record<string, string> {
  return Object.fromEntries(new URL(request.url).searchParams.entries());
}
