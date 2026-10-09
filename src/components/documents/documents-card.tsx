import { FileText } from "lucide-react";
import { deleteDocumentAction, uploadDocumentAction } from "@/app/(app)/documents/actions";
import { ActionForm, ActionPanel, Field, PanelForm, SubmitButton } from "@/components/forms/action-form";
import { Disclosure } from "@/components/ui/disclosure";
import { Input, Select, Textarea } from "@/components/ui/inputs";
import { Badge, Card, CardBody, CardHeader, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/primitives";
import { formatDate, formatDateTime } from "@/lib/format";
import { DOCUMENT_KIND, options } from "@/lib/labels";
import type { AuthContext } from "@/server/authz/context";
import { ACCEPT_ATTRIBUTE, formatSize, type DocumentEntity } from "@/server/domain/documents";
import { listDocuments } from "@/server/services/documents";

/** Carte « Documents » des fiches équipement et OT (EQP-07) : liste, consultation, ajout et retrait. */
export async function DocumentsCard({
  ctx,
  entityType,
  entityId,
  description,
  now,
}: {
  ctx: AuthContext;
  entityType: DocumentEntity;
  entityId: string;
  description?: string;
  /** Instant de référence pour signaler les documents expirés (lu après l'accès à la session). */
  now: Date;
}) {
  const { items, canUpload, maxSizeBytes } = await listDocuments(ctx, { entityType, entityId });
  const kinds = options(DOCUMENT_KIND).filter((o) => o.value !== "INVOICE" || ctx.can("supplier.read"));

  return (
    <Card>
      <CardHeader title="Documents" description={description ?? "Notices, certificats, factures, photos et rapports"} />
      {/* Panneau partagé : le message de retrait reste affiché quand la ligne (ou la liste) disparaît. */}
      <ActionPanel action={deleteDocumentAction} className="[&>[role]]:mx-5 [&>[role]]:mt-4">
        {items.length === 0 ? (
          <EmptyState title="Aucun document" description={canUpload ? "Ajouter une notice, un certificat ou une photo ci-dessous." : undefined} />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Document</TH>
                <TH>Type</TH>
                <TH>Expiration</TH>
                <TH>Ajouté</TH>
                <TH className="sr-only">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {items.map((d) => {
                const expired = d.expiresAt ? d.expiresAt < now : false;
                return (
                  <TR key={d.id}>
                    <TD>
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:underline"
                      >
                        <FileText className="h-4 w-4 shrink-0" aria-hidden />
                        {d.title}
                      </a>
                      <p className="text-xs text-slate-500">
                        {d.fileName} · {formatSize(d.sizeBytes)}
                      </p>
                      {d.description ? <p className="mt-0.5 text-xs text-slate-600">{d.description}</p> : null}
                    </TD>
                    <TD>
                      <Badge tone={DOCUMENT_KIND[d.kind]?.tone}>{DOCUMENT_KIND[d.kind]?.label ?? d.kind}</Badge>
                    </TD>
                    <TD>
                      {d.expiresAt ? (
                        <span className={expired ? "font-medium text-red-700" : undefined}>
                          {formatDate(d.expiresAt)}
                          {expired ? " (expiré)" : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TD>
                    <TD className="whitespace-nowrap">
                      {formatDateTime(d.createdAt)}
                      <p className="text-xs text-slate-500">{d.uploadedBy ?? "—"}</p>
                    </TD>
                    <TD className="text-right">
                      <a href={`${d.url}?download=1`} className="text-sm text-slate-600 hover:underline">
                        Télécharger
                      </a>
                      {d.canDelete ? (
                        <Disclosure summary="Retirer" className="mt-2 text-left">
                          <PanelForm className="space-y-3">
                            <input type="hidden" name="documentId" value={d.id} />
                            <Field label="Motif" name="reason">
                              <Input name="reason" maxLength={500} />
                            </Field>
                            <SubmitButton variant="danger" size="sm">
                              Retirer le document
                            </SubmitButton>
                          </PanelForm>
                        </Disclosure>
                      ) : null}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </ActionPanel>
      {canUpload ? (
        <CardBody className="border-t border-slate-100">
          <Disclosure summary="Ajouter un document">
            <ActionForm action={uploadDocumentAction.bind(null, entityType, entityId)} resetOnSuccess className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Fichier"
                name="file"
                required
                hint={`PDF, photo, vidéo courte, Word ou Excel ; ${formatSize(maxSizeBytes)} au plus`}
                className="sm:col-span-2"
              >
                <Input type="file" name="file" required accept={ACCEPT_ATTRIBUTE} className="h-auto py-1.5" />
              </Field>
              <Field label="Type" name="kind" required>
                <Select name="kind" required options={kinds} defaultValue={entityType === "WORK_ORDER" ? "PHOTO" : "MANUAL"} />
              </Field>
              <Field label="Titre" name="title" hint="Par défaut : nom du fichier">
                <Input name="title" maxLength={200} />
              </Field>
              <Field label="Date d'expiration" name="expiresAt" hint="Certificat, rapport de contrôle">
                <Input type="date" name="expiresAt" />
              </Field>
              <Field label="Description" name="description" className="sm:col-span-2">
                <Textarea name="description" rows={2} maxLength={1000} />
              </Field>
              <div className="sm:col-span-2">
                <SubmitButton>Ajouter le document</SubmitButton>
              </div>
            </ActionForm>
          </Disclosure>
        </CardBody>
      ) : null}
    </Card>
  );
}
