import { apiRoute } from "@/server/api/handler";
import { getDashboard } from "@/server/services/kpi";

export const GET = apiRoute(async (ctx) => getDashboard(ctx));
