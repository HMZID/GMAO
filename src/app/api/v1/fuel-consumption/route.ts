import { apiRoute, queryOf } from "@/server/api/handler";
import { fuelConsumption } from "@/server/services/fuel";

/** Consommation par équipement (L/h ou L/100 km, plein à plein), référence, écart et pleins à examiner. */
export const GET = apiRoute(async (ctx, request) => fuelConsumption(ctx, queryOf(request)));
