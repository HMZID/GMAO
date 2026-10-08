import { apiRoute, readJson } from "@/server/api/handler";
import { listReadings, recordReading } from "@/server/services/meters";

type Ctx = RouteContext<"/api/v1/meters/[id]/readings">;

export const GET = apiRoute<Ctx>(async (ctx, _request, { params }) => listReadings(ctx, (await params).id));
/** Relevé de compteur ; fournir `clientId` pour une synchronisation idempotente (MOB-08). */
export const POST = apiRoute<Ctx>(async (ctx, request, { params }) => recordReading(ctx, (await params).id, await readJson(request)), {
  status: 201,
});
