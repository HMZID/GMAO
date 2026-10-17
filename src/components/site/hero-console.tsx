/**
 * Illustration de l'accroche : un tableau de parc tel que l'atelier le voit (données fictives), construit en
 * HTML et CSS pour rester net à toutes les tailles et léger à charger.
 */

const ROWS = [
  { code: "PL-021", name: "Pelle 22 t", meter: "8 412 h", status: "Dispo", tone: "ok", next: "Vidange 500 h", left: "dans 42 h", fill: 0.92 },
  {
    code: "CH-012",
    name: "Chargeuse sur pneus",
    meter: "5 190 h",
    status: "Atelier",
    tone: "warn",
    next: "Freins (OT en cours)",
    left: "J+1",
    fill: 0.6,
  },
  {
    code: "TP-004",
    name: "Tombereau articulé",
    meter: "11 067 h",
    status: "Immobilisé",
    tone: "stop",
    next: "Boîte de vitesses",
    left: "pièce en commande",
    fill: 0.25,
  },
  {
    code: "PL-090",
    name: "Porteur 8×4",
    meter: "184 220 km",
    status: "Dispo",
    tone: "ok",
    next: "Contrôle technique",
    left: "dans 18 j",
    fill: 0.78,
  },
] as const;

const TONES = {
  ok: "bg-ok/15 text-ok ring-ok/40",
  warn: "bg-signal/15 text-signal ring-signal/40",
  stop: "bg-rust/15 text-rust ring-rust/40",
} as const;

export function HeroConsole() {
  return (
    <div className="relative" aria-hidden>
      <div className="border-2 border-white/15 bg-asphalt-800 shadow-[10px_10px_0_var(--color-signal)]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <p className="site-label text-[11px] text-white/60">Parc · Site de Lyon</p>
          <p className="site-label flex items-center gap-2 text-[11px] text-ok">
            <span className="animate-site-blink motion-safe-only inline-block h-2 w-2 rounded-full bg-ok" />
            En direct
          </p>
        </div>
        <ul className="divide-y divide-white/10">
          {ROWS.map((r, i) => (
            <li key={r.code} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5">
              <span className="font-plate text-sm font-bold text-signal">{r.code}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-white">{r.name}</span>
                <span className="font-plate block text-xs text-white/50">{r.meter}</span>
              </span>
              <span className={`site-label rounded-sm px-2 py-1 text-[10px] ring-1 ${TONES[r.tone]}`}>{r.status}</span>
              <span className="col-span-3 flex items-center gap-3">
                <span className="h-1.5 flex-1 overflow-hidden bg-white/10">
                  <span
                    className={`animate-site-fill motion-safe-only block h-full origin-left ${r.tone === "stop" ? "bg-rust" : r.tone === "warn" ? "bg-signal" : "bg-ok"}`}
                    style={{ width: `${r.fill * 100}%`, animationDelay: `${0.2 + i * 0.15}s` }}
                  />
                </span>
                <span className="w-44 shrink-0 truncate text-right text-[11px] text-white/60 sm:w-52">
                  {r.next} · <span className="text-white/90">{r.left}</span>
                </span>
              </span>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-3 border-t border-white/10 text-center">
          {[
            ["Disponibilité", "94,2 %"],
            ["OT ouverts", "7"],
            ["Préventifs échus", "0"],
          ].map(([label, value]) => (
            <div key={label} className="border-r border-white/10 px-2 py-3 last:border-r-0">
              <p className="site-display text-2xl text-white">{value}</p>
              <p className="site-label mt-1 text-[9px] text-white/50">{label}</p>
            </div>
          ))}
        </div>
      </div>
      {/* Bon de travail clôturé, posé de travers sur le tableau. */}
      <div className="absolute -bottom-10 -left-6 hidden w-56 rotate-[-4deg] border-2 border-asphalt bg-paper p-3 text-asphalt shadow-[6px_6px_0_var(--color-asphalt)] sm:block">
        <p className="site-label text-[10px] text-asphalt-500">Ordre de travail</p>
        <p className="font-plate text-sm font-bold">OT-2026-0142</p>
        <p className="mt-1 text-xs">Remplacement flexible hydraulique · PL-021</p>
        <p className="site-label mt-2 inline-block bg-ok px-1.5 py-0.5 text-[10px] text-white">Clôturé · 2 h 40</p>
      </div>
    </div>
  );
}
