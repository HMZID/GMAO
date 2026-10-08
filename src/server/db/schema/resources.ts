import { boolean, index, integer, pgTable, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, money, ts, updatedAt } from "./columns";
import { absenceTypeEnum } from "./enums";
import { sites, tenants } from "./organization";
import { user } from "./auth";

/** Ressources de maintenance (CDC §6) : techniciens, compétences, habilitations, absences. */

export const technicians = pgTable(
  "technicians",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    /** Compte utilisateur associé, pour l'application mobile (facultatif). */
    userId: text("user_id").references(() => user.id),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    qualification: text("qualification"),
    /** Heures de présence prévues par jour, pour la capacité (PLA-04). */
    dailyHours: integer("daily_hours").notNull().default(7),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("technicians_user_uq").on(t.userId), index("technicians_site_idx").on(t.siteId)],
);

/** Taux horaires datés (KPI-02) : le taux applicable est celui en vigueur à la date du pointage. */
export const laborRates = pgTable(
  "labor_rates",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicians.id),
    hourlyRate: money("hourly_rate").notNull(),
    validFrom: ts("valid_from").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("labor_rates_tech_idx").on(t.technicianId, t.validFrom)],
);

export const skills = pgTable(
  "skills",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("skills_tenant_code_uq").on(t.tenantId, t.code)],
);

export const technicianSkills = pgTable(
  "technician_skills",
  {
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicians.id, { onDelete: "cascade" }),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    level: integer("level").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.technicianId, t.skillId] })],
);

/** Habilitations à validité limitée (PLA-03). */
export const certifications = pgTable(
  "certifications",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicians.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    validUntil: ts("valid_until"),
    createdAt: createdAt(),
  },
  (t) => [index("certifications_tech_idx").on(t.technicianId)],
);

/** Absences (PLA-02). */
export const absences = pgTable(
  "absences",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicians.id, { onDelete: "cascade" }),
    type: absenceTypeEnum("type").notNull().default("LEAVE"),
    startAt: ts("start_at").notNull(),
    endAt: ts("end_at").notNull(),
    comment: text("comment"),
    createdAt: createdAt(),
  },
  (t) => [index("absences_tech_idx").on(t.technicianId, t.startAt)],
);
