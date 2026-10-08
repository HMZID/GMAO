import { Forbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, Card, CardBody } from "@/components/ui/primitives";
import { getAuthContext } from "@/server/auth/session";
import { loadOr404 } from "@/server/pages";
import { getEquipment, getEquipmentFormOptions } from "@/server/services/equipment";
import { getOrganizationOptions } from "@/server/services/organization";
import { updateEquipmentAction } from "../../actions";
import { EquipmentForm } from "../../equipment-form";

export const metadata = { title: "Modifier l'équipement" };

export default async function EditEquipmentPage(props: PageProps<"/equipements/[id]/modifier">) {
  const { id } = await props.params;
  const ctx = await getAuthContext();
  const equipment = await loadOr404(id, (x) => getEquipment(ctx, x));
  if (!ctx.canOn("equipment.write", equipment)) return <Forbidden what="la modification de cet équipement" />;
  const [org, opts] = await Promise.all([getOrganizationOptions(ctx), getEquipmentFormOptions(ctx)]);
  return (
    <>
      <PageHeader title={`Modifier ${equipment.code}`} back={{ href: `/equipements/${id}`, label: equipment.code }} />
      {equipment.status === "RETIRED" ? (
        <Alert tone="amber" title="Équipement réformé">
          La fiche est en lecture seule (EQP-14).
        </Alert>
      ) : (
        <Card>
          <CardBody>
            <EquipmentForm
              action={updateEquipmentAction.bind(null, id)}
              mode="edit"
              values={{ ...equipment, companyId: equipment.companyId }}
              companies={org.companies}
              sites={org.sites}
              categories={opts.categories}
              models={opts.models}
              cancelHref={`/equipements/${id}`}
            />
          </CardBody>
        </Card>
      )}
    </>
  );
}
