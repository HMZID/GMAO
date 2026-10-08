import { index, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import type { ImportRow } from "@/server/domain/imports";
import { user } from "./auth";
import { createdAt, id, ts } from "./columns";
import { importKindEnum, importModeEnum, importStatusEnum } from "./enums";
import { tenants } from "./organization";

/**
 * Imports Excel (EQP-13, INT-01) : une simulation enregistre les lignes lues et leur diagnostic ;
 * l'exécution crée les objets par les services de saisie et complète le rapport ligne par ligne.
 */
export const importJobs = pgTable(
  "import_jobs",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    kind: importKindEnum("kind").notNull(),
    fileName: text("file_name").notNull(),
    /** Empreinte du fichier : signale la réimportation d'un fichier déjà exécuté. */
    sha256: text("sha256").notNull(),
    status: importStatusEnum("status").notNull().default("SIMULATED"),
    mode: importModeEnum("mode"),
    totalRows: integer("total_rows").notNull().default(0),
    readyRows: integer("ready_rows").notNull().default(0),
    existingRows: integer("existing_rows").notNull().default(0),
    errorRows: integer("error_rows").notNull().default(0),
    importedRows: integer("imported_rows").notNull().default(0),
    /** Anomalies du fichier lui-même (colonnes manquantes, onglet introuvable…). */
    fileErrors: jsonb("file_errors").$type<string[]>().notNull().default([]),
    rows: jsonb("rows").$type<ImportRow[]>().notNull().default([]),
    createdById: text("created_by_id")
      .notNull()
      .references(() => user.id),
    createdAt: createdAt(),
    executedAt: ts("executed_at"),
  },
  (t) => [index("import_jobs_tenant_idx").on(t.tenantId, t.createdAt), index("import_jobs_sha_idx").on(t.tenantId, t.sha256)],
);
