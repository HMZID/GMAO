"use server";

import type { ActionState } from "@/lib/action-state";
import { act } from "@/server/actions";
import { createCategory, createModel } from "@/server/services/equipment";
import { createCompany, createJobsite, createSite, createWarehouse, createWorkshop } from "@/server/services/organization";
import { addAbsence, addRoleAssignment, createTechnician, createUser, removeRoleAssignment, setUserActive } from "@/server/services/users";
import { formToObject } from "@/server/validation";

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
