"use client";

import { Clock, UserX } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { T, Tr } from "@/i18n/client";

export type DayViewOrder = { id: string; time: string; equipmentCode: string; title: string; duration: string; priority: string; status: string };
export type DayViewRow = {
  id: string;
  name: string;
  siteName: string;
  load: number | null;
  loadLabel: string;
  hoursLabel: string;
  absences: Record<string, string>;
  orders: Record<string, DayViewOrder[]>;
};
export type DayViewDay = { key: string; weekday: string; day: string; weekend: boolean };

/**
 * Planning des téléphones et tablettes : un jour à la fois (sélecteur des 7 jours), un bloc par technicien
 * avec ses interventions du jour, son absence éventuelle et sa charge de la semaine. Remplace la grille
 * semaine × techniciens, illisible sur petit écran.
 */
export function PlanningDayView({ days, rows, initialDay }: { days: DayViewDay[]; rows: DayViewRow[]; initialDay: string }) {
  const [selected, setSelected] = useState(initialDay);
  const count = (key: string) => rows.reduce((s, r) => s + (r.orders[key]?.length ?? 0), 0);
  const current = days.find((d) => d.key === selected) ?? days[0];

  return (
    <div>
      <div role="tablist" aria-label="Jour affiché" className="grid grid-cols-7 gap-1 border-b border-slate-200 px-2 py-2">
        {days.map((d) => {
          const active = d.key === selected;
          const n = count(d.key);
          return (
            <button
              key={d.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelected(d.key)}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center rounded-lg text-xs",
                active ? "bg-brand-600 text-white" : d.weekend ? "text-slate-400 hover:bg-slate-100" : "text-slate-700 hover:bg-slate-100",
              )}
            >
              <span className="font-medium uppercase">
                <Tr>{d.weekday}</Tr>
              </span>
              <span className="text-base font-semibold">
                <Tr>{d.day}</Tr>
              </span>
              <span
                className={cn(
                  "mt-0.5 h-4 min-w-4 rounded-full px-1 text-[10px] leading-4",
                  n > 0 ? (active ? "bg-white/25" : "bg-brand-100 text-brand-800") : "invisible",
                )}
              >
                <Tr>{n}</Tr>
              </span>
            </button>
          );
        })}
      </div>

      <p className="px-4 pt-3 text-sm text-slate-600">
        <T params={{ weekday: current.weekday, day: current.day, v: count(current.key) }}>{"{weekday} {day} · {v} intervention(s) planifiée(s)"}</T>
      </p>

      <ul className="grid gap-3 p-3 md:grid-cols-2">
        {rows.map((r) => {
          const orders = r.orders[selected] ?? [];
          const absence = r.absences[selected];
          const load = r.load ?? 0;
          return (
            <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">
                    <Tr>{r.name}</Tr>
                  </p>
                  <p className="text-xs text-slate-500">
                    <Tr>{r.siteName}</Tr>
                  </p>
                </div>
                <div className="w-28 shrink-0 text-end">
                  <p
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      load > 1 ? "text-red-700" : load > 0.85 ? "text-amber-700" : "text-slate-900",
                    )}
                  >
                    <Tr>{r.loadLabel}</Tr>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    <T>charge de la semaine</T>
                  </p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                    <div
                      className={cn("h-full rounded-full", load > 1 ? "bg-red-500" : load > 0.85 ? "bg-amber-500" : "bg-brand-600")}
                      style={{ width: `${Math.min(load, 1) * 100}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    <Tr>{r.hoursLabel}</Tr>
                  </p>
                </div>
              </div>
              {absence ? (
                <p className="mt-3 flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
                  <UserX className="h-4 w-4 shrink-0" aria-hidden />
                  <Tr>{absence}</Tr>
                </p>
              ) : null}
              {orders.length === 0 && !absence ? (
                <p className="mt-3 text-sm text-slate-500">
                  <T>Aucune intervention ce jour.</T>
                </p>
              ) : null}
              {orders.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {orders.map((o) => (
                    <li key={o.id}>
                      <Link
                        href={`/interventions/${o.id}`}
                        className={cn(
                          "block rounded-lg border-s-4 bg-slate-50 px-3 py-2.5 hover:bg-slate-100",
                          o.priority === "P1" ? "border-s-red-500" : o.status === "IN_PROGRESS" ? "border-s-violet-500" : "border-s-sky-500",
                        )}
                      >
                        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <Clock className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                          <Tr>{o.time}</Tr>
                          <span className="font-medium text-slate-700">
                            · <Tr>{o.equipmentCode}</Tr>
                          </span>
                          <span className="ms-auto text-xs font-normal text-slate-500">
                            <Tr>{o.duration}</Tr>
                          </span>
                        </span>
                        <span className="mt-0.5 block text-sm text-slate-700">
                          <Tr>{o.title}</Tr>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
