import { apiRoute, readJson } from "@/server/api/handler";
import { reviewFuelEntry } from "@/server/services/fuel";

type Ctx = RouteContext<"/api/v1/fuel-entries/[id]/review">;

/** { decision: "JUSTIFIED" | "CANCELLED", comment } : examen d'un plein par le responsable du parc. */
export const POST = apiRoute<Ctx>(async (ctx, request, { params }) => reviewFuelEntry(ctx, (await params).id, await readJson(request)));
