import { apiRoute, readJson } from "@/server/api/handler";
import { reviewReading } from "@/server/services/meters";

type Ctx = RouteContext<"/api/v1/meter-readings/[id]/review">;

/** Valide ou rejette un relevé « à vérifier » (DON-02). Corps : { decision: "VALID" | "REJECTED", comment? }. */
export const POST = apiRoute<Ctx>(async (ctx, request, { params }) => reviewReading(ctx, (await params).id, await readJson(request)));
