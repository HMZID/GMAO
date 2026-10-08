import { relations } from "drizzle-orm";
import { roleAssignments, user } from "./auth";
import { assignments, equipment, equipmentCategories, equipmentModels, equipmentStatusHistory, meterReadings, meters } from "./equipment";
import {
  dueItems,
  downtimes,
  equipmentPlans,
  maintenancePlans,
  planOperations,
  planTriggers,
  taskListItems,
  taskListParts,
  taskLists,
  timeEntries,
  workOrderAssignees,
  workOrderCosts,
  workOrderStatusHistory,
  workOrderTasks,
  workOrders,
  workRequests,
} from "./maintenance";
import { companies, jobsites, sites, warehouses, workshops } from "./organization";
import { certifications, laborRates, technicians } from "./resources";
import { parts, stockLevels, suppliers } from "./stock";
import { stockMovements, stockReservations } from "./stock-movements";

/** Relations pour l'API de requêtes relationnelles de Drizzle (`db.query.*`). */

export const userRelations = relations(user, ({ many }) => ({
  roleAssignments: many(roleAssignments),
}));

export const roleAssignmentRelations = relations(roleAssignments, ({ one }) => ({
  user: one(user, { fields: [roleAssignments.userId], references: [user.id] }),
}));

export const companyRelations = relations(companies, ({ many }) => ({
  sites: many(sites),
  jobsites: many(jobsites),
}));

export const siteRelations = relations(sites, ({ one, many }) => ({
  company: one(companies, { fields: [sites.companyId], references: [companies.id] }),
  workshops: many(workshops),
  warehouses: many(warehouses),
}));

export const workshopRelations = relations(workshops, ({ one }) => ({
  site: one(sites, { fields: [workshops.siteId], references: [sites.id] }),
}));

export const warehouseRelations = relations(warehouses, ({ one, many }) => ({
  site: one(sites, { fields: [warehouses.siteId], references: [sites.id] }),
  stockLevels: many(stockLevels),
}));

export const jobsiteRelations = relations(jobsites, ({ one }) => ({
  company: one(companies, { fields: [jobsites.companyId], references: [companies.id] }),
}));

export const categoryRelations = relations(equipmentCategories, ({ many }) => ({
  models: many(equipmentModels),
  equipment: many(equipment),
}));

export const modelRelations = relations(equipmentModels, ({ one }) => ({
  category: one(equipmentCategories, { fields: [equipmentModels.categoryId], references: [equipmentCategories.id] }),
}));

export const equipmentRelations = relations(equipment, ({ one, many }) => ({
  company: one(companies, { fields: [equipment.companyId], references: [companies.id] }),
  site: one(sites, { fields: [equipment.siteId], references: [sites.id] }),
  category: one(equipmentCategories, { fields: [equipment.categoryId], references: [equipmentCategories.id] }),
  model: one(equipmentModels, { fields: [equipment.modelId], references: [equipmentModels.id] }),
  meters: many(meters),
  assignments: many(assignments),
  statusHistory: many(equipmentStatusHistory),
  workOrders: many(workOrders),
  dueItems: many(dueItems),
  equipmentPlans: many(equipmentPlans),
  downtimes: many(downtimes),
}));

export const statusHistoryRelations = relations(equipmentStatusHistory, ({ one }) => ({
  equipment: one(equipment, { fields: [equipmentStatusHistory.equipmentId], references: [equipment.id] }),
  changedBy: one(user, { fields: [equipmentStatusHistory.changedById], references: [user.id] }),
}));

export const assignmentRelations = relations(assignments, ({ one }) => ({
  equipment: one(equipment, { fields: [assignments.equipmentId], references: [equipment.id] }),
  site: one(sites, { fields: [assignments.siteId], references: [sites.id] }),
  jobsite: one(jobsites, { fields: [assignments.jobsiteId], references: [jobsites.id] }),
  workshop: one(workshops, { fields: [assignments.workshopId], references: [workshops.id] }),
}));

export const meterRelations = relations(meters, ({ one, many }) => ({
  equipment: one(equipment, { fields: [meters.equipmentId], references: [equipment.id] }),
  readings: many(meterReadings),
}));

export const meterReadingRelations = relations(meterReadings, ({ one }) => ({
  meter: one(meters, { fields: [meterReadings.meterId], references: [meters.id] }),
  createdBy: one(user, { fields: [meterReadings.createdById], references: [user.id] }),
}));

export const taskListRelations = relations(taskLists, ({ many }) => ({
  items: many(taskListItems),
  parts: many(taskListParts),
}));

export const taskListItemRelations = relations(taskListItems, ({ one }) => ({
  taskList: one(taskLists, { fields: [taskListItems.taskListId], references: [taskLists.id] }),
}));

export const taskListPartRelations = relations(taskListParts, ({ one }) => ({
  taskList: one(taskLists, { fields: [taskListParts.taskListId], references: [taskLists.id] }),
  part: one(parts, { fields: [taskListParts.partId], references: [parts.id] }),
}));

export const planRelations = relations(maintenancePlans, ({ one, many }) => ({
  category: one(equipmentCategories, { fields: [maintenancePlans.categoryId], references: [equipmentCategories.id] }),
  model: one(equipmentModels, { fields: [maintenancePlans.modelId], references: [equipmentModels.id] }),
  operations: many(planOperations),
  equipmentPlans: many(equipmentPlans),
}));

export const operationRelations = relations(planOperations, ({ one, many }) => ({
  plan: one(maintenancePlans, { fields: [planOperations.planId], references: [maintenancePlans.id] }),
  taskList: one(taskLists, { fields: [planOperations.taskListId], references: [taskLists.id] }),
  triggers: many(planTriggers),
}));

export const triggerRelations = relations(planTriggers, ({ one }) => ({
  operation: one(planOperations, { fields: [planTriggers.operationId], references: [planOperations.id] }),
}));

export const equipmentPlanRelations = relations(equipmentPlans, ({ one, many }) => ({
  equipment: one(equipment, { fields: [equipmentPlans.equipmentId], references: [equipment.id] }),
  plan: one(maintenancePlans, { fields: [equipmentPlans.planId], references: [maintenancePlans.id] }),
  dueItems: many(dueItems),
}));

export const dueItemRelations = relations(dueItems, ({ one }) => ({
  equipment: one(equipment, { fields: [dueItems.equipmentId], references: [equipment.id] }),
  equipmentPlan: one(equipmentPlans, { fields: [dueItems.equipmentPlanId], references: [equipmentPlans.id] }),
  operation: one(planOperations, { fields: [dueItems.operationId], references: [planOperations.id] }),
  meter: one(meters, { fields: [dueItems.meterId], references: [meters.id] }),
}));

export const workRequestRelations = relations(workRequests, ({ one }) => ({
  equipment: one(equipment, { fields: [workRequests.equipmentId], references: [equipment.id] }),
  site: one(sites, { fields: [workRequests.siteId], references: [sites.id] }),
  company: one(companies, { fields: [workRequests.companyId], references: [companies.id] }),
  reportedBy: one(user, { fields: [workRequests.reportedById], references: [user.id] }),
}));

export const workOrderRelations = relations(workOrders, ({ one, many }) => ({
  equipment: one(equipment, { fields: [workOrders.equipmentId], references: [equipment.id] }),
  company: one(companies, { fields: [workOrders.companyId], references: [companies.id] }),
  site: one(sites, { fields: [workOrders.siteId], references: [sites.id] }),
  workshop: one(workshops, { fields: [workOrders.workshopId], references: [workshops.id] }),
  jobsite: one(jobsites, { fields: [workOrders.jobsiteId], references: [jobsites.id] }),
  supplier: one(suppliers, { fields: [workOrders.supplierId], references: [suppliers.id] }),
  dueItem: one(dueItems, { fields: [workOrders.dueItemId], references: [dueItems.id] }),
  releaseValidatedBy: one(user, { fields: [workOrders.releaseValidatedById], references: [user.id] }),
  assignees: many(workOrderAssignees),
  tasks: many(workOrderTasks),
  timeEntries: many(timeEntries),
  statusHistory: many(workOrderStatusHistory),
  costs: many(workOrderCosts),
  stockMovements: many(stockMovements),
  reservations: many(stockReservations),
}));

export const workOrderAssigneeRelations = relations(workOrderAssignees, ({ one }) => ({
  workOrder: one(workOrders, { fields: [workOrderAssignees.workOrderId], references: [workOrders.id] }),
  technician: one(technicians, { fields: [workOrderAssignees.technicianId], references: [technicians.id] }),
}));

export const workOrderTaskRelations = relations(workOrderTasks, ({ one }) => ({
  workOrder: one(workOrders, { fields: [workOrderTasks.workOrderId], references: [workOrders.id] }),
}));

export const workOrderStatusHistoryRelations = relations(workOrderStatusHistory, ({ one }) => ({
  workOrder: one(workOrders, { fields: [workOrderStatusHistory.workOrderId], references: [workOrders.id] }),
  changedBy: one(user, { fields: [workOrderStatusHistory.changedById], references: [user.id] }),
}));

export const workOrderCostRelations = relations(workOrderCosts, ({ one }) => ({
  workOrder: one(workOrders, { fields: [workOrderCosts.workOrderId], references: [workOrders.id] }),
}));

export const timeEntryRelations = relations(timeEntries, ({ one }) => ({
  workOrder: one(workOrders, { fields: [timeEntries.workOrderId], references: [workOrders.id] }),
  technician: one(technicians, { fields: [timeEntries.technicianId], references: [technicians.id] }),
}));

export const downtimeRelations = relations(downtimes, ({ one }) => ({
  equipment: one(equipment, { fields: [downtimes.equipmentId], references: [equipment.id] }),
  workOrder: one(workOrders, { fields: [downtimes.workOrderId], references: [workOrders.id] }),
}));

export const technicianRelations = relations(technicians, ({ one, many }) => ({
  user: one(user, { fields: [technicians.userId], references: [user.id] }),
  site: one(sites, { fields: [technicians.siteId], references: [sites.id] }),
  laborRates: many(laborRates),
  certifications: many(certifications),
}));

export const laborRateRelations = relations(laborRates, ({ one }) => ({
  technician: one(technicians, { fields: [laborRates.technicianId], references: [technicians.id] }),
}));

export const certificationRelations = relations(certifications, ({ one }) => ({
  technician: one(technicians, { fields: [certifications.technicianId], references: [technicians.id] }),
}));

export const partRelations = relations(parts, ({ many }) => ({
  stockLevels: many(stockLevels),
  movements: many(stockMovements),
}));

export const stockLevelRelations = relations(stockLevels, ({ one }) => ({
  part: one(parts, { fields: [stockLevels.partId], references: [parts.id] }),
  warehouse: one(warehouses, { fields: [stockLevels.warehouseId], references: [warehouses.id] }),
}));

export const stockMovementRelations = relations(stockMovements, ({ one }) => ({
  part: one(parts, { fields: [stockMovements.partId], references: [parts.id] }),
  warehouse: one(warehouses, { fields: [stockMovements.warehouseId], references: [warehouses.id] }),
  workOrder: one(workOrders, { fields: [stockMovements.workOrderId], references: [workOrders.id] }),
  createdBy: one(user, { fields: [stockMovements.createdById], references: [user.id] }),
}));

export const stockReservationRelations = relations(stockReservations, ({ one }) => ({
  part: one(parts, { fields: [stockReservations.partId], references: [parts.id] }),
  warehouse: one(warehouses, { fields: [stockReservations.warehouseId], references: [warehouses.id] }),
  workOrder: one(workOrders, { fields: [stockReservations.workOrderId], references: [workOrders.id] }),
}));
