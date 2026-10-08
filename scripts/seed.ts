/**
 * Données de démonstration (npm run db:seed) : un groupe, deux sociétés, trois sites,
 * douze équipements, plans d'entretien, stock, utilisateurs par rôle, six mois d'historique
 * et les situations des scénarios de recette R-01 à R-08 du cahier des charges.
 *
 * Les dates sont calculées par rapport au jour d'exécution : la démo est toujours « actuelle ».
 * Mot de passe de tous les comptes : voir DEMO_PASSWORD ci-dessous.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, eq, sql } from "drizzle-orm";
import { buildAuthContext } from "@/server/authz/context";
import { ROLES, type Role } from "@/server/authz/permissions";
import { db } from "@/server/db";
import * as s from "@/server/db/schema";
import { computeDue, type OperationRule } from "@/server/domain/preventive";
import { assignEquipment, createEquipment } from "@/server/services/equipment";
import { createMeter, recordReading, replaceMeter } from "@/server/services/meters";
import { nextNumber } from "@/server/services/numbering";
import { applyPlanToEquipment, createPlan, generatePreventiveWorkOrders, recomputeDueItems } from "@/server/services/preventive";
import {
  createWorkOrder,
  recordTime,
  setExternalCost,
  transitionWorkOrder,
  updatePlanning,
  updateReport,
  updateTask,
} from "@/server/services/work-orders";
import { convertToWorkOrder, createWorkRequest, qualifyWorkRequest } from "@/server/services/work-requests";

export const DEMO_PASSWORD = "Demo-Gmao-2026";

const DAY = 86_400_000;
const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY);
const daysFromNow = (n: number) => new Date(now.getTime() + n * DAY);
/** Lundi de la semaine courante à 08:00 UTC + n jours. */
const weekDay = (n: number, hour = 8) => {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour));
  const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY);
  return new Date(monday.getTime() + n * DAY);
};

/** Jour ouvré à n jours d'aujourd'hui (le week-end est reporté au lundi), à l'heure UTC donnée. */
const workday = (n: number, hour = 6) => {
  const d = new Date(now.getTime() + n * DAY);
  const shift = d.getUTCDay() === 6 ? 2 : d.getUTCDay() === 0 ? 1 : 0;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + shift, hour));
};

// Générateur pseudo-aléatoire déterministe
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

/**
 * Série de relevés croissants, un tous les 4 jours de `firstDay` à `lastDay` (en jours avant aujourd'hui),
 * se terminant exactement à `end`. Les écarts varient de ±20 % autour de l'usage moyen : la série reste
 * monotone et plausible (DON-01, DON-02), donc acceptée par les contrôles de saisie.
 */
function readingSeries(end: number, perDay: number, firstDay: number, lastDay: number, isKm: boolean) {
  const days: number[] = [];
  for (let d = firstDay; d >= lastDay; d -= 4) days.push(d);
  const values: number[] = new Array(days.length);
  let v = end;
  for (let i = days.length - 1; i >= 0; i--) {
    values[i] = isKm ? Math.round(v) : Math.round(v * 10) / 10;
    if (i > 0) v -= (days[i - 1] - days[i]) * perDay * (0.8 + rand() * 0.4);
  }
  return days.map((day, i) => ({ day, value: values[i] }));
}

async function main() {
  const [{ count }] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(s.tenants);
  if (count > 0) {
    console.log("La base contient déjà des données : lancer `npm run db:reset` pour repartir de zéro.");
    process.exit(0);
  }

  /* ---------------------------------------------------------------- */
  /* Organisation                                                       */
  /* ---------------------------------------------------------------- */
  const [tenant] = await db.insert(s.tenants).values({ name: "Groupe Démo BTP" }).returning();
  const T = tenant.id;

  const [sbtp, loca] = await db
    .insert(s.companies)
    .values([
      { tenantId: T, code: "SBTP", name: "SBTP Travaux Publics" },
      { tenantId: T, code: "LOCA", name: "LocaEngins Alpes" },
    ])
    .returning();

  const [lyo, mrs, gre] = await db
    .insert(s.sites)
    .values([
      { tenantId: T, companyId: sbtp.id, code: "LYO", name: "Dépôt Lyon", address: "Zone industrielle Nord, Lyon" },
      { tenantId: T, companyId: sbtp.id, code: "MRS", name: "Agence Marseille", address: "Port autonome, Marseille" },
      { tenantId: T, companyId: loca.id, code: "GRE", name: "Dépôt Grenoble", address: "Rue des Alpes, Grenoble" },
    ])
    .returning();

  const [atLyo, , atGre] = await db
    .insert(s.workshops)
    .values([
      { tenantId: T, siteId: lyo.id, code: "AT-LYO", name: "Atelier Lyon", bays: 3 },
      { tenantId: T, siteId: mrs.id, code: "AT-MRS", name: "Atelier Marseille", bays: 2 },
      { tenantId: T, siteId: gre.id, code: "AT-GRE", name: "Atelier Grenoble", bays: 2 },
    ])
    .returning();

  const [whLyo, whMrs, whTruck, whGre] = await db
    .insert(s.warehouses)
    .values([
      { tenantId: T, siteId: lyo.id, code: "MAG-LYO", name: "Magasin Lyon" },
      { tenantId: T, siteId: mrs.id, code: "MAG-MRS", name: "Magasin Marseille" },
      { tenantId: T, siteId: lyo.id, code: "CAM-01", name: "Camion atelier 01", isMobile: true },
      { tenantId: T, siteId: gre.id, code: "MAG-GRE", name: "Magasin Grenoble" },
    ])
    .returning();
  await db
    .insert(s.storageLocations)
    .values([whLyo, whMrs, whTruck, whGre].map((w) => ({ tenantId: T, warehouseId: w.id, code: "GEN", label: "Emplacement général" })));

  const [c15, c22, g03] = await db
    .insert(s.jobsites)
    .values([
      {
        tenantId: T,
        companyId: sbtp.id,
        code: "C-15",
        name: "Chantier C-15 — ZAC des Berges",
        address: "Villeurbanne",
        startDate: daysAgo(200),
        latitude: 45.77,
        longitude: 4.88,
      },
      {
        tenantId: T,
        companyId: sbtp.id,
        code: "C-22",
        name: "Chantier C-22 — Rocade Est",
        address: "Aubagne",
        startDate: daysAgo(90),
        latitude: 43.29,
        longitude: 5.57,
      },
      {
        tenantId: T,
        companyId: loca.id,
        code: "G-03",
        name: "Chantier G-03 — Barrage du Drac",
        address: "Saint-Georges-de-Commiers",
        startDate: daysAgo(150),
      },
    ])
    .returning();

  await db.insert(s.costCenters).values([
    { tenantId: T, companyId: sbtp.id, code: "SBTP-MAINT", name: "Maintenance SBTP" },
    { tenantId: T, companyId: loca.id, code: "LOCA-MAINT", name: "Maintenance LocaEngins" },
  ]);

  /* ---------------------------------------------------------------- */
  /* Utilisateurs, rôles × périmètres, techniciens                      */
  /* ---------------------------------------------------------------- */
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  type Seat = { email: string; name: string; role: Role; scope: "TENANT" | "COMPANY" | "SITE"; scopeId?: string };
  const seats: Seat[] = [
    { email: "admin@demo.gmao", name: "Alice Martin", role: "ADMIN", scope: "TENANT" },
    { email: "resp.maintenance@demo.gmao", name: "Karim Benali", role: "MAINTENANCE_MANAGER", scope: "TENANT" },
    { email: "flotte@demo.gmao", name: "Sophie Durand", role: "FLEET_MANAGER", scope: "COMPANY", scopeId: sbtp.id },
    { email: "chef.lyon@demo.gmao", name: "Marc Lefèvre", role: "WORKSHOP_MANAGER", scope: "SITE", scopeId: lyo.id },
    { email: "chef.grenoble@demo.gmao", name: "Yanis Ferhat", role: "WORKSHOP_MANAGER", scope: "SITE", scopeId: gre.id },
    { email: "tech.lyon@demo.gmao", name: "Julien Moreau", role: "TECHNICIAN", scope: "SITE", scopeId: lyo.id },
    { email: "tech2.lyon@demo.gmao", name: "Nadia Haddad", role: "TECHNICIAN", scope: "SITE", scopeId: lyo.id },
    { email: "tech.grenoble@demo.gmao", name: "Lucas Bernard", role: "TECHNICIAN", scope: "SITE", scopeId: gre.id },
    { email: "conducteur@demo.gmao", name: "Paul Girard", role: "OPERATOR", scope: "SITE", scopeId: lyo.id },
    { email: "magasin@demo.gmao", name: "Claire Petit", role: "STOREKEEPER", scope: "COMPANY", scopeId: sbtp.id },
    { email: "achats@demo.gmao", name: "Thomas Roux", role: "PURCHASING_MANAGER", scope: "TENANT" },
    { email: "direction@demo.gmao", name: "Hélène Garnier", role: "EXECUTIVE", scope: "TENANT" },
  ];
  const users: Record<string, string> = {};
  for (const seat of seats) {
    const id = randomUUID();
    users[seat.email] = id;
    await db.insert(s.user).values({ id, name: seat.name, email: seat.email, emailVerified: true, tenantId: T });
    await db.insert(s.account).values({ id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: passwordHash });
    await db.insert(s.roleAssignments).values({ tenantId: T, userId: id, role: seat.role, scopeType: seat.scope, scopeId: seat.scopeId ?? null });
  }
  // Délégation temporaire (HAB-03) : le chef d'atelier de Lyon remplace le responsable maintenance ce mois-ci
  await db.insert(s.roleAssignments).values({
    tenantId: T,
    userId: users["chef.lyon@demo.gmao"],
    role: "MAINTENANCE_MANAGER",
    scopeType: "SITE",
    scopeId: lyo.id,
    validFrom: daysAgo(3),
    validTo: daysFromNow(25),
  });

  const techRows = await db
    .insert(s.technicians)
    .values([
      {
        tenantId: T,
        userId: users["tech.lyon@demo.gmao"],
        siteId: lyo.id,
        firstName: "Julien",
        lastName: "Moreau",
        qualification: "Mécanicien engins",
      },
      { tenantId: T, userId: users["tech2.lyon@demo.gmao"], siteId: lyo.id, firstName: "Nadia", lastName: "Haddad", qualification: "Hydraulicienne" },
      { tenantId: T, siteId: mrs.id, firstName: "Samir", lastName: "Kaci", qualification: "Mécanicien poids lourds" },
      {
        tenantId: T,
        userId: users["tech.grenoble@demo.gmao"],
        siteId: gre.id,
        firstName: "Lucas",
        lastName: "Bernard",
        qualification: "Mécanicien engins",
      },
    ])
    .returning();
  const [julien, nadia, samir, lucas] = techRows;
  const rates = [48, 52, 46, 47];
  await db.insert(s.laborRates).values(techRows.map((t, i) => ({ tenantId: T, technicianId: t.id, hourlyRate: rates[i], validFrom: daysAgo(400) })));
  const skillRows = await db
    .insert(s.skills)
    .values([
      { tenantId: T, code: "MEC", name: "Mécanique moteur" },
      { tenantId: T, code: "HYD", name: "Hydraulique" },
      { tenantId: T, code: "ELEC", name: "Électricité" },
      { tenantId: T, code: "PL", name: "Poids lourds" },
    ])
    .returning();
  const skill = (code: string) => skillRows.find((k) => k.code === code)!.id;
  await db.insert(s.technicianSkills).values([
    { technicianId: julien.id, skillId: skill("MEC"), level: 3 },
    { technicianId: julien.id, skillId: skill("HYD"), level: 2 },
    { technicianId: nadia.id, skillId: skill("HYD"), level: 3 },
    { technicianId: nadia.id, skillId: skill("ELEC"), level: 2 },
    { technicianId: samir.id, skillId: skill("PL"), level: 3 },
    { technicianId: lucas.id, skillId: skill("MEC"), level: 2 },
  ]);
  await db.insert(s.certifications).values([
    { tenantId: T, technicianId: nadia.id, name: "Habilitation électrique B1V", validUntil: daysFromNow(300) },
    { tenantId: T, technicianId: julien.id, name: "Autorisation de conduite engins", validUntil: daysFromNow(20) },
  ]);
  await db.insert(s.absences).values({
    tenantId: T,
    technicianId: nadia.id,
    type: "TRAINING",
    startAt: weekDay(2, 0),
    endAt: weekDay(4, 23),
    comment: "Formation hydraulique proportionnelle",
  });

  /* Contexte « système » : tous les rôles sur tout le groupe, pour exécuter les services. */
  const ctx = buildAuthContext(
    { id: users["admin@demo.gmao"], tenantId: T, name: "Initialisation", email: "admin@demo.gmao" },
    ROLES.map((role) => ({ role, scopeType: "TENANT" as const, scopeId: null })),
    { channel: "SYSTEM" },
  );

  /* ---------------------------------------------------------------- */
  /* Référentiel : catégories, modèles, fournisseurs, pièces           */
  /* ---------------------------------------------------------------- */
  const categoryRows = await db
    .insert(s.equipmentCategories)
    .values([
      { tenantId: T, code: "CHARGEUSE", name: "Chargeuse sur pneus", defaultCriticality: "B" },
      {
        tenantId: T,
        code: "PELLE",
        name: "Pelle hydraulique",
        defaultCriticality: "A",
        attributeDefinitions: [{ key: "poids", label: "Poids opérationnel", unit: "t" }],
      },
      {
        tenantId: T,
        code: "CHARIOT",
        name: "Chariot élévateur",
        defaultCriticality: "B",
        attributeDefinitions: [{ key: "capaciteLevage", label: "Capacité de levage", unit: "kg" }],
      },
      { tenantId: T, code: "CAMION", name: "Camion porteur", defaultCriticality: "B" },
      { tenantId: T, code: "TRACTO", name: "Tractopelle", defaultCriticality: "B" },
      {
        tenantId: T,
        code: "GROUPE",
        name: "Groupe électrogène",
        defaultCriticality: "C",
        attributeDefinitions: [{ key: "puissance", label: "Puissance", unit: "kVA" }],
      },
    ])
    .returning();
  const cat = (code: string) => categoryRows.find((c) => c.code === code)!;

  const modelRows = await db
    .insert(s.equipmentModels)
    .values([
      { tenantId: T, categoryId: cat("CHARGEUSE").id, manufacturer: "Caterpillar", name: "950M" },
      { tenantId: T, categoryId: cat("CHARGEUSE").id, manufacturer: "Volvo", name: "L90H" },
      { tenantId: T, categoryId: cat("PELLE").id, manufacturer: "Komatsu", name: "PC210LC-11" },
      { tenantId: T, categoryId: cat("PELLE").id, manufacturer: "Caterpillar", name: "320" },
      { tenantId: T, categoryId: cat("CHARIOT").id, manufacturer: "Toyota", name: "8FBE20" },
      { tenantId: T, categoryId: cat("CHARIOT").id, manufacturer: "Manitou", name: "MI25D" },
      { tenantId: T, categoryId: cat("CAMION").id, manufacturer: "Renault Trucks", name: "C 430 8x4" },
      { tenantId: T, categoryId: cat("TRACTO").id, manufacturer: "JCB", name: "3CX" },
      { tenantId: T, categoryId: cat("GROUPE").id, manufacturer: "SDMO", name: "J130" },
    ])
    .returning();
  const model = (mfr: string, name: string) => modelRows.find((m) => m.manufacturer === mfr && m.name === name)!;

  const [supEngins, supHydro, supPL, supControle] = await db
    .insert(s.suppliers)
    .values([
      {
        tenantId: T,
        name: "Engins Services Rhône",
        taxId: "FR11000000001",
        email: "atelier@engins-services.example",
        phone: "04 00 00 00 01",
        isContractor: true,
      },
      { tenantId: T, name: "Hydraulique Pro Sud", taxId: "FR11000000002", email: "contact@hydropro.example", isContractor: true },
      { tenantId: T, name: "Pièces Poids Lourds 69", taxId: "FR11000000003", email: "commandes@ppl69.example" },
      { tenantId: T, name: "Bureau de Contrôle Alpes", taxId: "FR11000000004", email: "planning@bca.example", isContractor: true },
    ])
    .returning();

  type PartSeed = {
    sku: string;
    name: string;
    family: string;
    unit: string;
    mfr: string;
    ref: string;
    cost: number;
    crit?: "A" | "B" | "C";
    repairable?: boolean;
  };
  const partSeeds: PartSeed[] = [
    { sku: "FLT-HUI-01", name: "Filtre à huile moteur", family: "Filtration", unit: "u", mfr: "Caterpillar", ref: "1R-0750", cost: 38 },
    { sku: "FLT-GAZ-01", name: "Filtre à gazole", family: "Filtration", unit: "u", mfr: "Caterpillar", ref: "1R-0762", cost: 45 },
    { sku: "FLT-HYD-01", name: "Filtre hydraulique retour", family: "Filtration", unit: "u", mfr: "Komatsu", ref: "20Y-60-31171", cost: 96 },
    { sku: "FLT-AIR-01", name: "Filtre à air primaire", family: "Filtration", unit: "u", mfr: "Donaldson", ref: "P532501", cost: 72 },
    { sku: "HUI-MOT-15W40", name: "Huile moteur 15W40", family: "Lubrifiants", unit: "L", mfr: "Total", ref: "RUBIA-15W40-208", cost: 4.2 },
    { sku: "HUI-HYD-46", name: "Huile hydraulique HV46", family: "Lubrifiants", unit: "L", mfr: "Total", ref: "EQUIVIS-ZS46-208", cost: 3.6 },
    { sku: "GRA-EP2", name: "Graisse EP2", family: "Lubrifiants", unit: "kg", mfr: "Total", ref: "MULTIS-EP2-18", cost: 9.5 },
    {
      sku: "POMPE-HYD-TOY",
      name: "Pompe hydraulique chariot 8FBE",
      family: "Hydraulique",
      unit: "u",
      mfr: "Toyota",
      ref: "67110-26600-71",
      cost: 1450,
      crit: "A",
      repairable: true,
    },
    { sku: "FLEX-HYD-12", name: 'Flexible hydraulique 1/2" 1 m', family: "Hydraulique", unit: "u", mfr: "Parker", ref: "471TC-8-1000", cost: 58 },
    { sku: "KIT-JOINT-VER", name: "Kit joints de vérin de godet", family: "Hydraulique", unit: "u", mfr: "JCB", ref: "991-00125", cost: 135 },
    {
      sku: "PLAQ-FREIN-PL",
      name: "Jeu de plaquettes de frein PL",
      family: "Freinage",
      unit: "jeu",
      mfr: "Renault Trucks",
      ref: "7485137930",
      cost: 210,
    },
    { sku: "BAT-12V-180", name: "Batterie 12 V 180 Ah", family: "Électricité", unit: "u", mfr: "Varta", ref: "680011100", cost: 265 },
    { sku: "COUR-ALT-01", name: "Courroie d'alternateur", family: "Moteur", unit: "u", mfr: "Gates", ref: "8PK1795", cost: 41 },
    { sku: "LDR-50L", name: "Liquide de refroidissement", family: "Lubrifiants", unit: "L", mfr: "Total", ref: "COOLELF-AUTO", cost: 3.1 },
  ];
  const partRows = await db
    .insert(s.parts)
    .values(
      partSeeds.map((p) => ({
        tenantId: T,
        sku: p.sku,
        name: p.name,
        family: p.family,
        unit: p.unit,
        manufacturer: p.mfr,
        manufacturerRef: p.ref,
        averageCost: p.cost,
        criticality: p.crit ?? "C",
        isRepairable: p.repairable ?? false,
      })),
    )
    .returning();
  const part = (sku: string) => partRows.find((p) => p.sku === sku)!;
  await db.insert(s.partSuppliers).values([
    { partId: part("POMPE-HYD-TOY").id, supplierId: supHydro.id, price: 1450, leadTimeDays: 10, preferred: true },
    { partId: part("PLAQ-FREIN-PL").id, supplierId: supPL.id, price: 210, leadTimeDays: 3, preferred: true },
    { partId: part("FLT-HUI-01").id, supplierId: supEngins.id, price: 38, leadTimeDays: 2, preferred: true },
  ]);

  // Stocks initiaux : réceptions il y a 6 mois (mouvements datés), niveaux recalculés en fin de script
  const initialStock: [string, (typeof whLyo)["id"], number, number?, number?][] = [
    // sku, magasin, quantité, point de commande, maximum
    ["FLT-HUI-01", whLyo.id, 24, 6, 30],
    ["FLT-HUI-01", whMrs.id, 10, 4, 15],
    ["FLT-HUI-01", whGre.id, 12, 4, 15],
    ["FLT-GAZ-01", whLyo.id, 16, 4, 20],
    ["FLT-GAZ-01", whGre.id, 8, 3, 10],
    ["FLT-HYD-01", whLyo.id, 8, 3, 10],
    ["FLT-HYD-01", whMrs.id, 4, 2, 6],
    ["FLT-HYD-01", whGre.id, 6, 2, 8],
    ["FLT-AIR-01", whLyo.id, 6, 2, 8],
    ["FLT-AIR-01", whGre.id, 4, 2, 6],
    ["HUI-MOT-15W40", whLyo.id, 620, 150, 800],
    ["HUI-MOT-15W40", whMrs.id, 300, 80, 400],
    ["HUI-MOT-15W40", whGre.id, 400, 100, 500],
    ["HUI-HYD-46", whLyo.id, 410, 100, 600],
    ["HUI-HYD-46", whGre.id, 300, 80, 400],
    ["GRA-EP2", whLyo.id, 36, 10, 54],
    ["GRA-EP2", whGre.id, 18, 6, 36],
    ["GRA-EP2", whTruck.id, 6, 2, 8],
    ["POMPE-HYD-TOY", whMrs.id, 1, 1, 2],
    ["FLEX-HYD-12", whLyo.id, 6, 3, 10],
    ["FLEX-HYD-12", whTruck.id, 4, 2, 4],
    ["FLEX-HYD-12", whGre.id, 5, 2, 8],
    ["KIT-JOINT-VER", whGre.id, 3, 1, 4],
    ["PLAQ-FREIN-PL", whLyo.id, 4, 2, 6],
    ["PLAQ-FREIN-PL", whMrs.id, 3, 2, 4],
    ["BAT-12V-180", whLyo.id, 3, 1, 4],
    ["BAT-12V-180", whGre.id, 2, 1, 3],
    ["COUR-ALT-01", whLyo.id, 4, 2, 6],
    ["LDR-50L", whLyo.id, 120, 40, 200],
    ["LDR-50L", whGre.id, 60, 20, 100],
  ];
  for (const [sku, warehouseId, qty, reorderPoint, maxQty] of initialStock) {
    const p = part(sku);
    await db.insert(s.stockLevels).values({
      tenantId: T,
      partId: p.id,
      warehouseId,
      reorderPoint: reorderPoint ?? null,
      maxQty: maxQty ?? null,
      minQty: reorderPoint ? Math.ceil(reorderPoint / 2) : null,
    });
    await db.insert(s.stockMovements).values({
      tenantId: T,
      partId: p.id,
      warehouseId,
      type: "RECEIPT",
      quantity: qty,
      unitCost: p.averageCost,
      reference: "Inventaire d'ouverture",
      reason: "Reprise des stocks (CDC §15.2)",
      createdById: ctx.userId,
      createdAt: daysAgo(185),
    });
  }

  /* ---------------------------------------------------------------- */
  /* Parc : équipements, compteurs, six mois de relevés                */
  /* ---------------------------------------------------------------- */
  type FleetSeed = {
    code: string;
    name: string;
    cat: string;
    model: [string, string];
    company: typeof sbtp;
    site: typeof lyo;
    serial: string;
    registration?: string;
    year: number;
    criticality?: "A" | "B" | "C";
    /** current : valeur lue aujourd'hui ; perDay : usage moyen journalier. */
    meter: { type: "HOURS" | "KM"; current: number; perDay: number };
    commissioned: string;
    value: number;
    attributes?: Record<string, number>;
  };
  const fleet: FleetSeed[] = [
    {
      code: "CH-012",
      name: "Chargeuse sur pneus 950M",
      cat: "CHARGEUSE",
      model: ["Caterpillar", "950M"],
      company: sbtp,
      site: lyo,
      serial: "CAT0950MKRTL01234",
      year: 2019,
      criticality: "B",
      meter: { type: "HOURS", current: 4350, perDay: 4.6 },
      commissioned: "2019-04-15",
      value: 245000,
    },
    {
      code: "CH-020",
      name: "Chargeuse sur pneus 950M",
      cat: "CHARGEUSE",
      model: ["Caterpillar", "950M"],
      company: sbtp,
      site: mrs,
      serial: "CAT0950MKRTL04411",
      year: 2023,
      meter: { type: "HOURS", current: 1790, perDay: 3.9 },
      commissioned: "2023-02-01",
      value: 268000,
    },
    {
      code: "PE-007",
      name: "Pelle hydraulique PC210",
      cat: "PELLE",
      model: ["Komatsu", "PC210LC-11"],
      company: sbtp,
      site: lyo,
      serial: "KMTPC210V55K60321",
      year: 2020,
      meter: { type: "HOURS", current: 5942, perDay: 6.1 },
      commissioned: "2020-06-10",
      value: 182000,
      attributes: { poids: 23.4 },
    },
    {
      code: "PE-002",
      name: "Pelle hydraulique 320",
      cat: "PELLE",
      model: ["Caterpillar", "320"],
      company: sbtp,
      site: mrs,
      serial: "CAT0320GDKX00987",
      year: 2018,
      meter: { type: "HOURS", current: 6850, perDay: 5 },
      commissioned: "2018-09-03",
      value: 195000,
      attributes: { poids: 22.5 },
    },
    {
      code: "CE-031",
      name: "Chariot élévateur 2 t",
      cat: "CHARIOT",
      model: ["Toyota", "8FBE20"],
      company: sbtp,
      site: lyo,
      serial: "8FBE20-61234",
      year: 2021,
      meter: { type: "HOURS", current: 2690, perDay: 3.2 },
      commissioned: "2021-03-22",
      value: 31000,
      attributes: { capaciteLevage: 2000 },
    },
    {
      code: "CE-020",
      name: "Chariot élévateur diesel 2,5 t",
      cat: "CHARIOT",
      model: ["Manitou", "MI25D"],
      company: sbtp,
      site: mrs,
      serial: "MI25D-ME-778812",
      year: 2017,
      meter: { type: "HOURS", current: 4870, perDay: 2.5 },
      commissioned: "2017-05-12",
      value: 28000,
      attributes: { capaciteLevage: 2500 },
    },
    {
      code: "CA-101",
      name: "Camion benne 8x4",
      cat: "CAMION",
      model: ["Renault Trucks", "C 430 8x4"],
      company: sbtp,
      site: lyo,
      serial: "VF622GVA000123456",
      registration: "GA-123-BC",
      year: 2021,
      meter: { type: "KM", current: 169800, perDay: 180 },
      commissioned: "2021-01-18",
      value: 142000,
    },
    {
      code: "CA-102",
      name: "Camion benne 8x4",
      cat: "CAMION",
      model: ["Renault Trucks", "C 430 8x4"],
      company: sbtp,
      site: mrs,
      serial: "VF622GVA000654321",
      registration: "GB-456-CD",
      year: 2023,
      meter: { type: "KM", current: 121700, perDay: 210 },
      commissioned: "2023-03-07",
      value: 151000,
    },
    {
      code: "TP-004",
      name: "Tractopelle 3CX",
      cat: "TRACTO",
      model: ["JCB", "3CX"],
      company: loca,
      site: gre,
      serial: "JCB3CX4TPL2789456",
      year: 2019,
      meter: { type: "HOURS", current: 7612, perDay: 4.1 },
      commissioned: "2019-07-01",
      value: 96000,
    },
    {
      code: "GE-001",
      name: "Groupe électrogène 130 kVA",
      cat: "GROUPE",
      model: ["SDMO", "J130"],
      company: loca,
      site: gre,
      serial: "SDMOJ130K-551208",
      year: 2016,
      meter: { type: "HOURS", current: 12990, perDay: 9.5 },
      commissioned: "2016-11-20",
      value: 24000,
      attributes: { puissance: 130 },
    },
    {
      code: "CH-015",
      name: "Chargeuse sur pneus L90H",
      cat: "CHARGEUSE",
      model: ["Volvo", "L90H"],
      company: loca,
      site: gre,
      serial: "VCEL90HCL0012345",
      year: 2022,
      meter: { type: "HOURS", current: 3500, perDay: 5.2 },
      commissioned: "2022-04-04",
      value: 210000,
    },
    {
      code: "PE-010",
      name: "Pelle hydraulique PC210",
      cat: "PELLE",
      model: ["Komatsu", "PC210LC-11"],
      company: loca,
      site: gre,
      serial: "KMTPC210V55K71555",
      year: 2019,
      meter: { type: "HOURS", current: 8716, perDay: 5.8 },
      commissioned: "2019-03-15",
      value: 158000,
      attributes: { poids: 23.4 },
    },
  ];

  const eqIds: Record<string, string> = {};
  const meterIds: Record<string, string> = {};
  const HISTORY_DAYS = 185;

  for (const f of fleet) {
    const row = await createEquipment(ctx, {
      companyId: f.company.id,
      siteId: f.site.id,
      categoryId: cat(f.cat).id,
      modelId: model(...f.model).id,
      code: f.code,
      name: f.name,
      manufacturer: f.model[0],
      serialNumber: f.serial,
      registration: f.registration,
      year: f.year,
      criticality: f.criticality,
      acquisitionMode: f.code.startsWith("CA") ? "LEASE" : "PURCHASE",
      acquisitionDate: new Date(f.commissioned),
      acquisitionValue: f.value,
      commissioningDate: new Date(f.commissioned),
      warrantyEndDate: new Date(new Date(f.commissioned).getTime() + 2 * 365 * DAY),
    });
    eqIds[f.code] = row.id;
    if (f.attributes) await db.update(s.equipment).set({ attributes: f.attributes }).where(eq(s.equipment.id, row.id));

    const meter = await db.transaction((tx) =>
      createMeter(tx, ctx, row.id, {
        type: f.meter.type,
        label: f.meter.type === "HOURS" ? "Heures moteur" : "Kilométrage",
        unit: f.meter.type === "HOURS" ? "h" : "km",
        isPrimary: true,
      }),
    );
    meterIds[f.code] = meter.id;

    // Six mois de relevés, un tous les 4 jours, puis le relevé de prise de poste du jour.
    // PE-002 : l'ancien horamètre s'arrête avant son remplacement il y a 15 jours (scénario R-05).
    const isPe002 = f.code === "PE-002";
    const isKm = f.meter.type === "KM";
    const series = isPe002
      ? readingSeries(f.meter.current - 2 * f.meter.perDay, f.meter.perDay, HISTORY_DAYS, 17, isKm)
      : readingSeries(f.meter.current - f.meter.perDay, f.meter.perDay, HISTORY_DAYS, 1, isKm);
    for (const { day, value } of series) {
      await recordReading(ctx, meter.id, { value, readAt: daysAgo(day) });
    }
    if (!isPe002) {
      await recordReading(ctx, meter.id, {
        value: f.meter.current,
        readAt: new Date(now.getTime() - 3_600_000),
        comment: "Relevé de prise de poste",
      });
    }
  }

  // Scénario R-05 : horamètre de PE-002 remplacé il y a 15 jours à 6 850 h, nouveau compteur à 0 h, 120 h lues aujourd'hui
  // (6 970 h cumulées : l'entretien des 7 000 h approche).
  await replaceMeter(ctx, meterIds["PE-002"], {
    oldFinalValue: 6850,
    newInitialValue: 0,
    occurredAt: daysAgo(15),
    reason: "Tableau de bord remplacé après infiltration d'eau",
  });
  for (const [day, value] of [
    [12, 22],
    [8, 55],
    [4, 88],
    [0, 120],
  ] as const) {
    await recordReading(ctx, meterIds["PE-002"], { value, readAt: daysAgo(day) });
  }
  // DON-02 : un relevé télématique invraisemblable (3 250 km en 40 min) est mis « à vérifier »
  // sans faire avancer le compteur ; il attend une validation ou un rejet.
  await recordReading(ctx, meterIds["CA-102"], {
    value: 124_950,
    readAt: new Date(now.getTime() - 20 * 60_000),
    source: "TELEMATICS",
    comment: "Boîtier télématique",
  });

  /* ---------------------------------------------------------------- */
  /* Plans d'entretien et dernières réalisations (reprise §15.2)       */
  /* ---------------------------------------------------------------- */
  const commonChecks = [
    "Vidange huile moteur",
    "Remplacement filtre à huile moteur",
    "Remplacement filtre à gazole",
    "Contrôle des niveaux (hydraulique, refroidissement)",
    "Graissage des articulations",
    "Contrôle pression et usure des pneus",
  ];
  const plans = {
    CHARGEUSE: await createPlan(ctx, {
      name: "Chargeuse sur pneus — entretien périodique",
      description: "Plan constructeur : entretien 250 h ou 3 mois au premier seuil atteint (exemple du CDC §4.4).",
      categoryId: cat("CHARGEUSE").id,
      operations: [
        {
          code: "ENT-250",
          name: "Entretien 250 h ou 3 mois",
          mode: "SLIDING",
          preAlertMeter: 25,
          preAlertDays: 15,
          tolerancePercent: 10,
          estimatedMinutes: 180,
          triggers: [
            { kind: "METER", every: 250, meterType: "HOURS" },
            { kind: "CALENDAR", every: 3, unit: "MONTH" },
          ],
          checklist: commonChecks,
        },
        {
          code: "HYD-1000",
          name: "Filtres hydrauliques 1 000 h",
          mode: "FIXED",
          preAlertMeter: 50,
          estimatedMinutes: 90,
          triggers: [{ kind: "METER", every: 1000, meterType: "HOURS" }],
          checklist: ["Remplacement des filtres hydrauliques", "Prélèvement d'huile pour analyse"],
        },
      ],
    }),
    PELLE: await createPlan(ctx, {
      name: "Pelle hydraulique — entretien 500 h",
      categoryId: cat("PELLE").id,
      operations: [
        {
          code: "ENT-500",
          name: "Entretien 500 h ou 6 mois",
          mode: "SLIDING",
          preAlertMeter: 25,
          preAlertDays: 15,
          estimatedMinutes: 240,
          triggers: [
            { kind: "METER", every: 500, meterType: "HOURS" },
            { kind: "CALENDAR", every: 6, unit: "MONTH" },
          ],
          checklist: [...commonChecks, "Contrôle des dents et du godet", "Contrôle de la tension des chenilles"],
        },
      ],
    }),
    CHARIOT: await createPlan(ctx, {
      name: "Chariot élévateur — maintenance et vérification",
      categoryId: cat("CHARIOT").id,
      operations: [
        {
          code: "ENT-6M",
          name: "Entretien semestriel",
          mode: "SLIDING",
          preAlertDays: 15,
          estimatedMinutes: 120,
          triggers: [{ kind: "CALENDAR", every: 6, unit: "MONTH" }],
          checklist: ["Contrôle des chaînes et du mât", "Contrôle des freins", "Contrôle de la batterie ou du moteur", "Graissage"],
        },
        {
          code: "VGP-6M",
          name: "Vérification générale périodique (appareil de levage)",
          mode: "SLIDING",
          isRegulatory: true,
          blockWhenOverdue: true,
          preAlertDays: 30,
          estimatedMinutes: 60,
          triggers: [{ kind: "CALENDAR", every: 6, unit: "MONTH" }],
          checklist: ["Rapport de l'organisme joint", "Réserves levées ou planifiées"],
        },
      ],
    }),
    CAMION: await createPlan(ctx, {
      name: "Camion porteur — entretien et contrôle",
      categoryId: cat("CAMION").id,
      operations: [
        {
          code: "ENT-30K",
          name: "Entretien 30 000 km ou 1 an",
          mode: "SLIDING",
          preAlertMeter: 1500,
          preAlertDays: 30,
          estimatedMinutes: 240,
          triggers: [
            { kind: "METER", every: 30000, meterType: "KM" },
            { kind: "CALENDAR", every: 1, unit: "YEAR" },
          ],
          checklist: ["Vidange moteur et filtres", "Contrôle du freinage", "Contrôle de l'éclairage", "Contrôle des pneumatiques"],
        },
        {
          code: "CT-1A",
          name: "Contrôle technique annuel",
          mode: "SLIDING",
          isRegulatory: true,
          preAlertDays: 30,
          estimatedMinutes: 120,
          triggers: [{ kind: "CALENDAR", every: 1, unit: "YEAR" }],
          checklist: ["Procès-verbal de contrôle joint"],
        },
      ],
    }),
    TRACTO: await createPlan(ctx, {
      name: "Tractopelle — entretien 250 h",
      categoryId: cat("TRACTO").id,
      operations: [
        {
          code: "ENT-250",
          name: "Entretien 250 h ou 3 mois",
          mode: "SLIDING",
          preAlertMeter: 25,
          preAlertDays: 15,
          estimatedMinutes: 150,
          triggers: [
            { kind: "METER", every: 250, meterType: "HOURS" },
            { kind: "CALENDAR", every: 3, unit: "MONTH" },
          ],
          checklist: commonChecks,
        },
      ],
    }),
    GROUPE: await createPlan(ctx, {
      name: "Groupe électrogène — entretien",
      categoryId: cat("GROUPE").id,
      operations: [
        {
          code: "ENT-500",
          name: "Entretien 500 h ou 1 an",
          mode: "SLIDING",
          preAlertMeter: 50,
          preAlertDays: 30,
          estimatedMinutes: 120,
          triggers: [
            { kind: "METER", every: 500, meterType: "HOURS" },
            { kind: "CALENDAR", every: 1, unit: "YEAR" },
          ],
          checklist: ["Vidange et filtres", "Contrôle du circuit de refroidissement", "Essai en charge 30 minutes"],
        },
      ],
    }),
  };

  // Dernière réalisation de chaque opération, en jours ; la valeur compteur correspondante est déduite de
  // l'usage moyen (ou donnée explicitement). Situations obtenues : CH-012, CH-015, GE-001 et CA-101 (CT) en
  // pré-alerte, TP-004 échu, PE-007 en retard, CE-020 bloqué par sa VGP échue (PRV-12), PE-002 à 30 h du seuil.
  const lastDone: Record<string, Record<string, number | [number, number]>> = {
    "CH-012": { "ENT-250": 50, "HYD-1000": 160 },
    "CH-020": { "ENT-250": 40, "HYD-1000": 200 },
    "CH-015": { "ENT-250": 45, "HYD-1000": 170 },
    "PE-007": { "ENT-500": 120 },
    "PE-002": { "ENT-500": [85, 6500] },
    "PE-010": { "ENT-500": 60 },
    "CE-031": { "ENT-6M": 150, "VGP-6M": 120 },
    "CE-020": { "ENT-6M": 100, "VGP-6M": 190 },
    "CA-101": { "ENT-30K": 150, "CT-1A": 345 },
    "CA-102": { "ENT-30K": 90, "CT-1A": 200 },
    "TP-004": { "ENT-250": 64 },
    "GE-001": { "ENT-500": 48 },
  };
  const planFor: Record<string, keyof typeof plans> = {
    "CH-012": "CHARGEUSE",
    "CH-020": "CHARGEUSE",
    "CH-015": "CHARGEUSE",
    "PE-007": "PELLE",
    "PE-002": "PELLE",
    "PE-010": "PELLE",
    "CE-031": "CHARIOT",
    "CE-020": "CHARIOT",
    "CA-101": "CAMION",
    "CA-102": "CAMION",
    "TP-004": "TRACTO",
    "GE-001": "GROUPE",
  };
  for (const [code, ops] of Object.entries(lastDone)) {
    const equipmentId = eqIds[code];
    await db.transaction(async (tx) => {
      await applyPlanToEquipment(tx, ctx, equipmentId, plans[planFor[code]].id);
      const items = await tx
        .select({ due: s.dueItems, op: s.planOperations })
        .from(s.dueItems)
        .innerJoin(s.planOperations, eq(s.planOperations.id, s.dueItems.operationId))
        .where(eq(s.dueItems.equipmentId, equipmentId));
      const f = fleet.find((x) => x.code === code)!;
      for (const { due, op } of items) {
        const spec = ops[op.code] ?? 30;
        const [days, explicitMeter] = typeof spec === "number" ? [spec, undefined] : spec;
        const usage = days * f.meter.perDay;
        const derivedMeter = f.meter.type === "KM" ? Math.round(f.meter.current - usage) : Math.round((f.meter.current - usage) * 10) / 10;
        const triggers = await tx.select().from(s.planTriggers).where(eq(s.planTriggers.operationId, op.id));
        const rule: OperationRule = {
          mode: op.mode,
          triggers: triggers.map((t) =>
            t.kind === "CALENDAR"
              ? { kind: "CALENDAR", every: t.every, unit: t.calendarUnit! }
              : { kind: "METER", every: t.every, meterType: t.meterType! },
          ),
        };
        const base = { date: daysAgo(days), meter: due.meterId ? (explicitMeter ?? derivedMeter) : null };
        const next = computeDue(rule, base);
        await tx
          .update(s.dueItems)
          .set({ baseDate: base.date, baseMeterValue: base.meter, dueDate: next.dueDate, dueMeterValue: next.dueMeter })
          .where(eq(s.dueItems.id, due.id));
      }
      await recomputeDueItems(tx, ctx, equipmentId, now);
    });
  }

  /* ---------------------------------------------------------------- */
  /* Historique : six mois d'OT clôturés (préventif et pannes)         */
  /* ---------------------------------------------------------------- */
  type HistoryWo = {
    code: string;
    type: "PREVENTIVE" | "CORRECTIVE";
    title: string;
    daysAgo: number;
    repairHours: number;
    waitingHours?: number;
    laborMinutes: number;
    tech: (typeof techRows)[number];
    parts?: [string, number][];
    external?: { supplier: typeof supEngins; amount: number };
    cause?: string;
  };
  const history: HistoryWo[] = [
    {
      code: "CH-012",
      type: "PREVENTIVE",
      title: "Entretien 250 h ou 3 mois",
      daysAgo: 50,
      repairHours: 4,
      laborMinutes: 190,
      tech: julien,
      parts: [
        ["FLT-HUI-01", 1],
        ["FLT-GAZ-01", 1],
        ["HUI-MOT-15W40", 32],
        ["GRA-EP2", 2],
      ],
    },
    {
      code: "CH-012",
      type: "CORRECTIVE",
      title: "Fuite sur vérin de levage",
      daysAgo: 132,
      repairHours: 9,
      waitingHours: 20,
      laborMinutes: 420,
      tech: nadia,
      parts: [
        ["FLEX-HYD-12", 2],
        ["HUI-HYD-46", 20],
      ],
      cause: "Usure flexible",
    },
    {
      code: "CH-012",
      type: "CORRECTIVE",
      title: "Démarreur défaillant",
      daysAgo: 21,
      repairHours: 5,
      laborMinutes: 240,
      tech: julien,
      parts: [["BAT-12V-180", 1]],
      cause: "Batterie hors service",
    },
    {
      code: "PE-007",
      type: "CORRECTIVE",
      title: "Rupture de flexible du bras",
      daysAgo: 160,
      repairHours: 6,
      laborMinutes: 300,
      tech: nadia,
      parts: [
        ["FLEX-HYD-12", 1],
        ["HUI-HYD-46", 35],
      ],
      cause: "Usure flexible",
    },
    {
      code: "PE-007",
      type: "CORRECTIVE",
      title: "Surchauffe moteur",
      daysAgo: 88,
      repairHours: 14,
      waitingHours: 30,
      laborMinutes: 540,
      tech: julien,
      parts: [
        ["COUR-ALT-01", 1],
        ["LDR-50L", 40],
      ],
      external: { supplier: supEngins, amount: 680 },
      cause: "Radiateur colmaté",
    },
    {
      code: "PE-007",
      type: "CORRECTIVE",
      title: "Fuite hydraulique godet",
      daysAgo: 35,
      repairHours: 7,
      laborMinutes: 360,
      tech: nadia,
      parts: [
        ["FLEX-HYD-12", 1],
        ["HUI-HYD-46", 15],
      ],
      cause: "Usure flexible",
    },
    {
      code: "PE-002",
      type: "PREVENTIVE",
      title: "Entretien 500 h ou 6 mois",
      daysAgo: 85,
      repairHours: 5,
      laborMinutes: 260,
      tech: samir,
      parts: [
        ["FLT-HUI-01", 1],
        ["FLT-HYD-01", 2],
        ["HUI-MOT-15W40", 28],
        ["HUI-HYD-46", 30],
      ],
    },
    {
      code: "PE-002",
      type: "CORRECTIVE",
      title: "Infiltration d'eau tableau de bord",
      daysAgo: 16,
      repairHours: 8,
      waitingHours: 48,
      laborMinutes: 300,
      tech: samir,
      external: { supplier: supEngins, amount: 1240 },
      cause: "Joint de cabine",
    },
    {
      code: "CE-031",
      type: "PREVENTIVE",
      title: "Entretien semestriel",
      daysAgo: 150,
      repairHours: 2.5,
      laborMinutes: 130,
      tech: julien,
      parts: [["GRA-EP2", 1]],
    },
    {
      code: "CA-101",
      type: "PREVENTIVE",
      title: "Entretien 30 000 km ou 1 an",
      daysAgo: 150,
      repairHours: 5,
      laborMinutes: 250,
      tech: samir,
      parts: [
        ["FLT-HUI-01", 1],
        ["HUI-MOT-15W40", 38],
      ],
    },
    {
      code: "CA-101",
      type: "CORRECTIVE",
      title: "Plaquettes de frein usées",
      daysAgo: 64,
      repairHours: 3,
      laborMinutes: 150,
      tech: julien,
      parts: [["PLAQ-FREIN-PL", 2]],
      cause: "Usure normale",
    },
    {
      code: "CA-102",
      type: "CORRECTIVE",
      title: "Voyant de défaut injection",
      daysAgo: 110,
      repairHours: 4,
      waitingHours: 6,
      laborMinutes: 90,
      tech: samir,
      external: { supplier: supPL, amount: 420 },
      cause: "Injecteur",
    },
    {
      code: "TP-004",
      type: "PREVENTIVE",
      title: "Entretien 250 h ou 3 mois",
      daysAgo: 64,
      repairHours: 3.5,
      laborMinutes: 170,
      tech: lucas,
      parts: [
        ["FLT-HUI-01", 1],
        ["HUI-MOT-15W40", 18],
      ],
    },
    {
      code: "TP-004",
      type: "CORRECTIVE",
      title: "Joints de vérin de godet",
      daysAgo: 118,
      repairHours: 6,
      waitingHours: 12,
      laborMinutes: 330,
      tech: lucas,
      parts: [
        ["KIT-JOINT-VER", 1],
        ["HUI-HYD-46", 10],
      ],
      cause: "Joints usés",
    },
    {
      code: "GE-001",
      type: "PREVENTIVE",
      title: "Entretien 500 h ou 1 an",
      daysAgo: 48,
      repairHours: 2,
      laborMinutes: 125,
      tech: lucas,
      parts: [
        ["FLT-HUI-01", 1],
        ["HUI-MOT-15W40", 20],
      ],
    },
    {
      code: "CH-015",
      type: "CORRECTIVE",
      title: "Pneu avant gauche crevé",
      daysAgo: 42,
      repairHours: 4,
      waitingHours: 8,
      laborMinutes: 60,
      tech: lucas,
      external: { supplier: supEngins, amount: 1850 },
      cause: "Crevaison",
    },
    {
      code: "PE-010",
      type: "PREVENTIVE",
      title: "Entretien 500 h ou 6 mois",
      daysAgo: 60,
      repairHours: 5,
      laborMinutes: 280,
      tech: lucas,
      parts: [
        ["FLT-HUI-01", 1],
        ["FLT-HYD-01", 2],
        ["HUI-MOT-15W40", 28],
      ],
    },
    {
      code: "PE-010",
      type: "CORRECTIVE",
      title: "Fuite moteur de translation",
      daysAgo: 140,
      repairHours: 16,
      waitingHours: 72,
      laborMinutes: 600,
      tech: lucas,
      external: { supplier: supHydro, amount: 2950 },
      cause: "Joint moteur de translation",
    },
  ];

  const OPERATION_BY_TITLE: Record<string, string> = {
    "Entretien 250 h ou 3 mois": "ENT-250",
    "Entretien 500 h ou 6 mois": "ENT-500",
    "Entretien semestriel": "ENT-6M",
    "Entretien 30 000 km ou 1 an": "ENT-30K",
    "Entretien 500 h ou 1 an": "ENT-500",
  };
  const LATE_DAYS: Record<string, number> = { "TP-004": 20 };

  const warehouseOf = (code: string) => {
    const f = fleet.find((x) => x.code === code)!;
    return f.site.id === lyo.id ? whLyo.id : f.site.id === mrs.id ? whMrs.id : whGre.id;
  };

  for (const h of history.sort((a, b) => b.daysAgo - a.daysAgo)) {
    const f = fleet.find((x) => x.code === h.code)!;
    const failureStart = new Date(daysAgo(h.daysAgo).getTime() + 7 * 3_600_000);
    const started = new Date(failureStart.getTime() + (h.type === "CORRECTIVE" ? 2 : 0) * 3_600_000);
    const waiting = h.waitingHours ?? 0;
    const workDone = new Date(started.getTime() + (h.repairHours + waiting) * 3_600_000);
    const techClosed = new Date(workDone.getTime() + 3_600_000);
    const number = await nextNumber(db, { tenantId: T, companyId: f.company.id, kind: "OT", date: failureStart });
    const [wo] = await db
      .insert(s.workOrders)
      .values({
        tenantId: T,
        number,
        companyId: f.company.id,
        siteId: f.site.id,
        equipmentId: eqIds[h.code],
        type: h.type,
        status: "CLOSED",
        priority: h.type === "CORRECTIVE" ? "P2" : "P3",
        title: h.title,
        isImmobilizing: true,
        isExternal: !!h.external,
        supplierId: h.external?.supplier.id ?? null,
        externalCost: h.external?.amount ?? null,
        externalCostIsFinal: !!h.external,
        plannedStart: started,
        workshopId: f.site.id === gre.id ? atGre.id : atLyo.id,
        workSummary: h.type === "PREVENTIVE" ? "Opérations de la gamme réalisées, aucune anomalie." : `Remise en état : ${h.title.toLowerCase()}.`,
        causeCode: h.cause ?? null,
        outcome: "RESOLVED",
        startedAt: started,
        workDoneAt: workDone,
        techClosedAt: techClosed,
        closedAt: new Date(techClosed.getTime() + 2 * DAY),
        createdById: ctx.userId,
        createdAt: failureStart,
      })
      .returning();
    const steps: [string | null, string, Date][] = [
      [null, "CREATED", failureStart],
      ["CREATED", "PLANNED", new Date(failureStart.getTime() + 1_800_000)],
      ["PLANNED", "IN_PROGRESS", started],
      ...(waiting
        ? ([
            ["IN_PROGRESS", "ON_HOLD", new Date(started.getTime() + 2 * 3_600_000)],
            ["ON_HOLD", "IN_PROGRESS", new Date(started.getTime() + (2 + waiting) * 3_600_000)],
          ] as [string, string, Date][])
        : []),
      ["IN_PROGRESS", "WORK_DONE", workDone],
      ["WORK_DONE", "TECH_CLOSED", techClosed],
      ["TECH_CLOSED", "CLOSED", new Date(techClosed.getTime() + 2 * DAY)],
    ];
    await db.insert(s.workOrderStatusHistory).values(
      steps.map(([from, to, at]) => ({
        workOrderId: wo.id,
        fromStatus: from as typeof s.workOrders.$inferSelect.status | null,
        toStatus: to as typeof s.workOrders.$inferSelect.status,
        changedById: ctx.userId,
        changedAt: at,
        reason: to === "ON_HOLD" ? "PARTS" : null,
      })),
    );
    await db.insert(s.workOrderAssignees).values({ workOrderId: wo.id, technicianId: h.tech.id });
    await db.insert(s.timeEntries).values({
      tenantId: T,
      workOrderId: wo.id,
      technicianId: h.tech.id,
      startedAt: started,
      endedAt: new Date(started.getTime() + h.laborMinutes * 60_000),
      minutes: h.laborMinutes,
      hourlyRate: rates[techRows.indexOf(h.tech)],
      createdById: ctx.userId,
      createdAt: started,
    });
    for (const [sku, qty] of h.parts ?? []) {
      const p = part(sku);
      await db.insert(s.stockMovements).values({
        tenantId: T,
        partId: p.id,
        warehouseId: warehouseOf(h.code),
        type: "ISSUE",
        quantity: qty,
        unitCost: p.averageCost,
        workOrderId: wo.id,
        createdById: ctx.userId,
        createdAt: new Date(started.getTime() + 3_600_000),
      });
    }
    await db.insert(s.downtimes).values({
      tenantId: T,
      equipmentId: eqIds[h.code],
      workOrderId: wo.id,
      reason: h.type === "CORRECTIVE" ? "BREAKDOWN" : "PLANNED_MAINTENANCE",
      startedAt: failureStart,
      endedAt: techClosed,
    });

    // Échéance préventive soldée par cet OT (historique du respect du préventif, KPI-06) :
    // réalisée quelques jours avant l'échéance, sauf TP-004 réalisé en retard.
    const operationCode = h.type === "PREVENTIVE" ? OPERATION_BY_TITLE[h.title] : undefined;
    if (operationCode) {
      const [current] = await db
        .select({ due: s.dueItems })
        .from(s.dueItems)
        .innerJoin(s.planOperations, eq(s.planOperations.id, s.dueItems.operationId))
        .where(and(eq(s.dueItems.equipmentId, eqIds[h.code]), eq(s.planOperations.code, operationCode)));
      if (current) {
        const dueDate = new Date(techClosed.getTime() + (LATE_DAYS[h.code] ? -LATE_DAYS[h.code] : 3) * DAY);
        const [done] = await db
          .insert(s.dueItems)
          .values({
            tenantId: T,
            equipmentId: eqIds[h.code],
            equipmentPlanId: current.due.equipmentPlanId,
            operationId: current.due.operationId,
            meterId: current.due.meterId,
            baseDate: new Date(dueDate.getTime() - 90 * DAY),
            dueDate,
            projectedDate: dueDate,
            status: "DONE",
            completedAt: techClosed,
            workOrderId: wo.id,
          })
          .returning({ id: s.dueItems.id });
        await db.update(s.workOrders).set({ dueItemId: done.id }).where(eq(s.workOrders.id, wo.id));
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* Situation actuelle : affectations, DI, OT en cours (scénarios)     */
  /* ---------------------------------------------------------------- */
  for (const [code, jobsite, days] of [
    ["CH-012", c15, 60],
    ["PE-007", c15, 45],
    ["PE-002", c22, 30],
    ["TP-004", g03, 80],
    ["GE-001", g03, 120],
    ["CH-015", g03, 40],
    ["CA-101", c15, 10],
  ] as const) {
    await assignEquipment(ctx, eqIds[code], { jobsiteId: jobsite.id, startAt: daysAgo(days) });
  }

  // Préventif : génération des OT des échéances en pré-alerte, échues ou proches (PRV-08)
  await generatePreventiveWorkOrders(ctx, { now });

  // R-01 : l'OT préventif de CH-012 est planifié jeudi avec Julien
  const [prevCh012] = await db
    .select({ id: s.workOrders.id })
    .from(s.workOrders)
    .where(and(eq(s.workOrders.equipmentId, eqIds["CH-012"]), eq(s.workOrders.type, "PREVENTIVE"), eq(s.workOrders.status, "CREATED")));
  if (prevCh012) {
    // Jeudi de cette semaine, ou de la suivante si la démo est initialisée après jeudi
    const thursday = weekDay(3, 7) > now ? weekDay(3, 7) : weekDay(10, 7);
    await updatePlanning(ctx, prevCh012.id, { plannedStart: thursday, estimatedMinutes: 180, assigneeIds: [julien.id], workshopId: atLyo.id });
    await transitionWorkOrder(ctx, prevCh012.id, { to: "PLANNED" });
  }

  // PRV-12 : la VGP échue de CE-020 bloque le chariot ; l'organisme de contrôle passe dans deux jours
  const [vgpCe020] = await db
    .select({ id: s.workOrders.id })
    .from(s.workOrders)
    .where(and(eq(s.workOrders.equipmentId, eqIds["CE-020"]), eq(s.workOrders.type, "REGULATORY"), eq(s.workOrders.status, "CREATED")));
  if (vgpCe020) {
    await updatePlanning(ctx, vgpCe020.id, {
      plannedStart: workday(2, 7),
      estimatedMinutes: 60,
      isExternal: true,
      supplierId: supControle.id,
      priority: "P2",
    });
    await setExternalCost(ctx, vgpCe020.id, { supplierId: supControle.id, externalCost: 180, externalCostIsFinal: false });
    await transitionWorkOrder(ctx, vgpCe020.id, { to: "PLANNED" });
  }

  // R-02 : panne urgente signalée par le conducteur sur PE-007 (criticité A) — DI à qualifier
  const operatorCtx = buildAuthContext(
    { id: users["conducteur@demo.gmao"], tenantId: T, name: "Paul Girard", email: "conducteur@demo.gmao" },
    [{ role: "OPERATOR", scopeType: "SITE", scopeId: lyo.id }],
    { channel: "MOBILE" },
  );
  await createWorkRequest(operatorCtx, {
    equipmentId: eqIds["PE-007"],
    symptom: "Fuite hydraulique importante sur le bras",
    description: "Flaque d'huile sous la machine, le bras descend tout seul. Machine arrêtée.",
    isStopped: true,
    meterValue: 5942,
    latitude: 45.771,
    longitude: 4.882,
  });
  await createWorkRequest(ctx, {
    equipmentId: eqIds["CA-102"],
    symptom: "Voyant moteur orange allumé",
    description: "Pas de perte de puissance constatée.",
    isStopped: false,
  });

  // R-03 : rupture de pièce — CE-031 immobilisé, pompe hydraulique absente à Lyon (1 en stock à Marseille)
  const woCe031 = await createWorkOrder(ctx, {
    equipmentId: eqIds["CE-031"],
    type: "CORRECTIVE",
    priority: "P2",
    title: "Pompe hydraulique défaillante — levée impossible",
    description: "Bruit anormal puis perte de pression. Diagnostic : pompe hydraulique HS.",
    isImmobilizing: true,
    workshopId: atLyo.id,
    plannedStart: workday(-1),
    estimatedMinutes: 240,
    assigneeIds: [julien.id],
  });
  await transitionWorkOrder(ctx, woCe031.id, { to: "PLANNED" });
  await transitionWorkOrder(ctx, woCe031.id, { to: "IN_PROGRESS" });
  await recordTime(ctx, woCe031.id, { action: "manual", technicianId: julien.id, minutes: 75, comment: "Diagnostic et dépose de la pompe" });
  await transitionWorkOrder(ctx, woCe031.id, { to: "ON_HOLD", holdReason: "PARTS", reason: "Pompe 67110-26600-71 non disponible à Lyon" });

  // TP-004 : réparation terminée, en attente de clôture technique par le chef d'atelier
  const woTp004 = await createWorkOrder(ctx, {
    equipmentId: eqIds["TP-004"],
    type: "CORRECTIVE",
    priority: "P3",
    title: "Remplacement flexible de godet",
    isImmobilizing: false,
    workshopId: atGre.id,
    plannedStart: workday(-1),
    estimatedMinutes: 90,
    assigneeIds: [lucas.id],
  });
  await transitionWorkOrder(ctx, woTp004.id, { to: "PLANNED" });
  await transitionWorkOrder(ctx, woTp004.id, { to: "IN_PROGRESS" });
  await recordTime(ctx, woTp004.id, { action: "manual", technicianId: lucas.id, minutes: 95 });
  const [tpTask] = await db
    .insert(s.workOrderTasks)
    .values({ workOrderId: woTp004.id, position: 1, label: "Remplacer le flexible et purger le circuit", required: true })
    .returning();
  await updateTask(ctx, woTp004.id, tpTask.id, { result: "OK" });
  await updateReport(ctx, woTp004.id, { workSummary: "Flexible remplacé, essai de levage conforme.", causeCode: "Usure flexible" });
  await recordReading(ctx, meterIds["TP-004"], { value: 7613, workOrderId: woTp004.id, source: "WORK_ORDER" });
  await transitionWorkOrder(ctx, woTp004.id, { to: "WORK_DONE" });

  // PE-010 : panne qualifiée et immobilisante, transformée en OT planifié demain avec Lucas
  const chefGreCtx = buildAuthContext({ id: users["chef.grenoble@demo.gmao"], tenantId: T, name: "Yanis Ferhat", email: "chef.grenoble@demo.gmao" }, [
    { role: "WORKSHOP_MANAGER", scopeType: "SITE", scopeId: gre.id },
  ]);
  const { request: diPe010 } = await createWorkRequest(ctx, {
    equipmentId: eqIds["PE-010"],
    symptom: "Perte de puissance de translation",
    isStopped: true,
    reportedAt: daysAgo(1),
  });
  await qualifyWorkRequest(chefGreCtx, diPe010.id, { priority: "P2", type: "BREAKDOWN", immobilize: true });
  const woPe010 = await convertToWorkOrder(chefGreCtx, diPe010.id);
  await updatePlanning(chefGreCtx, woPe010.id, { plannedStart: workday(1), estimatedMinutes: 360, assigneeIds: [lucas.id], workshopId: atGre.id });
  await transitionWorkOrder(chefGreCtx, woPe010.id, { to: "PLANNED" });

  // Stock : niveaux recalculés à partir des mouvements (règle : le stock est la somme des mouvements)
  await db.execute(sql`
    update stock_levels sl set on_hand = coalesce((
      select sum(case when m.type in ('RECEIPT','RETURN','TRANSFER_IN') then m.quantity
                      when m.type = 'ADJUSTMENT' then m.quantity
                      else -m.quantity end)
      from stock_movements m where m.part_id = sl.part_id and m.warehouse_id = sl.warehouse_id), 0)
  `);

  // Recalcul final des échéances
  for (const id of Object.values(eqIds)) await db.transaction((tx) => recomputeDueItems(tx, ctx, id, now));

  console.log(`Données de démonstration créées. Comptes : ${seats.map((x) => x.email).join(", ")}`);
  console.log(`Mot de passe commun : ${DEMO_PASSWORD}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
