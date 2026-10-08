import { Forbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody } from "@/components/ui/primitives";
import { getAuthContext } from "@/server/auth/session";
import { getEquipmentFormOptions } from "@/server/services/equipment";
import { getOrganizationOptions } from "@/server/services/organization";
import { createEquipmentAction } from "../actions";
import { EquipmentForm } from "../equipment-form";

export const metadata = { title: "Nouvel équipement" };

export default async function NewEquipmentPage() {
  const ctx = await getAuthContext();
  if (!ctx.can("equipment.write")) return <Forbidden what="la création d'équipements" />;
  const [org, opts] = await Promise.all([getOrganizationOptions(ctx), getEquipmentFormOptions(ctx)]);
  return (
    <>
      <PageHeader
        title="Nouvel équipement"
        description="Les plans d'entretien de la catégorie et du modèle sont appliqués automatiquement à la création."
        back={{ href: "/equipements", label: "Équipements" }}
      />
      <Card>
        <CardBody>
          <EquipmentForm
            action={createEquipmentAction}
            mode="create"
            companies={org.companies}
            sites={org.sites}
            categories={opts.categories}
            models={opts.models}
            cancelHref="/equipements"
          />
        </CardBody>
      </Card>
    </>
  );
}
