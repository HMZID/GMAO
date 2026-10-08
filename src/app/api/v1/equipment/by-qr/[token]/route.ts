import { apiRoute } from "@/server/api/handler";
import { findEquipmentByQrToken } from "@/server/services/equipment";

type Ctx = RouteContext<"/api/v1/equipment/by-qr/[token]">;

/** Résolution d'un QR code scanné (EQP-09, MOB-02). */
export const GET = apiRoute<Ctx>(async (ctx, _request, { params }) => findEquipmentByQrToken(ctx, (await params).token));
