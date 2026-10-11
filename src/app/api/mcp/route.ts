import { connection } from "next/server";
import { getApiContext } from "@/server/auth/session";
import { UnauthorizedError } from "@/server/errors";
import { handleMessage, RPC } from "@/server/mcp/protocol";
import { MCP_SERVER } from "@/server/mcp/tools";
import { trustedOrigins } from "@/server/public-url";

/**
 * Couche MCP de la GMAO (transport « Streamable HTTP », sans état) : un assistant IA (client MCP)
 * appelle les outils avec une clé d'API « Assistant IA » (Authorization: Bearer gmk_…) ou une session.
 * Chaque appel passe par les mêmes services, droits et périmètres que l'application.
 */
export async function POST(request: Request) {
  await connection();
  // Protection contre le « DNS rebinding » : une page web d'un autre site ne peut pas appeler le serveur.
  const origin = request.headers.get("origin");
  if (origin && !trustedOrigins().includes(origin)) return Response.json({ error: "Origine non autorisée." }, { status: 403 });

  let ctx;
  try {
    ctx = await getApiContext(request);
  } catch (error) {
    if (error instanceof UnauthorizedError)
      return Response.json(
        { jsonrpc: "2.0", id: null, error: { code: -32001, message: error.message } },
        { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="gmao-mcp"' } },
      );
    throw error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: RPC.PARSE_ERROR, message: "JSON invalide." } }, { status: 400 });
  }

  const messages = Array.isArray(body) ? body : [body];
  const responses = [];
  for (const message of messages) {
    const response = await handleMessage(MCP_SERVER, ctx, message);
    if (response) responses.push(response);
  }
  // Notifications seules : accusé de réception sans corps.
  if (responses.length === 0) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(body) ? responses : responses[0], { headers: { "Cache-Control": "no-store" } });
}

/** Pas de flux serveur → client (SSE) : le serveur ne pousse aucune notification. */
export function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

export function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
