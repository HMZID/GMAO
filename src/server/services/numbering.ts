import "server-only";
import { eq, sql } from "drizzle-orm";
import type { DbOrTx } from "@/server/db";
import { companies, sequences } from "@/server/db/schema";

export type SequenceKind = "OT" | "DI";

/**
 * Numéro unique par société et par année, jamais réutilisé (COR-05) : OT-SBTP-2026-00012.
 * L'incrément est atomique (INSERT … ON CONFLICT DO UPDATE), sûr en cas de créations simultanées.
 */
export async function nextNumber(tx: DbOrTx, input: { tenantId: string; companyId: string; kind: SequenceKind; date?: Date }) {
  const year = (input.date ?? new Date()).getUTCFullYear();
  const [row] = await tx
    .insert(sequences)
    .values({ tenantId: input.tenantId, companyId: input.companyId, kind: input.kind, year, value: 1 })
    .onConflictDoUpdate({
      target: [sequences.companyId, sequences.kind, sequences.year],
      set: { value: sql`${sequences.value} + 1` },
    })
    .returning({ value: sequences.value });
  const [company] = await tx.select({ code: companies.code }).from(companies).where(eq(companies.id, input.companyId));
  return `${input.kind}-${company?.code ?? "X"}-${year}-${String(row.value).padStart(5, "0")}`;
}
