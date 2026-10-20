import { Forbidden } from "@/components/forbidden";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/layout/page-header";
import { Checkbox, Input, Textarea } from "@/components/ui/inputs";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { getAuthContext } from "@/server/auth/session";
import { SITE_SETTING_GROUPS, SITE_SETTINGS, settingEnabled } from "@/server/domain/site";
import { isPlatformAdmin } from "@/server/services/platform";
import { getSiteSettings } from "@/server/services/site";
import { updateSiteSettingsAction } from "../actions";
import { SiteAdminNav } from "../site-admin-nav";
import { T } from "@/i18n/client";

export const metadata = { title: "Textes du site" };

/** Textes généraux du site : un formulaire par rubrique ; un champ vidé reprend le texte par défaut. */
export default async function SiteContentPage() {
  const ctx = await getAuthContext();
  if (!isPlatformAdmin(ctx)) return <Forbidden what="l'administration du site" />;
  const settings = await getSiteSettings();

  return (
    <>
      <PageHeader
        back={{ href: "/administration", label: "Administration" }}
        title="Site commercial"
        description="Textes et réglages généraux. Un champ vidé reprend le texte d'origine."
      />
      <SiteAdminNav active="contenu" />
      <div className="space-y-6">
        {SITE_SETTING_GROUPS.map((group) => (
          <Card key={group.id}>
            <CardHeader title={group.label} />
            <CardBody>
              <ActionForm action={updateSiteSettingsAction} className="grid gap-4 md:grid-cols-2">
                <input type="hidden" name="group" value={group.id} />
                {SITE_SETTINGS.filter((s) => s.group === group.id).map((s) => {
                  const value = settings[s.key];
                  const hint = "hint" in s ? s.hint : undefined;
                  if (s.type === "boolean") {
                    return (
                      <div key={s.key} className="md:col-span-2">
                        <Checkbox name={s.key} label={s.label} defaultChecked={settingEnabled(value)} />
                      </div>
                    );
                  }
                  return (
                    <Field key={s.key} label={s.label} name={s.key} hint={hint} className={s.type === "textarea" ? "md:col-span-2" : undefined}>
                      {s.type === "textarea" ? (
                        <Textarea name={s.key} defaultValue={value} rows={3} maxLength={2000} />
                      ) : (
                        <Input
                          name={s.key}
                          defaultValue={value}
                          type={s.type === "email" ? "email" : "text"}
                          inputMode={s.type === "number" ? "decimal" : undefined}
                          maxLength={300}
                        />
                      )}
                    </Field>
                  );
                })}
                <div className="md:col-span-2">
                  <SubmitButton>
                    <T>Enregistrer</T>
                  </SubmitButton>
                </div>
              </ActionForm>
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}
