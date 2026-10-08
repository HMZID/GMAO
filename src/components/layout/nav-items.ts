import type { Permission } from "@/server/authz/permissions";

export type NavIcon = "dashboard" | "equipment" | "requests" | "workorders" | "preventive" | "planning" | "stock" | "purchasing" | "kpi" | "admin";

export type NavItem = { href: string; label: string; icon: NavIcon; permission?: Permission; anyOf?: Permission[] };

/** Menu principal ; chaque entrée n'est affichée que si l'utilisateur détient le droit requis. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Tableau de bord", icon: "dashboard" },
  { href: "/equipements", label: "Équipements", icon: "equipment", permission: "equipment.read" },
  { href: "/demandes", label: "Demandes d'intervention", icon: "requests", permission: "request.read" },
  { href: "/ordres-de-travail", label: "Ordres de travail", icon: "workorders", permission: "workorder.read" },
  { href: "/preventif", label: "Préventif", icon: "preventive", permission: "plan.read" },
  { href: "/planning", label: "Planning", icon: "planning", permission: "planning.read" },
  { href: "/stock", label: "Pièces et stocks", icon: "stock", permission: "part.read" },
  { href: "/achats", label: "Fournisseurs", icon: "purchasing", permission: "supplier.read" },
  { href: "/indicateurs", label: "Indicateurs", icon: "kpi", permission: "kpi.read" },
  { href: "/administration", label: "Administration", icon: "admin", anyOf: ["settings.manage", "users.manage", "audit.read"] },
];
