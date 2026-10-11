import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { createdAt, id, ts } from "./columns";
import { tenants } from "./organization";

/**
 * Clés d'API du connecteur (INT-01, INT-05) : seule l'empreinte SHA-256 est enregistrée, la clé n'est
 * montrée qu'à sa création. Les actions faites avec une clé sont tracées au nom de son créateur, canal API.
 */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    /** Début de la clé (« gmk_ » + 8 caractères), pour la reconnaître dans la liste. */
    prefix: text("prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    /** READ (lecture et export) ou IMPORT (lecture, export et import). */
    access: text("access").notNull(),
    createdById: text("created_by_id")
      .notNull()
      .references(() => user.id),
    createdAt: createdAt(),
    expiresAt: ts("expires_at"),
    lastUsedAt: ts("last_used_at"),
    revokedAt: ts("revoked_at"),
    revokedById: text("revoked_by_id").references(() => user.id),
  },
  (t) => [uniqueIndex("api_keys_hash_uq").on(t.keyHash), index("api_keys_tenant_idx").on(t.tenantId, t.createdAt)],
);
