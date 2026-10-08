import { boolean, index, integer, jsonb, pgTable, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { createdAt, id, ts } from "./columns";
import { emailEventEnum, emailStatusEnum } from "./enums";
import { tenants } from "./organization";

/**
 * File d'envoi des courriels (NOT-01) : chaque courriel est écrit dans la même transaction que l'événement
 * qui le déclenche, puis envoyé en arrière-plan par le processus d'envoi (`npm run worker`) avec reprises.
 * La clé anti-doublon garantit qu'un même événement ne produit qu'un courriel par destinataire.
 */
export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    toAddress: text("to_address").notNull(),
    event: emailEventEnum("event").notNull(),
    /** Clé de l'événement : un seul courriel par clé et par groupe. */
    dedupKey: text("dedup_key").notNull(),
    subject: text("subject").notNull(),
    textBody: text("text_body").notNull(),
    htmlBody: text("html_body").notNull(),
    status: emailStatusEnum("status").notNull().default("PENDING"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: ts("next_attempt_at").defaultNow().notNull(),
    /** Prise en charge par un processus d'envoi : une prise en charge abandonnée est reprise après expiration. */
    lockedUntil: ts("locked_until"),
    lastError: text("last_error"),
    /** Historique des échecs : date, message, définitif ou non. */
    errors: jsonb("errors").$type<{ at: string; message: string; permanent: boolean }[]>().notNull().default([]),
    transport: text("transport"),
    messageId: text("message_id"),
    createdAt: createdAt(),
    sentAt: ts("sent_at"),
  },
  (t) => [
    uniqueIndex("email_outbox_dedup_uq").on(t.tenantId, t.dedupKey),
    index("email_outbox_queue_idx").on(t.status, t.nextAttemptAt),
    index("email_outbox_tenant_idx").on(t.tenantId, t.createdAt),
  ],
);

/** Préférences de notification par courriel, par utilisateur et par événement (sauf alertes obligatoires). */
export const emailPreferences = pgTable(
  "email_preferences",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    event: emailEventEnum("event").notNull(),
    enabled: boolean("enabled").notNull(),
    updatedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.event] })],
);
