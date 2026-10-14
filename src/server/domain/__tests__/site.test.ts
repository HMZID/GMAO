import { describe, expect, it } from "vitest";
import { generateProvisionalPassword, newPasswordRefusals } from "../credentials";
import { renderDemoAccessEmail, renderDemoDeclinedEmail, renderDemoRequestEmail } from "../email";
import {
  SITE_SETTINGS,
  displayedPrice,
  estimateRoi,
  organizationNameFrom,
  parseInline,
  parseRichText,
  planFeatures,
  resolveSettings,
  safeHref,
  slugify,
  spamSignals,
} from "../site";
import { DEFAULT_SITE_ITEMS, DEFAULT_SITE_PAGES, DEFAULT_SITE_PLANS } from "../site-defaults";

describe("Réglages du site", () => {
  it("complète les réglages enregistrés par les valeurs par défaut et ignore les clés inconnues", () => {
    const s = resolveSettings([
      { key: "hero.title", value: "Titre modifié" },
      { key: "_initialized", value: "2026-10-13" },
    ]);
    expect(s["hero.title"]).toBe("Titre modifié");
    expect(s["brand.name"]).toBe("GMAO");
    expect(Object.keys(s)).toHaveLength(SITE_SETTINGS.length);
    expect("_initialized" in s).toBe(false);
  });

  it("n'a pas deux réglages de même clé", () => {
    expect(new Set(SITE_SETTINGS.map((s) => s.key)).size).toBe(SITE_SETTINGS.length);
  });

  it("livre les témoignages d'exemple non publiés", () => {
    expect(DEFAULT_SITE_ITEMS.filter((i) => i.kind === "TESTIMONIAL").every((i) => i.published === false)).toBe(true);
    expect(DEFAULT_SITE_PLANS.length).toBeGreaterThan(0);
    expect(DEFAULT_SITE_PAGES.map((p) => p.slug)).toContain("confidentialite");
  });
});

describe("Demandes de démonstration : contrôles anti-robot", () => {
  const now = 1_000_000;
  it("accepte un formulaire rempli par un humain", () => {
    expect(spamSignals({ honeypot: "", startedAt: now - 20_000, now })).toEqual([]);
  });
  it("signale le champ piège rempli", () => {
    expect(spamSignals({ honeypot: "http://spam", startedAt: now - 20_000, now })).toContain("honeypot");
  });
  it("signale un envoi trop rapide ou sans horodatage cohérent", () => {
    expect(spamSignals({ startedAt: now - 500, now })).toEqual(["too_fast"]);
    expect(spamSignals({ startedAt: null, now })).toEqual(["timestamp"]);
    expect(spamSignals({ startedAt: now + 60_000, now })).toEqual(["timestamp"]);
  });
  it("propose un nom d'organisation sans espaces superflus", () => {
    expect(organizationNameFrom("  Carrières   du  Vercors ")).toBe("Carrières du Vercors");
  });
});

describe("Pages libres", () => {
  it("déduit l'adresse du titre", () => {
    expect(slugify("Mentions légales & CGU !")).toBe("mentions-legales-cgu");
    expect(slugify("À propos")).toBe("a-propos");
  });

  it("n'accepte que les liens web, courriel ou internes", () => {
    expect(safeHref("https://exemple.fr")).toBe("https://exemple.fr");
    expect(safeHref("mailto:contact@exemple.fr")).toBe("mailto:contact@exemple.fr");
    expect(safeHref("/tarifs")).toBe("/tarifs");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("//evil.example")).toBeNull();
  });

  it("met en forme gras et liens, et rend un lien dangereux en simple texte", () => {
    expect(parseInline("Voir **les tarifs** et [la FAQ](/decouvrir#questions).")).toEqual([
      { text: "Voir " },
      { text: "les tarifs", strong: true },
      { text: " et " },
      { text: "la FAQ", href: "/decouvrir#questions" },
      { text: "." },
    ]);
    expect(parseInline("[clic](javascript:alert(1))")[0]).toEqual({ text: "clic" });
  });

  it("découpe titres, paragraphes et listes", () => {
    const blocks = parseRichText("## Données\n\nPremière ligne\nsuite du paragraphe\n- un\n- deux\n\n### Droits\nTexte");
    expect(blocks.map((b) => b.type)).toEqual(["h2", "p", "ul", "h3", "p"]);
    expect(blocks[1]).toEqual({ type: "p", content: [{ text: "Première ligne suite du paragraphe" }] });
    expect(blocks[2]).toEqual({ type: "ul", items: [[{ text: "un" }], [{ text: "deux" }]] });
  });
});

describe("Offres et calculateur", () => {
  it("ramène le prix annuel au mois (mois facturés sur 12)", () => {
    expect(displayedPrice(12, "monthly", 10)).toBe(12);
    expect(displayedPrice(12, "yearly", 10)).toBe(10);
    expect(displayedPrice(7, "yearly", 10)).toBe(5.83);
    expect(displayedPrice(null, "yearly", 10)).toBeNull();
  });

  it("lit un avantage par ligne", () => {
    expect(planFeatures("- Un\n\n  Deux  \r\n* Trois")).toEqual(["Un", "Deux", "Trois"]);
  });

  it("estime le coût des pannes, l'économie et le retour sur investissement", () => {
    const r = estimateRoi({
      equipmentCount: 40,
      breakdownsPerMonth: 6,
      daysPerBreakdown: 2,
      dailyCost: 600,
      reductionPct: 25,
      pricePerEquipment: 12,
    });
    expect(r.downtimeCost).toBe(86_400);
    expect(r.savings).toBe(21_600);
    expect(r.subscription).toBe(5_760);
    expect(r.net).toBe(15_840);
    expect(r.paybackMonths).toBe(3.2);
  });

  it("ne donne pas de retour sur investissement sans économie", () => {
    expect(
      estimateRoi({ equipmentCount: 10, breakdownsPerMonth: 0, daysPerBreakdown: 2, dailyCost: 600, reductionPct: 25, pricePerEquipment: 12 })
        .paybackMonths,
    ).toBeNull();
  });
});

describe("Mot de passe provisoire", () => {
  it("compte 14 caractères en trois groupes, avec majuscule, minuscule et chiffre", () => {
    for (let i = 0; i < 50; i++) {
      const p = generateProvisionalPassword();
      expect(p).toMatch(/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[2-9]/);
      expect(p).not.toMatch(/[0O1lI]/);
    }
  });

  it("refuse un nouveau mot de passe court, mal confirmé ou identique au provisoire", () => {
    expect(newPasswordRefusals({ password: "court", confirmation: "autre", provisionalMatches: true })).toHaveLength(3);
    expect(newPasswordRefusals({ password: "Mon-Atelier-2026", confirmation: "Mon-Atelier-2026", provisionalMatches: false })).toEqual([]);
  });
});

describe("Courriels du site", () => {
  it("donne le lien de connexion, l'identifiant et le mot de passe provisoire, échappés", () => {
    const mail = renderDemoAccessEmail({
      product: "GMAO",
      recipientName: "Léa <Martin>",
      organization: "TP du Rhône",
      login: "lea@tp-rhone.fr",
      password: "Kp7m-W3xq-9Rtd",
      loginUrl: "https://gmao.example/login",
      endsOn: "12 novembre 2026",
    });
    expect(mail.subject).toBe("[GMAO] Votre espace de démonstration est prêt");
    for (const part of ["https://gmao.example/login", "lea@tp-rhone.fr", "Kp7m-W3xq-9Rtd", "12 novembre 2026"]) {
      expect(mail.text).toContain(part);
      expect(mail.html).toContain(part);
    }
    expect(mail.html).toContain("Léa &lt;Martin&gt;");
    expect(mail.html).not.toContain("<Martin>");
  });

  it("signale un renvoi d'accès", () => {
    const mail = renderDemoAccessEmail({
      product: "GMAO",
      recipientName: "Léa",
      organization: "TP",
      login: "a@b.fr",
      password: "x",
      loginUrl: "u",
      endsOn: "d",
      resent: true,
    });
    expect(mail.subject).toContain("nouveaux accès");
    expect(mail.text).toContain("ne fonctionne plus");
  });

  it("résume la demande pour l'administrateur et omet les champs vides", () => {
    const mail = renderDemoRequestEmail({
      product: "GMAO",
      company: "Carrières du Vercors",
      contactName: "Paul",
      email: "paul@cv.fr",
      details: [
        { label: "Téléphone", value: null },
        { label: "Secteur", value: "Carrières et granulats" },
      ],
      link: "https://gmao.example/administration/site/demandes/1",
    });
    expect(mail.text).toContain("Secteur : Carrières et granulats");
    expect(mail.text).not.toContain("Téléphone");
    expect(mail.html).toContain("https://gmao.example/administration/site/demandes/1");
  });

  it("répond au prospect refusé avec le motif facultatif", () => {
    expect(renderDemoDeclinedEmail({ product: "GMAO", recipientName: "Paul", reason: "Hors zone.", contactEmail: "c@g.fr" }).text).toContain(
      "Hors zone.",
    );
    expect(renderDemoDeclinedEmail({ product: "GMAO", recipientName: "Paul" }).text).not.toContain("question");
  });
});
