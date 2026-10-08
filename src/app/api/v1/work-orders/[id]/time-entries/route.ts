import { apiRoute, readJson } from "@/server/api/handler";
import { recordTime } from "@/server/services/work-orders";

type Ctx = RouteContext<"/api/v1/work-orders/[id]/time-entries">;

/** { action: "start" | "stop" | "manual", minutes?, clientId? } (COR-09). */
export const POST = apiRoute<Ctx>(async (ctx, request, { params }) => recordTime(ctx, (await params).id, await readJson(request)), { status: 201 });
