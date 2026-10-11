import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { AuthContext } from "@/server/authz/context";
import { db } from "@/server/db";
import { tenants } from "@/server/db/schema";
import { brandLabel, checkLogo, MAX_DISPLAY_NAME } from "@/server/domain/branding";
import { SIGNATURE_LENGTH } from "@/server/domain/documents";
import { BusinessRuleError, NotFoundError } from "@/server/errors";
import { clearable } from "@/server/validation";
import { assertCan, audit, parseInput } from "./_shared";

/* ------------------------------------------------------------------ */
/* Identité de l'organisation : nom affiché et logo                    */
/* ------------------------------------------------------------------ */

export type Branding = {
  /** Nom du groupe (organisation). */
  name: string;
  /** Nom choisi pour l'affichage, ou null. */
  displayName: string | null;
  /** Nom à afficher : le nom choisi, sinon le nom du groupe. */
  label: string;
  /** Version du logo (horodatage) pour l'adresse de l'image, ou null sans logo. */
  logoVersion: number | null;
};

/** Identité de l'organisation de l'utilisateur : tout utilisateur connecté la lit (en-tête, états imprimés). */
export async function getBranding(ctx: AuthContext): Promise<Branding> {
  const [row] = await db
    .select({ name: tenants.name, displayName: tenants.displayName, logoUpdatedAt: tenants.logoUpdatedAt, hasLogo: tenants.logoContentType })
    .from(tenants)
    .where(eq(tenants.id, ctx.tenantId));
  if (!row) throw new NotFoundError("Organisation");
  return {
    name: row.name,
    displayName: row.displayName,
    label: brandLabel(row),
    logoVersion: row.hasLogo && row.logoUpdatedAt ? row.logoUpdatedAt.getTime() : null,
  };
}

/** Adresse du logo (null sans logo) : la version change à chaque nouveau logo, le navigateur peut donc le garder en cache. */
export function logoUrl(branding: Pick<Branding, "logoVersion">) {
  return branding.logoVersion ? `/api/v1/organization/logo?v=${branding.logoVersion}` : null;
}

export const brandingInput = z.object({ displayName: clearable(z.string().trim().max(MAX_DISPLAY_NAME, `${MAX_DISPLAY_NAME} caractères au plus`)) });

/** Nom affiché (vide = nom du groupe). */
export async function updateBranding(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "settings.manage");
  const input = parseInput(brandingInput, raw);
  const displayName = input.displayName || null;
  await db.transaction(async (tx) => {
    const [before] = await tx.select({ displayName: tenants.displayName }).from(tenants).where(eq(tenants.id, ctx.tenantId));
    await tx.update(tenants).set({ displayName }).where(eq(tenants.id, ctx.tenantId));
    await audit(tx, ctx, { entityType: "tenant", entityId: ctx.tenantId, action: "update_branding", before, after: { displayName } });
  });
}

/** Nouveau logo : format vérifié sur le contenu réel, 512 Ko au plus. */
export async function setLogo(ctx: AuthContext, file: { name: string; bytes: Uint8Array } | null) {
  assertCan(ctx, "settings.manage");
  if (!file || file.bytes.length === 0) throw new BusinessRuleError(["Choisir une image (PNG, JPEG ou WebP)."]);
  const check = checkLogo({ name: file.name, size: file.bytes.length, head: file.bytes.slice(0, SIGNATURE_LENGTH) });
  if (!check.ok) throw new BusinessRuleError(check.errors);
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(tenants)
      .set({ logoData: Buffer.from(file.bytes).toString("base64"), logoContentType: check.contentType, logoUpdatedAt: now })
      .where(eq(tenants.id, ctx.tenantId));
    await audit(tx, ctx, {
      entityType: "tenant",
      entityId: ctx.tenantId,
      action: "update_logo",
      after: { contentType: check.contentType, size: file.bytes.length },
    });
  });
}

export async function removeLogo(ctx: AuthContext) {
  assertCan(ctx, "settings.manage");
  await db.transaction(async (tx) => {
    await tx.update(tenants).set({ logoData: null, logoContentType: null, logoUpdatedAt: null }).where(eq(tenants.id, ctx.tenantId));
    await audit(tx, ctx, { entityType: "tenant", entityId: ctx.tenantId, action: "remove_logo" });
  });
}

/** Contenu du logo de l'organisation de l'utilisateur. */
export async function getLogo(ctx: AuthContext) {
  const [row] = await db
    .select({ data: tenants.logoData, contentType: tenants.logoContentType, updatedAt: tenants.logoUpdatedAt })
    .from(tenants)
    .where(eq(tenants.id, ctx.tenantId));
  if (!row?.data || !row.contentType) throw new NotFoundError("Logo");
  return { bytes: Buffer.from(row.data, "base64"), contentType: row.contentType, updatedAt: row.updatedAt };
}
