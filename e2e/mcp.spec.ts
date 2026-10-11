import { expect, type APIRequestContext, type Page, test } from "@playwright/test";
import { USERS, login, statusMessage } from "./helpers";

/** Couche MCP (préparation des évolutions IA) : protocole, outils, droits de la clé « Assistant IA ». */

async function createKey(page: Page, name: string, access: "READ" | "ASSISTANT") {
  await page.goto("/administration/connecteur");
  await page.getByText("Nouvelle clé").click();
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Créer la clé" }) });
  await form.getByLabel("Nom").fill(name);
  await form.getByRole("combobox", { name: "Accès" }).selectOption(access);
  await form.getByRole("button", { name: "Créer la clé" }).click();
  await expect(statusMessage(page).filter({ hasText: /Copiez-la maintenant/ })).toBeVisible();
  return ((await page.locator("[data-secret]").textContent()) ?? "").trim();
}

let nextId = 1;
async function rpc(client: APIRequestContext, method: string, params?: unknown) {
  const response = await client.post("/api/mcp", { data: { jsonrpc: "2.0", id: nextId++, method, params } });
  expect(response.status(), method).toBe(200);
  return response.json();
}

test("un assistant IA dialogue avec la GMAO par MCP : outils, recherche, signalement", async ({ page, playwright, baseURL }) => {
  await login(page, USERS.admin);
  const key = await createKey(page, `Assistant ${Date.now()}`, "ASSISTANT");
  const client = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { Authorization: `Bearer ${key}`, Accept: "application/json, text/event-stream" },
  });

  const init = await rpc(client, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } });
  expect(init.result.serverInfo.name).toBe("gmao");
  expect(init.result.capabilities.tools).toBeTruthy();
  const notified = await client.post("/api/mcp", { data: { jsonrpc: "2.0", method: "notifications/initialized" } });
  expect(notified.status()).toBe(202);

  const list = await rpc(client, "tools/list");
  const names = list.result.tools.map((t: { name: string }) => t.name);
  expect(names).toEqual(expect.arrayContaining(["search_equipment", "get_equipment", "list_work_orders", "create_work_request", "export_dataset"]));
  const search = list.result.tools.find((t: { name: string }) => t.name === "search_equipment");
  expect(search.inputSchema.properties.query).toBeTruthy();

  const found = await rpc(client, "tools/call", { name: "search_equipment", arguments: { query: "PE-007" } });
  expect(found.result.isError).toBe(false);
  const equipmentId = found.result.structuredContent.items[0].id;
  const sheet = await rpc(client, "tools/call", { name: "get_equipment", arguments: { code: "pe-007" } });
  expect(sheet.result.structuredContent.id).toBe(equipmentId);

  const created = await rpc(client, "tools/call", {
    name: "create_work_request",
    arguments: { equipmentId, symptom: `Fuite signalée par l'assistant ${Date.now()}`, isStopped: false },
  });
  expect(created.result.isError).toBe(false);
  expect(created.result.structuredContent.request.number).toMatch(/^DI-/);

  // Arguments invalides : erreur lisible, pas d'exception.
  const invalid = await rpc(client, "tools/call", { name: "create_work_request", arguments: { equipmentId: "pas-un-uuid", symptom: "" } });
  expect(invalid.result.isError).toBe(true);
  expect(invalid.result.content[0].text).toContain("Arguments invalides");
  await client.dispose();
});

test("MCP : clé de lecture sans signalement, sans clé refusé, origine étrangère refusée", async ({ page, playwright, baseURL }) => {
  await login(page, USERS.admin);
  const key = await createKey(page, `Lecture MCP ${Date.now()}`, "READ");
  const reader = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${key}` } });
  const equipment = await rpc(reader, "tools/call", { name: "search_equipment", arguments: { query: "PE-007" } });
  const refused = await rpc(reader, "tools/call", {
    name: "create_work_request",
    arguments: { equipmentId: equipment.result.structuredContent.items[0].id, symptom: "Essai" },
  });
  expect(refused.result.isError).toBe(true);

  const evil = await reader.post("/api/mcp", {
    headers: { Origin: "https://site-malveillant.example" },
    data: { jsonrpc: "2.0", id: 1, method: "ping" },
  });
  expect(evil.status()).toBe(403);
  await reader.dispose();

  const anonymous = await playwright.request.newContext({ baseURL });
  const denied = await anonymous.post("/api/mcp", { data: { jsonrpc: "2.0", id: 1, method: "tools/list" } });
  expect(denied.status()).toBe(401);
  expect(denied.headers()["www-authenticate"]).toContain("Bearer");
  await anonymous.dispose();
});
