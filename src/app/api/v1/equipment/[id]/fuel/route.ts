import { apiRoute, readJson } from "@/server/api/handler";
import { getEquipmentFuel, setEquipmentFuelSettings } from "@/server/services/fuel";

type Ctx = RouteContext<"/api/v1/equipment/[id]/fuel">;

/** Carburant d'un équipement : réglages, consommation, derniers pleins ; réglages modifiés par le responsable du parc. */
export const GET = apiRoute<Ctx>(async (ctx, _request, { params }) => getEquipmentFuel(ctx, (await params).id));
export const PUT = apiRoute<Ctx>(async (ctx, request, { params }) => setEquipmentFuelSettings(ctx, (await params).id, await readJson(request)));
