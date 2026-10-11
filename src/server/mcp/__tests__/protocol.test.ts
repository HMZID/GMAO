import { describe, expect, it } from "vitest";
import { handleMessage, RPC, type McpServer } from "../protocol";

class RuleError extends Error {}

const server: McpServer<{ user: string }> = {
  name: "gmao",
  version: "test",
  instructions: "Consignes",
  describeError: (error) => (error instanceof RuleError ? error.message : null),
  tools: [
    {
      name: "echo",
      title: "Écho",
      description: "Renvoie les arguments et l'appelant",
      inputSchema: { type: "object", properties: { text: { type: "string" } } },
      annotations: { readOnlyHint: true },
      run: async (ctx, args) => ({ user: ctx.user, text: args.text }),
    },
    { name: "list", title: "Liste", description: "Tableau", inputSchema: { type: "object" }, run: async () => [1, 2] },
    {
      name: "refuse",
      title: "Refus",
      description: "Erreur prévue",
      inputSchema: { type: "object" },
      run: async () => {
        throw new RuleError("Droit insuffisant.");
      },
    },
    {
      name: "crash",
      title: "Panne",
      description: "Erreur interne",
      inputSchema: { type: "object" },
      run: async () => {
        throw new Error("secret interne");
      },
    },
  ],
};
const ctx = { user: "u1" };
const call = (message: unknown) => handleMessage(server, ctx, message);

describe("MCP : cycle de vie", () => {
  it("initialize : version demandée si connue, sinon la plus récente", async () => {
    const known = await call({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } });
    expect(known?.result).toMatchObject({ protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "gmao" } });
    const unknown = await call({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "1999-01-01" } });
    expect(unknown?.result).toMatchObject({ protocolVersion: "2025-06-18" });
  });

  it("une notification n'a pas de réponse ; ping répond un objet vide", async () => {
    expect(await call({ jsonrpc: "2.0", method: "notifications/initialized" })).toBeNull();
    expect(await call({ jsonrpc: "2.0", id: "p", method: "ping" })).toEqual({ jsonrpc: "2.0", id: "p", result: {} });
  });

  it("requête invalide ou méthode inconnue : erreur JSON-RPC", async () => {
    expect((await call({ id: 3, method: "ping" }))?.error?.code).toBe(RPC.INVALID_REQUEST);
    expect((await call({ jsonrpc: "2.0", id: 4, method: "resources/list" }))?.error?.code).toBe(RPC.METHOD_NOT_FOUND);
  });
});

describe("MCP : outils", () => {
  it("liste les outils sans leur fonction d'exécution", async () => {
    const response = await call({ jsonrpc: "2.0", id: 5, method: "tools/list" });
    const tools = (response?.result as { tools: Record<string, unknown>[] }).tools;
    expect(tools.map((t) => t.name)).toEqual(["echo", "list", "refuse", "crash"]);
    expect(tools[0]).toEqual({
      name: "echo",
      title: "Écho",
      description: "Renvoie les arguments et l'appelant",
      inputSchema: { type: "object", properties: { text: { type: "string" } } },
      annotations: { readOnlyHint: true },
    });
  });

  it("exécute un outil avec le contexte de l'appelant : texte et contenu structuré", async () => {
    const response = await call({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "echo", arguments: { text: "bonjour" } } });
    expect(response?.result).toMatchObject({ isError: false, structuredContent: { user: "u1", text: "bonjour" } });
    const list = await call({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "list" } });
    expect(list?.result).toMatchObject({ structuredContent: { items: [1, 2] } });
  });

  it("erreur prévue : résultat en erreur lisible ; erreur interne : détail jamais divulgué", async () => {
    const refused = await call({ jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "refuse" } });
    expect(refused?.result).toEqual({ content: [{ type: "text", text: "Droit insuffisant." }], isError: true });
    const crashed = await call({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "crash" } });
    expect(crashed?.error).toEqual({ code: RPC.INTERNAL_ERROR, message: "Erreur interne." });
    expect(JSON.stringify(crashed)).not.toContain("secret");
  });

  it("outil inconnu : paramètres invalides", async () => {
    expect((await call({ jsonrpc: "2.0", id: 10, method: "tools/call", params: { name: "inconnu" } }))?.error?.code).toBe(RPC.INVALID_PARAMS);
  });
});
