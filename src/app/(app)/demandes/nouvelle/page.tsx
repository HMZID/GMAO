import { Forbidden } from "@/components/forbidden";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/inputs";
import { Card, CardBody } from "@/components/ui/primitives";
import { getAuthContext } from "@/server/auth/session";
import { isUuid } from "@/server/pages";
import { listEquipmentOptions } from "@/server/services/equipment";
import { createWorkRequestAction } from "../actions";

export const metadata = { title: "Signaler une panne" };

export default async function NewWorkRequestPage(props: PageProps<"/demandes/nouvelle">) {
  const ctx = await getAuthContext();
  if (!ctx.can("request.create")) return <Forbidden what="le signalement de pannes" />;
  const sp = await props.searchParams;
  const preselected = isUuid(sp.equipmentId) ? sp.equipmentId : "";
  const equipment = await listEquipmentOptions(ctx, "request.create");

  return (
    <>
      <PageHeader
        title="Signaler une panne"
        description="Décrire ce qui est constaté. La priorité est proposée automatiquement (machine arrêtée, risque sécurité, criticité) puis confirmée par le chef d'atelier."
        back={{ href: "/demandes", label: "Demandes d'intervention" }}
      />
      <Card className="max-w-3xl">
        <CardBody>
          <ActionForm action={createWorkRequestAction} className="space-y-5">
            <Field
              label="Équipement"
              name="equipmentId"
              required
              hint="Sur le terrain, l'application mobile identifie l'équipement par son QR code (EQP-09)."
            >
              <Select
                id="equipmentId"
                name="equipmentId"
                required
                defaultValue={preselected}
                placeholder="Choisir l'équipement…"
                options={equipment.map((e) => ({ value: e.id, label: `${e.code} — ${e.name}` }))}
              />
            </Field>
            <Field label="Symptôme" name="symptom" required>
              <Input id="symptom" name="symptom" required maxLength={200} placeholder="Ex. fuite hydraulique sur le bras" />
            </Field>
            <Field label="Description" name="description">
              <Textarea
                id="description"
                name="description"
                rows={4}
                maxLength={2000}
                placeholder="Circonstances, bruit, voyant, ce qui a déjà été tenté…"
              />
            </Field>
            <div className="flex flex-wrap gap-6">
              <Checkbox name="isStopped" label="La machine est arrêtée" />
              <Checkbox name="isSafetyRisk" label="Risque pour la sécurité" />
            </div>
            <Field label="Relevé du compteur" name="meterValue" hint="Facultatif : heures ou kilomètres affichés">
              <Input id="meterValue" name="meterValue" type="number" min={0} step="0.1" className="max-w-48" />
            </Field>
            <div className="flex items-center gap-3 border-t border-slate-100 pt-5">
              <SubmitButton>Envoyer le signalement</SubmitButton>
              <ButtonLink href="/demandes" variant="ghost">
                Annuler
              </ButtonLink>
            </div>
          </ActionForm>
        </CardBody>
      </Card>
    </>
  );
}
