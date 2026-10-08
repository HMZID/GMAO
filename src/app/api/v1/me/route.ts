import { apiRoute } from "@/server/api/handler";
import { PERMISSIONS } from "@/server/authz/permissions";

/** Profil de l'utilisateur connecté : rôles et droits effectifs (pour le mobile et les intégrations). */
export const GET = apiRoute(async (ctx) => ({
  userId: ctx.userId,
  name: ctx.name,
  email: ctx.email,
  technicianId: ctx.technicianId,
  roles: ctx.roles,
  permissions: PERMISSIONS.filter((p) => ctx.can(p)).map((p) => ({ permission: p, scope: ctx.scope(p) })),
}));
