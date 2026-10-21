import type { Permission } from "@/server/authz/permissions";

export type NavIcon =
  | "dashboard"
  | "equipment"
  | "fuel"
  | "requests"
  | "workorders"
  | "preventive"
  | "planning"
  | "stock"
  | "purchasing"
  | "kpi"
  | "imports"
  | "approvals"
  | "purchaseRequests"
  | "admin";

export type NavItem = { href: string; label: string; icon: NavIcon; permission?: Permission; anyOf?: Permission[] };

/** Menu principal ; chaque entrée n'est affichée que si l'utilisateur détient le droit requis. */
export const NAV_ITEMS: NavItem[] = [
  // Membres d'une organisation ; l'administrateur de la plateforme ne voit que l'administration.
  { href: "/", label: "Tableau de bord", icon: "dashboard", permission: "equipment.read" },
  { href: "/equipements", label: "Équipements", icon: "equipment", permission: "equipment.read" },
  { href: "/carburant", label: "Carburant", icon: "fuel", permission: "fuel.read" },
  { href: "/demandes", label: "Demandes d'intervention", icon: "requests", permission: "request.read" },
  { href: "/interventions", label: "Interventions à réaliser", icon: "workorders", permission: "workorder.read" },
  { href: "/preventif", label: "Préventif", icon: "preventive", permission: "plan.read" },
  { href: "/planning", label: "Planning", icon: "planning", permission: "planning.read" },
  { href: "/stock", label: "Pièces et stocks", icon: "stock", permission: "part.read" },
  { href: "/demandes-achat", label: "Demandes d'achat", icon: "purchaseRequests", permission: "purchase.read" },
  { href: "/achats", label: "Fournisseurs", icon: "purchasing", permission: "supplier.read" },
  { href: "/indicateurs", label: "Indicateurs", icon: "kpi", permission: "kpi.read" },
  // HAB-04 : tout utilisateur peut être valideur (rôle dans un circuit, personne nommée ou suppléant).
  { href: "/validations", label: "Validations", icon: "approvals", permission: "equipment.read" },
  { href: "/imports", label: "Imports", icon: "imports", anyOf: ["equipment.write", "part.write", "stock.move", "fuel.manage"] },
  { href: "/administration", label: "Administration", icon: "admin", anyOf: ["settings.manage", "users.manage", "audit.read", "platform.manage"] },
];
