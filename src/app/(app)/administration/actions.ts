"use server";

import type { ActionState } from "@/lib/action-state";
import { act } from "@/server/actions";
import { createApiKey, revokeApiKey } from "@/server/services/api-keys";
import { removeLogo, setLogo, updateBranding } from "@/server/services/branding";
import { createDemoTenant, updateTenantAccess } from "@/server/services/platform";
import { createCategory, createModel } from "@/server/services/equipment";
import { createCompany, createJobsite, createSite, createWarehouse, createWorkshop } from "@/server/services/organization";
import {
  addAbsence,
  addRoleAssignment,
  createTechnician,
  createUser,
  removeRoleAssignment,
  setUserActive,
  setUserPassword,
  updateUser,
} from "@/server/services/users";
import { formToObject } from "@/server/validation";

/* Identité de l'organisation : nom affiché sous « GMAO » et logo */

export async function updateBrandingAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => updateBranding(ctx, formToObject(formData, { keepEmpty: true })), "Nom affiché enregistré.");
}

export async function uploadLogoAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return act(async (ctx) => {
    const file = formData.get("logo");
    await setLogo(ctx, file instanceof File && file.size > 0 ? { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) } : null);
  }, "Logo enregistré.");
}

export async function removeLogoAction(_: ActionState): Promise<ActionState> {
  return act((ctx) => removeLogo(ctx), "Logo retiré.");
}

/* Plateforme : organisations clientes et démonstrations */

export async function createDemoTenantAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return act(async (ctx) => {
    const created = await createDemoTenant(ctx, formToObject(formData));
    return {
      status: "success",
      message: `Démonstration « ${created.name} » ouverte jusqu'au ${created.demoEndsAt.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })} : communiquer à ${created.adminEmail} son mot de passe initial.`,
    } satisfies ActionState;
  });
}

const TENANT_ACTION_MESSAGE: Record<string, string> = {
  EXTEND: "Démonstration prolongée.",
  ACTIVATE: "Organisation passée en abonnement : accès sans échéance.",
  SUSPEND: "Organisation suspendue : ses utilisateurs et ses clés d'API n'ont plus accès.",
  RESUME: "Accès rétabli.",
};

export async function updateTenantAccessAction(tenantId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const data = formToObject(formData);
  return act((ctx) => updateTenantAccess(ctx, tenantId, data), TENANT_ACTION_MESSAGE[String(data.action)] ?? "Enregistré.");
}

/* Connecteur de l'organisation : clés d'API (INT-01, INT-05) */

export async function createApiKeyAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return act(async (ctx) => {
    const created = await createApiKey(ctx, formToObject(formData, { keepEmpty: true }));
    return {
      status: "success",
      message: `Clé « ${created.name} » créée. Copiez-la maintenant : elle ne sera plus affichée.`,
      secret: created.key,
    } satisfies ActionState;
  });
}

export async function revokeApiKeyAction(id: string, _: ActionState): Promise<ActionState> {
  return act((ctx) => revokeApiKey(ctx, id), "Clé révoquée : elle est refusée dès maintenant.");
}

/* Organisation (CDC §1.3) */

export async function createCompanyAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => createCompany(ctx, formToObject(formData)), "Société créée.");
}

export async function createSiteAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => createSite(ctx, formToObject(formData)), "Site créé.");
}

export async function createWorkshopAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => createWorkshop(ctx, formToObject(formData)), "Atelier créé.");
}

export async function createWarehouseAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => createWarehouse(ctx, formToObject(formData)), "Magasin créé.");
}

export async function createJobsiteAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => createJobsite(ctx, formToObject(formData)), "Chantier créé.");
}

/* Utilisateurs et habilitations (CDC §2) */

/** Le périmètre est choisi dans une seule liste : « TENANT », « COMPANY:<id> » ou « SITE:<id> ». */
function withScope(data: Record<string, unknown>) {
  const [scopeType, scopeId] = String(data.scope ?? "").split(":");
  const { scope: _scope, ...rest } = data;
  return { ...rest, scopeType: scopeType || undefined, scopeId: scopeId || undefined };
}

export async function createUserAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => createUser(ctx, withScope(formToObject(formData))), "Compte créé : communiquer le mot de passe initial à l'utilisateur.");
}

export async function addRoleAction(userId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => addRoleAssignment(ctx, userId, withScope(formToObject(formData))), "Rôle ajouté.");
}

export async function removeRoleAction(assignmentId: string, _: ActionState): Promise<ActionState> {
  return act((ctx) => removeRoleAssignment(ctx, assignmentId), "Rôle retiré.");
}

export async function updateUserAction(userId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => updateUser(ctx, userId, formToObject(formData, { keepEmpty: true })), "Compte modifié.");
}

export async function setUserPasswordAction(userId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act(
    (ctx) => setUserPassword(ctx, userId, formToObject(formData)),
    "Mot de passe remplacé : le communiquer à l'utilisateur ; ses sessions ouvertes sont fermées.",
  );
}

export async function setUserActiveAction(userId: string, active: boolean, _: ActionState): Promise<ActionState> {
  return act((ctx) => setUserActive(ctx, userId, active), active ? "Compte réactivé." : "Compte désactivé : sessions fermées.");
}

/* Techniciens et absences (CDC §6) */

export async function createTechnicianAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => createTechnician(ctx, formToObject(formData)), "Technicien créé.");
}

export async function addAbsenceAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => addAbsence(ctx, formToObject(formData)), "Absence enregistrée.");
}

/* Référentiel équipements (EQP-03) */

export async function createCategoryAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => createCategory(ctx, formToObject(formData)), "Catégorie créée.");
}

export async function createModelAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => createModel(ctx, formToObject(formData)), "Modèle créé.");
}
