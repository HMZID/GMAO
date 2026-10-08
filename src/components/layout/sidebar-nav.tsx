"use client";

import {
  BarChart3,
  Boxes,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  FileSpreadsheet,
  ClipboardList,
  LayoutDashboard,
  ReceiptText,
  Settings,
  ShoppingCart,
  Siren,
  Truck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavIcon, NavItem } from "./nav-items";

const ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  equipment: Truck,
  requests: Siren,
  workorders: ClipboardList,
  preventive: CalendarClock,
  planning: CalendarDays,
  stock: Boxes,
  purchasing: ShoppingCart,
  kpi: BarChart3,
  imports: FileSpreadsheet,
  approvals: ClipboardCheck,
  purchaseRequests: ReceiptText,
  admin: Settings,
};

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ items, variant = "sidebar" }: { items: Pick<NavItem, "href" | "label" | "icon">[]; variant?: "sidebar" | "mobile" }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale" className={cn(variant === "sidebar" ? "flex-1 space-y-0.5 px-3 py-4" : "grid gap-1 p-2")}>
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              variant === "sidebar"
                ? active
                  ? "bg-white/10 text-white"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
                : active
                  ? "bg-brand-50 text-brand-800"
                  : "text-slate-700 hover:bg-slate-100",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
