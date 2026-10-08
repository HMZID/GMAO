import { Building2, ClipboardCheck, ClipboardList, HardHat, Mail, ScrollText, Shapes, Users } from "lucide-react";
import Link from "next/link";
import { Forbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/layout/page-header";
import { getAuthContext } from "@/server/auth/session";

export const metadata = { title: "Administration" };

export default async function AdministrationPage() {
  const ctx = await getAuthContext();
  const sections = [
    {
      href: "/administration/organisation",
      title: "Organisation",
      text: "Sociétés, sites, ateliers, magasins et chantiers.",
      icon: Building2,
      show: ctx.can("settings.manage"),
    },
    {
      href: "/administration/utilisateurs",
      title: "Utilisateurs et habilitations",
      text: "Comptes, rôles × périmètres, délégations temporaires.",
      icon: Users,
      show: ctx.can("users.manage"),
    },
    {
      href: "/administration/techniciens",
      title: "Techniciens",
      text: "Qualifications, taux horaires, habilitations et absences.",
      icon: HardHat,
      show: ctx.can("users.manage") || ctx.can("workorder.manage"),
    },
    {
      href: "/administration/referentiel",
      title: "Référentiel équipements",
      text: "Catégories (criticité par défaut) et modèles.",
      icon: Shapes,
      show: ctx.can("settings.manage"),
    },
    {
      href: "/administration/validations",
      title: "Circuits de validation",
      text: "Étapes, valideurs et seuils des DI, demandes d'achat et dépenses de maintenance (HAB-04).",
      icon: ClipboardCheck,
      show: ctx.can("settings.manage"),
    },
    {
      href: "/administration/courriels",
      title: "Courriels",
      text: "File d'envoi des notifications : envois, reprises, erreurs et relances (NOT-01).",
      icon: Mail,
      show: ctx.can("settings.manage"),
    },
    {
      href: "/administration/journal",
      title: "Journal d'audit",
      text: "Qui a modifié quoi, quand et par quel canal (lecture seule).",
      icon: ScrollText,
      show: ctx.can("audit.read"),
    },
    {
      href: "/api/v1",
      title: "API REST v1",
      text: "Catalogue des points d'entrée et schémas JSON : mêmes règles et mêmes droits que l'application (TEC-09).",
      icon: ClipboardList,
      show: ctx.can("settings.manage"),
    },
  ].filter((s) => s.show);
  if (sections.length === 0) return <Forbidden what="l'administration" />;

  return (
    <>
      <PageHeader title="Administration" description="Paramétrage du groupe, des habilitations et des référentiels." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group rounded-lg border border-slate-200 bg-white p-5 shadow-xs hover:border-brand-300 hover:bg-brand-50/30"
          >
            <s.icon className="h-6 w-6 text-brand-700" aria-hidden />
            <h2 className="mt-3 font-semibold text-slate-900 group-hover:text-brand-800">{s.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{s.text}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
