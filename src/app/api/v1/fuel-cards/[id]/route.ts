import { apiRoute, readJson } from "@/server/api/handler";
import { updateFuelCard } from "@/server/services/fuel";

type Ctx = RouteContext<"/api/v1/fuel-cards/[id]">;

/** Affectation, plafond, désactivation d'une carte carburant. */
export const PATCH = apiRoute<Ctx>(async (ctx, request, { params }) => updateFuelCard(ctx, (await params).id, await readJson(request)));
