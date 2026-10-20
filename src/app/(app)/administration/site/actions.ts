"use server";

import { formatDate } from "@/lib/format";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { ActionState } from "@/lib/action-state";
import { act, runAction } from "@/server/actions";
import { getAuthContext } from "@/server/auth/session";
import { approveDemoRequest, deleteDemoRequest, rejectDemoRequest, resendDemoAccess } from "@/server/services/demo-requests";
import { processEmailQueue } from "@/server/services/email";
import {
  createSiteItem,
  createSitePage,
  createSitePlan,
  deleteSiteItem,
  deleteSitePage,
  deleteSitePlan,
  moveSiteItem,
  moveSitePlan,
  updateSiteItem,
  updateSitePage,
  updateSitePlan,
  updateSiteSettings,
} from "@/server/services/site";
import { formToObject } from "@/server/validation";
import { tpl } from "@/i18n/translate";

/** Courriels d'accès envoyés tout de suite, sans attendre le passage du processus d'envoi. */
function sendQueuedEmailsSoon() {
  after(() => processEmailQueue({ limit: 20 }).catch((e) => console.error("[courriel]", e)));
}

/* Demandes de démonstration */

/**
 * Décision sur une demande (accepter, refuser, renvoyer les accès) : une seule action pour le panneau de la
 * fiche, dont le message reste affiché quand le formulaire utilisé disparaît (demande traitée). Le mot de
 * passe provisoire n'est montré qu'une fois, pour le dicter si le courriel n'arrive pas.
 */
export async function demoRequestDecisionAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { intent, ...data } = formToObject(formData);
  return act(async (ctx) => {
    switch (intent) {
      case "approve": {
        const result = await approveDemoRequest(ctx, id, data);
        sendQueuedEmailsSoon();
        return {
          status: "success",
          message: tpl`Démonstration ouverte jusqu'au ${formatDate(result.endsAt)} : lien de connexion, identifiant (${result.email}) et mot de passe provisoire envoyés par courriel. Mot de passe provisoire, à dicter si le courriel n'arrive pas :`,
          secret: result.password,
        } satisfies ActionState;
      }
      case "resend": {
        const result = await resendDemoAccess(ctx, id);
        sendQueuedEmailsSoon();
        return {
          status: "success",
          message: tpl`Nouveaux accès envoyés à ${result.email} ; l'ancien mot de passe provisoire ne fonctionne plus. Nouveau mot de passe provisoire :`,
          secret: result.password,
        } satisfies ActionState;
      }
      case "reject":
        await rejectDemoRequest(ctx, id, data);
        sendQueuedEmailsSoon();
        return { status: "success", message: "Demande refusée." } satisfies ActionState;
      default:
        return { status: "error", message: "Action inconnue." } satisfies ActionState;
    }
  });
}
export async function deleteDemoRequestAction(id: string, _: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await deleteDemoRequest(await getAuthContext(), id);
    redirect("/administration/site/demandes");
  });
}

/* Réglages */

export async function updateSiteSettingsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => updateSiteSettings(ctx, formToObject(formData, { keepEmpty: true })), "Enregistré : visible tout de suite sur le site.");
}

/* Blocs */

export async function createSiteItemAction(kind: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => createSiteItem(ctx, kind, formToObject(formData)), "Ajouté.");
}

export async function updateSiteItemAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => updateSiteItem(ctx, id, formToObject(formData, { keepEmpty: true })), "Modifié.");
}

export async function deleteSiteItemAction(id: string, _: ActionState): Promise<ActionState> {
  return act((ctx) => deleteSiteItem(ctx, id), "Supprimé.");
}

export async function moveSiteItemAction(id: string, direction: "up" | "down", _: ActionState): Promise<ActionState> {
  return act((ctx) => moveSiteItem(ctx, id, { direction }), "Ordre modifié.");
}

/* Offres */

export async function createSitePlanAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => createSitePlan(ctx, formToObject(formData)), "Offre ajoutée.");
}

export async function updateSitePlanAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => updateSitePlan(ctx, id, formToObject(formData, { keepEmpty: true })), "Offre modifiée.");
}

export async function deleteSitePlanAction(id: string, _: ActionState): Promise<ActionState> {
  return act((ctx) => deleteSitePlan(ctx, id), "Offre supprimée.");
}

export async function moveSitePlanAction(id: string, direction: "up" | "down", _: ActionState): Promise<ActionState> {
  return act((ctx) => moveSitePlan(ctx, id, { direction }), "Ordre modifié.");
}

/* Pages libres */

export async function createSitePageAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const created = await createSitePage(await getAuthContext(), formToObject(formData));
    redirect(`/administration/site/pages/${created.id}`);
  });
}

export async function updateSitePageAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => updateSitePage(ctx, id, formToObject(formData, { keepEmpty: true })), "Page enregistrée.");
}

export async function deleteSitePageAction(id: string, _: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await deleteSitePage(await getAuthContext(), id);
    redirect("/administration/site/pages");
  });
}
