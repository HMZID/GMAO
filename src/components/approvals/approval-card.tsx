import { CheckCircle2, CircleDot, XCircle } from "lucide-react";
import { decideApprovalAction } from "@/app/(app)/validations/actions";
import { ActionPanel, Field, PanelForm, SubmitButton } from "@/components/forms/action-form";
import { Textarea } from "@/components/ui/inputs";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { APPROVAL_STATUS, ROLE } from "@/lib/labels";
import type { approvalTimeline } from "@/server/services/approvals";

type Timeline = Awaited<ReturnType<typeof approvalTimeline>>;

/**
 * Validation d'un objet (HAB-04) : étapes, décisions tracées (auteur, date, commentaire) et, pour le
 * valideur de l'étape en cours, le formulaire d'approbation ou de refus. Rien n'est affiché sans circuit.
 */
export function ApprovalCard({ approvals, title = "Validation" }: { approvals: Timeline; title?: string }) {
  if (approvals.length === 0) return null;
  return (
    <Card>
      <CardHeader title={title} description="Circuit de validation : chaque décision est tracée" />
      <CardBody className="space-y-6">
        {approvals.map((a) => (
          <ApprovalBlock key={a.id} approval={a} />
        ))}
      </CardBody>
    </Card>
  );
}

function ApprovalBlock({ approval: a }: { approval: Timeline[number] }) {
  const decided = new Map(a.decisions.map((d) => [d.stepPosition, d]));
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-900">{a.label}</p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={APPROVAL_STATUS[a.status]?.tone}>{APPROVAL_STATUS[a.status]?.label ?? a.status}</Badge>
        <span className="text-slate-600">
          Soumise le {formatDateTime(a.createdAt)} par {a.requesterName ?? "—"}
          {a.amount != null ? ` · ${formatCurrency(a.amount)}` : ""}
        </span>
      </div>
      <ol className="space-y-2">
        {a.steps.map((step) => {
          const d = decided.get(step.position);
          const current = a.status === "PENDING" && a.currentPosition === step.position;
          const Icon = d ? (d.decision === "APPROVED" ? CheckCircle2 : XCircle) : CircleDot;
          return (
            <li key={step.position} className="flex gap-2 text-sm">
              <Icon
                className={`mt-0.5 h-4 w-4 shrink-0 ${d ? (d.decision === "APPROVED" ? "text-emerald-600" : "text-red-600") : current ? "text-amber-500" : "text-slate-300"}`}
                aria-hidden
              />
              <div>
                <p className="font-medium text-slate-800">
                  {step.name}
                  <span className="font-normal text-slate-500">
                    {" "}
                    · {step.approverRole ? (ROLE[step.approverRole] ?? step.approverRole) : "valideur nommé"}
                  </span>
                  {current ? <span className="ml-2 text-xs font-normal text-amber-700">étape en cours</span> : null}
                </p>
                {d ? (
                  <p className="text-slate-600">
                    {d.decision === "APPROVED" ? "Validée" : "Refusée"} par {d.decidedBy}
                    {d.onBehalfOf ? ` (suppléant de ${d.onBehalfOf})` : ""} le {formatDateTime(d.createdAt)}
                    {d.comment ? <span className="block italic text-slate-700">« {d.comment} »</span> : null}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {/* Le panneau reste affiché après la décision : le message de résultat reste visible. */}
      <ActionPanel action={decideApprovalAction.bind(null, a.id)}>
        {a.canDecide ? (
          <PanelForm className="space-y-3 rounded-md border border-amber-200 bg-amber-50/50 p-4">
            <Field label="Commentaire" name="comment" hint="Obligatoire en cas de refus">
              <Textarea name="comment" rows={2} maxLength={1000} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <SubmitButton name="decision" value="APPROVED">
                Valider
              </SubmitButton>
              <SubmitButton name="decision" value="REJECTED" variant="danger">
                Refuser
              </SubmitButton>
            </div>
          </PanelForm>
        ) : null}
      </ActionPanel>
    </div>
  );
}
