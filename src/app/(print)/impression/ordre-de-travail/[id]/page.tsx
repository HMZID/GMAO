import Link from "next/link";
import type { ReactNode } from "react";
import { PrintButton } from "@/components/print/print-button";
import { buttonClass } from "@/components/ui/button";
import { formatCurrency, formatDate, formatDateTime, formatMinutes, formatNumber } from "@/lib/format";
import { MOVEMENT_TYPE, PRIORITY, TASK_RESULT, WORK_ORDER_OUTCOME, WORK_ORDER_STATUS, WORK_ORDER_TYPE } from "@/lib/labels";
import { getAuthContext } from "@/server/auth/session";
import { loadOr404 } from "@/server/pages";
import { getBranding, logoUrl } from "@/server/services/branding";
import { getWorkOrder } from "@/server/services/work-orders";

export const metadata = { title: "Fiche d'intervention" };

/**
 * Fiche d'intervention imprimable (A4) : identification, travaux, temps, pièces, compte rendu et
 * cadres de signature (intervenant, prestataire, responsable). Avec ?couts=1, la synthèse des coûts est jointe.
 */
export default async function WorkOrderPrintPage(props: PageProps<"/impression/ordre-de-travail/[id]">) {
  const [{ id }, query] = await Promise.all([props.params, props.searchParams]);
  const ctx = await getAuthContext();
  const [wo, branding] = await Promise.all([loadOr404(id, (x) => getWorkOrder(ctx, x)), getBranding(ctx)]);
  const withCosts = query.couts === "1";
  const logo = logoUrl(branding);
  const printedAt = new Date();
  const totalMinutes = wo.timeEntries.reduce((sum, t) => sum + (t.minutes ?? 0), 0);
  const consumed = wo.partLines.filter((p) => p.type === "ISSUE" || p.type === "RETURN");
  const meterUnit = wo.meters[0]?.unit ?? "";
  const technicians = wo.assignees.map((a) => `${a.technician.firstName} ${a.technician.lastName}`);

  return (
    <>
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-2 px-4 print:hidden">
        <Link href={`/ordres-de-travail/${wo.id}`} className={buttonClass("ghost")}>
          ← Retour à l&apos;intervention
        </Link>
        <div className="flex flex-wrap gap-2">
          <Link href={withCosts ? `?` : `?couts=1`} className={buttonClass("secondary")} replace>
            {withCosts ? "Masquer les coûts" : "Afficher les coûts"}
          </Link>
          <PrintButton />
        </div>
      </div>

      <article className="mx-auto max-w-[210mm] bg-white p-[12mm] text-[12px] leading-snug text-slate-900 shadow-lg print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-3">
          <div className="flex items-center gap-3">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- image servie par l'API, après contrôle de session
              <img src={logo} alt="" className="h-14 w-14 object-contain" />
            ) : null}
            <div>
              <p className="text-base font-semibold">{branding.label}</p>
              <p className="text-slate-600">{wo.site.name}</p>
            </div>
          </div>
          <div className="text-right">
            <h1 className="text-lg font-bold uppercase tracking-wide">Fiche d&apos;intervention</h1>
            <p className="font-mono text-base font-semibold">{wo.number}</p>
            <p className="text-slate-600">Éditée le {formatDateTime(printedAt)}</p>
          </div>
        </header>

        <Section title="Intervention">
          <Grid>
            <Item label="Intitulé" wide>
              {wo.title}
            </Item>
            <Item label="Type">{WORK_ORDER_TYPE[wo.type] ?? wo.type}</Item>
            <Item label="Priorité">{PRIORITY[wo.priority]?.label ?? wo.priority}</Item>
            <Item label="Statut">{WORK_ORDER_STATUS[wo.status]?.label ?? wo.status}</Item>
            <Item label="Immobilisant">{wo.isImmobilizing ? "Oui" : "Non"}</Item>
            <Item label="Lieu">{wo.jobsite?.name ?? wo.workshop?.name ?? wo.site.name}</Item>
            <Item label="Prestataire">{wo.isExternal ? (wo.supplier?.name ?? "À désigner") : "Interne"}</Item>
          </Grid>
          {wo.description ? <p className="mt-2 whitespace-pre-line">{wo.description}</p> : null}
          {wo.requests.length > 0 ? (
            <p className="mt-2 text-slate-600">Demande(s) d&apos;origine : {wo.requests.map((r) => `${r.number} — ${r.symptom}`).join(" ; ")}</p>
          ) : null}
        </Section>

        <Section title="Équipement">
          <Grid>
            <Item label="Code parc">{wo.equipment.code}</Item>
            <Item label="Désignation" wide>
              {wo.equipment.name}
            </Item>
            <Item label="Marque">{wo.equipment.manufacturer}</Item>
            <Item label="Compteur à la clôture">{wo.meterValueAtClose != null ? `${formatNumber(wo.meterValueAtClose)} ${meterUnit}` : "—"}</Item>
          </Grid>
        </Section>

        <Section title="Déroulement">
          <Grid>
            <Item label="Début prévu">{formatDateTime(wo.plannedStart)}</Item>
            <Item label="Fin prévue">{formatDateTime(wo.plannedEnd)}</Item>
            <Item label="Démarré le">{formatDateTime(wo.startedAt)}</Item>
            <Item label="Travaux terminés le">{formatDateTime(wo.workDoneAt)}</Item>
            <Item label="Intervenants" wide>
              {technicians.length > 0 ? technicians.join(", ") : "—"}
            </Item>
          </Grid>
          {wo.timeEntries.length > 0 ? (
            <PrintTable
              head={["Intervenant", "Date", "Durée"]}
              rows={wo.timeEntries.map((t) => [
                t.technician ? `${t.technician.firstName} ${t.technician.lastName}` : "—",
                formatDateTime(t.startedAt),
                formatMinutes(t.minutes),
              ])}
              foot={["Total", "", formatMinutes(totalMinutes)]}
              align={["left", "left", "right"]}
            />
          ) : null}
        </Section>

        {wo.tasks.length > 0 ? (
          <Section title="Points de contrôle">
            <PrintTable
              head={["Opération", "Résultat", "Mesure", "Commentaire"]}
              rows={wo.tasks.map((t) => [
                t.label,
                t.result ? (TASK_RESULT[t.result]?.label ?? t.result) : "☐",
                t.measuredValue != null ? `${formatNumber(t.measuredValue)} ${t.unit ?? ""}` : "",
                t.comment ?? "",
              ])}
            />
          </Section>
        ) : null}

        {consumed.length > 0 ? (
          <Section title="Pièces">
            <PrintTable
              head={
                withCosts
                  ? ["Référence", "Désignation", "Mouvement", "Quantité", "Coût unitaire"]
                  : ["Référence", "Désignation", "Mouvement", "Quantité"]
              }
              rows={consumed.map((p) => [
                p.sku,
                p.partName,
                MOVEMENT_TYPE[p.type]?.label ?? p.type,
                `${formatNumber(p.quantity)} ${p.unit}`,
                ...(withCosts ? [formatCurrency(p.unitCost)] : []),
              ])}
              align={withCosts ? ["left", "left", "left", "right", "right"] : ["left", "left", "left", "right"]}
            />
          </Section>
        ) : null}

        <Section title="Compte rendu">
          <p className="min-h-[18mm] whitespace-pre-line">{wo.workSummary || " "}</p>
          {wo.outcome ? <p className="mt-1 text-slate-600">Résultat : {WORK_ORDER_OUTCOME[wo.outcome] ?? wo.outcome}</p> : null}
          {wo.symptomCode || wo.causeCode || wo.remedyCode ? (
            <p className="mt-1 text-slate-600">
              Symptôme : {wo.symptomCode ?? "—"} · Cause : {wo.causeCode ?? "—"} · Remède : {wo.remedyCode ?? "—"}
            </p>
          ) : null}
        </Section>

        {withCosts ? (
          <Section title="Coûts">
            <PrintTable
              head={["Main-d'œuvre", "Pièces", "Prestataire", "Autres", "Total"]}
              rows={[[wo.costs.labor, wo.costs.parts, wo.costs.external, wo.costs.other, wo.costs.total].map((v) => formatCurrency(v))]}
              align={["right", "right", "right", "right", "right"]}
            />
          </Section>
        ) : null}

        <section className="mt-5 break-inside-avoid">
          <h2 className="mb-2 border-b border-slate-300 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700">Signatures</h2>
          <div className="grid grid-cols-3 gap-3">
            <SignatureBox title="Intervenant" name={technicians.join(", ")} />
            <SignatureBox title="Prestataire" name={wo.isExternal ? wo.supplier?.name : undefined} />
            <SignatureBox title="Responsable (réception des travaux)" name={wo.releaseValidatedBy?.name} />
          </div>
          <p className="mt-2 text-[10px] text-slate-500">
            Signature précédée de la mention « Lu et approuvé ». Les signataires attestent de la réalisation des travaux décrits ci-dessus.
          </p>
        </section>

        <footer className="mt-6 border-t border-slate-300 pt-2 text-[10px] text-slate-500">
          {branding.label} · Intervention {wo.number} · Statut au {formatDate(printedAt)} : {WORK_ORDER_STATUS[wo.status]?.label ?? wo.status} ·
          Document édité par GMAO
        </footer>
      </article>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4 break-inside-avoid">
      <h2 className="mb-2 border-b border-slate-300 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-4 gap-x-4 gap-y-1.5">{children}</dl>;
}

function Item({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="text-[10px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

/** Tableau simple pour l'impression (sans la présentation en cartes des petits écrans). */
function PrintTable({ head, rows, foot, align }: { head: string[]; rows: ReactNode[][]; foot?: ReactNode[]; align?: ("left" | "right")[] }) {
  const cls = (i: number) => (align?.[i] === "right" ? "text-right tabular-nums" : "text-left");
  return (
    <table className="mt-2 w-full border-collapse text-[11px]">
      <thead>
        <tr className="border-b border-slate-400">
          {head.map((h, i) => (
            <th key={h} className={`px-1 py-1 font-semibold ${cls(i)}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r} className="border-b border-slate-200 align-top">
            {row.map((cell, i) => (
              <td key={i} className={`px-1 py-1 ${cls(i)}`}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {foot ? (
        <tfoot>
          <tr className="font-semibold">
            {foot.map((cell, i) => (
              <td key={i} className={`px-1 py-1 ${cls(i)}`}>
                {cell}
              </td>
            ))}
          </tr>
        </tfoot>
      ) : null}
    </table>
  );
}

function SignatureBox({ title, name }: { title: string; name?: string | null }) {
  return (
    <div className="flex h-[38mm] flex-col rounded border border-slate-400 p-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-700">{title}</p>
      <p className="mt-1 text-[11px]">Nom : {name || "………………………………"}</p>
      <p className="text-[11px]">Date : ……/……/…………</p>
      <p className="mt-auto text-[10px] text-slate-400">Signature</p>
    </div>
  );
}
