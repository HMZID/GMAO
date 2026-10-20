"use server";

import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { auth } from "@/server/auth/auth";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";
import { LOCALE_COOKIE, isLocale } from "./config";

/**
 * Mémorise la langue choisie un an (le navigateur recharge ensuite la page). Connecté, l'utilisateur la garde
 * aussi sur son compte : ses courriels et ses alertes partent dans cette langue.
 */
export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: false });
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) await db.update(user).set({ locale }).where(eq(user.id, session.user.id));
}
