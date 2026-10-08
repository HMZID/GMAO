import { apiRoute } from "@/server/api/handler";
import { generatePreventiveWorkOrders, recomputeAllDueItems } from "@/server/services/preventive";

/** Recalcule les échéances puis génère les OT préventifs (PRV-08) — à appeler chaque nuit par un ordonnanceur. */
export const POST = apiRoute(async (ctx) => {
  const recomputed = await recomputeAllDueItems(ctx);
  const generated = await generatePreventiveWorkOrders(ctx);
  return { recomputedEquipment: recomputed, ...generated };
});
