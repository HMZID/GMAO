import { boolean, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, ts, updatedAt } from "./columns";
import { roleEnum, scopeTypeEnum } from "./enums";
import { tenants } from "./organization";

/**
 * Tables gérées par Better Auth (user, session, account, verification).
 * Les clés JS doivent rester celles attendues par Better Auth ; les colonnes sont en snake_case.
 * Champs ajoutés au user : tenantId, isActive (voir `src/server/auth/auth.ts`).
 */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  /** HAB-08 : un utilisateur désactivé ne peut plus se connecter, son historique reste. */
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: ts("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ts("access_token_expires_at"),
    refreshTokenExpiresAt: ts("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/**
 * Couple rôle × périmètre (CDC §2.3, HAB-02, HAB-03).
 * scopeId = null pour un périmètre TENANT (tout le groupe).
 * validFrom / validTo permettent les délégations temporaires.
 */
export const roleAssignments = pgTable(
  "role_assignments",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    scopeType: scopeTypeEnum("scope_type").notNull(),
    scopeId: uuid("scope_id"),
    validFrom: ts("valid_from"),
    validTo: ts("valid_to"),
    createdAt: createdAt(),
  },
  (t) => [index("role_assignments_user_idx").on(t.userId)],
);

/** Notifications dans l'application (NOT-01). */
export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt)],
);
