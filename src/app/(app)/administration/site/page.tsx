import { redirect } from "next/navigation";

/** Administration du site commercial : ouverte sur les demandes de démonstration. */
export default function SiteAdminPage() {
  redirect("/administration/site/demandes");
}
