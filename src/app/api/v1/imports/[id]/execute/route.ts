import { apiRoute, readJson } from "@/server/api/handler";
import { executeImport } from "@/server/services/imports";

type Ctx = RouteContext<"/api/v1/imports/[id]/execute">;

/** { mode: "ALL_OR_NOTHING" | "VALID_ONLY" } : création des lignes prêtes par les services de saisie. */
export const POST = apiRoute<Ctx>(async (ctx, request, { params }) => executeImport(ctx, (await params).id, await readJson(request)));
