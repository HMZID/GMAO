/**
 * Couche MCP (Model Context Protocol) : traitement des messages JSON-RPC 2.0 du transport HTTP
 * « Streamable HTTP » en mode sans état (une requête POST → une réponse JSON). Les outils sont décrits
 * par leur schéma JSON d'entrée et exécutés avec le contexte de l'appelant : mêmes services, mêmes droits.
 * Module pur, testé dans `__tests__/protocol.test.ts`.
 */

/** Versions du protocole acceptées ; la première est proposée par défaut. */
export const MCP_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;

export type JsonRpcId = string | number | null;

export type McpTool<C> = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };
  run: (ctx: C, args: Record<string, unknown>) => Promise<unknown>;
};

export type McpServer<C> = {
  name: string;
  version: string;
  instructions: string;
  tools: McpTool<C>[];
  /** Message lisible d'une erreur prévue (règle, droit, validation) ; null pour une erreur interne. */
  describeError: (error: unknown) => string | null;
};

type Response = { jsonrpc: "2.0"; id: JsonRpcId; result?: unknown; error?: { code: number; message: string; data?: unknown } };

export const RPC = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

const fail = (id: JsonRpcId, code: number, message: string): Response => ({ jsonrpc: "2.0", id, error: { code, message } });

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Traite un message. Renvoie la réponse, ou null pour une notification (message sans identifiant),
 * qui n'appelle pas de réponse.
 */
export async function handleMessage<C>(server: McpServer<C>, ctx: C, message: unknown): Promise<Response | null> {
  if (!isObject(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    const id = isObject(message) && (typeof message.id === "string" || typeof message.id === "number") ? message.id : null;
    return fail(id, RPC.INVALID_REQUEST, "Requête JSON-RPC 2.0 invalide.");
  }
  const isNotification = !("id" in message) || message.id === undefined;
  const id = (message.id ?? null) as JsonRpcId;
  const params = isObject(message.params) ? message.params : {};
  if (isNotification) return null;

  switch (message.method) {
    case "initialize": {
      const requested = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
      const protocolVersion = (MCP_PROTOCOL_VERSIONS as readonly string[]).includes(requested) ? requested : MCP_PROTOCOL_VERSIONS[0];
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: server.name, title: "GMAO", version: server.version },
          instructions: server.instructions,
        },
      };
    }
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: server.tools.map(({ name, title, description, inputSchema, annotations }) => ({
            name,
            title,
            description,
            inputSchema,
            annotations,
          })),
        },
      };
    case "tools/call": {
      const tool = server.tools.find((t) => t.name === params.name);
      if (!tool) return fail(id, RPC.INVALID_PARAMS, `Outil inconnu : ${String(params.name)}.`);
      const args = isObject(params.arguments) ? params.arguments : {};
      try {
        const data = await tool.run(ctx, args);
        return { jsonrpc: "2.0", id, result: toolResult(data) };
      } catch (error) {
        const description = server.describeError(error);
        if (description === null) return fail(id, RPC.INTERNAL_ERROR, "Erreur interne.");
        // Erreur prévue : renvoyée comme résultat d'outil, pour que l'assistant puisse corriger sa demande.
        return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: description }], isError: true } };
      }
    }
    default:
      return fail(id, RPC.METHOD_NOT_FOUND, `Méthode non prise en charge : ${message.method}.`);
  }
}

/** Résultat d'outil : texte JSON (tous clients) et contenu structuré (objet). */
export function toolResult(data: unknown) {
  const structured = isObject(data) ? data : { items: data ?? null };
  return { content: [{ type: "text", text: JSON.stringify(data ?? null, null, 2) }], structuredContent: structured, isError: false };
}
