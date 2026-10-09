import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { bearer } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { account, session, user, verification } from "@/server/db/schema";
import { publicUrl, trustedOrigins } from "@/server/public-url";

const microsoftConfigured = !!process.env.MICROSOFT_CLIENT_ID && !!process.env.MICROSOFT_CLIENT_SECRET;

/**
 * Authentification (TEC-04, INT-03) :
 * - email + mot de passe pour le démarrage et les comptes prestataires ;
 * - SSO Microsoft Entra ID activé dès que les variables MICROSOFT_* sont renseignées ;
 * - jeton Bearer accepté pour l'application mobile et les intégrations (plugin `bearer`).
 * Aucune inscription libre : les comptes sont créés par l'administrateur (HAB-01).
 *
 * TODO(TEC-04) : double facteur obligatoire pour les administrateurs (plugin twoFactor).
 */
export const auth = betterAuth({
  appName: "GMAO",
  baseURL: publicUrl(),
  trustedOrigins: trustedOrigins(),
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 10,
  },
  socialProviders: microsoftConfigured
    ? {
        microsoft: {
          clientId: process.env.MICROSOFT_CLIENT_ID as string,
          clientSecret: process.env.MICROSOFT_CLIENT_SECRET as string,
          tenantId: process.env.MICROSOFT_TENANT_ID || "common",
          // Comptes pré-provisionnés uniquement : pas de création implicite par le SSO.
          disableSignUp: true,
        },
      }
    : {},
  user: {
    additionalFields: {
      tenantId: { type: "string", required: true, input: false },
      isActive: { type: "boolean", required: false, defaultValue: true, input: false },
    },
  },
  session: {
    // 12 h, prolongée à l'usage (TEC-04 : expiration de session) [AC]
    expiresIn: 60 * 60 * 12,
    updateAge: 60 * 60,
  },
  databaseHooks: {
    session: {
      create: {
        // HAB-08 : un compte désactivé ne peut plus ouvrir de session.
        before: async (newSession) => {
          const [row] = await db.select({ isActive: user.isActive }).from(user).where(eq(user.id, newSession.userId)).limit(1);
          if (!row?.isActive) return false;
        },
      },
    },
  },
  plugins: [bearer(), nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
