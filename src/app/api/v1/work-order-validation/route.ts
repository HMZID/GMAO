import { apiRoute, readJson } from "@/server/api/handler";
import { getWorkOrderValidationSetting, setWorkOrderValidation } from "@/server/services/approvals";

/** Validation des interventions (HAB-04) : lecture pour tous ceux qui lisent les interventions, réglage par la direction seule. */
export const GET = apiRoute(async (ctx) => getWorkOrderValidationSetting(ctx));
export const PUT = apiRoute(async (ctx, request) => setWorkOrderValidation(ctx, await readJson(request)));
