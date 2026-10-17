import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { bearer, twoFactor as twoFactorPlugin } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { account, session, tenants, twoFactor, user, verification } from "@/server/db/schema";
import { clientIp } from "@/server/domain/login-security";
import { tenantAccess } from "@/server/domain/tenants";
import { publicUrl, trustedOrigins } from "@/server/public-url";
import { loginBlocked, recordLoginAttempt } from "./login-throttle";

const microsoftConfigured = !!process.env.MICROSOFT_CLIENT_ID && !!process.env.MICROSOFT_CLIENT_SECRET;

/**
 * Authentification (TEC-04, INT-03) :
 * - email + mot de passe pour le démarrage et les comptes prestataires ;
 * - SSO Microsoft Entra ID activé dès que les variables MICROSOFT_* sont renseignées ;
 * - jeton Bearer accepté pour l'application mobile et les intégrations (plugin `bearer`).
 * Aucune inscription libre : les comptes sont créés par l'administrateur (HAB-01).
 *
 * - double authentification TOTP (plugin twoFactor), obligatoire pour l'administrateur de la plateforme
 *   (`src/server/domain/two-factor.ts`), avec codes de secours.
 */
export const auth = betterAuth({
  appName: "GMAO",
  baseURL: publicUrl(),
  trustedOrigins: trustedOrigins(),
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification, twoFactor },
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
        // HAB-08 : un compte désactivé ne peut plus ouvrir de session ; ni un compte d'une organisation
        // suspendue ou dont la démonstration est échue.
        before: async (newSession) => {
          const [row] = await db
            .select({ isActive: user.isActive, status: tenants.status, demoEndsAt: tenants.demoEndsAt })
            .from(user)
            .innerJoin(tenants, eq(tenants.id, user.tenantId))
            .where(eq(user.id, newSession.userId))
            .limit(1);
          if (!row?.isActive) return false;
          if (!tenantAccess(row, new Date()).allowed) return false;
        },
      },
    },
  },
  // Limitation des tentatives de connexion (TEC-04) : pour la page de connexion (appel direct au serveur),
  // l'adresse HTTP et l'application mobile, qui passent toutes par ces hooks. Le limiteur intégré de
  // Better Auth ne voit pas les appels directs et garde ses compteurs en mémoire (une instance Vercel chacune).
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const email = String((ctx.body as { email?: unknown } | undefined)?.email ?? "");
      if (await loginBlocked(email, clientIp(ctx.headers))) {
        throw new APIError("TOO_MANY_REQUESTS", { message: "Trop de tentatives de connexion : réessayer dans 15 minutes." });
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const email = String((ctx.body as { email?: unknown } | undefined)?.email ?? "");
      if (!email) return;
      await recordLoginAttempt(email, clientIp(ctx.headers), !(ctx.context.returned instanceof APIError));
    }),
  },
  plugins: [
    bearer(),
    // Secret et codes de secours chiffrés par Better Auth ; essais limités et verrouillage après des codes faux.
    twoFactorPlugin({ issuer: "GMAO", backupCodeOptions: { amount: 10 } }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
