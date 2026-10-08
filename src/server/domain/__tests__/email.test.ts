import { describe, expect, it } from "vitest";
import {
  absoluteLink,
  dayKey,
  documentExpiryStage,
  emailEventOf,
  isDigestTime,
  isPermanentError,
  MAX_ATTEMPTS,
  nextRetryAt,
  renderEmail,
  wantsEmail,
} from "../email";

const now = new Date("2026-10-08T10:00:00Z");

describe("Courriels : événements et préférences (NOT-01, §11.1)", () => {
  it("associe les notifications de l'application aux événements envoyés par courriel", () => {
    expect(emailEventOf("approval.pending")).toBe("APPROVAL_PENDING");
    expect(emailEventOf("work_order.assigned")).toBe("ASSIGNMENT");
    expect(emailEventOf("work_request.created")).toBeNull();
  });

  it("respecte la préférence, sauf pour une alerte obligatoire", () => {
    expect(wantsEmail("ASSIGNMENT", { ASSIGNMENT: false })).toBe(false);
    expect(wantsEmail("ASSIGNMENT", {})).toBe(true);
    expect(wantsEmail("APPROVAL_PENDING", { APPROVAL_PENDING: false })).toBe(true);
  });
});

describe("Courriels : reprises après échec", () => {
  it("espace les tentatives puis abandonne après le maximum", () => {
    expect(nextRetryAt(1, now)?.toISOString()).toBe("2026-10-08T10:01:00.000Z");
    expect(nextRetryAt(2, now)?.toISOString()).toBe("2026-10-08T10:05:00.000Z");
    expect(nextRetryAt(4, now)?.toISOString()).toBe("2026-10-08T11:00:00.000Z");
    expect(nextRetryAt(MAX_ATTEMPTS, now)).toBeNull();
  });

  it("ne retente pas une erreur définitive (adresse refusée, authentification)", () => {
    expect(isPermanentError({ responseCode: 550 })).toBe(true);
    expect(isPermanentError({ code: "EAUTH" })).toBe(true);
    expect(isPermanentError({ responseCode: 421 })).toBe(false);
    expect(isPermanentError({ code: "ECONNREFUSED" })).toBe(false);
  });
});

describe("Courriels : dates", () => {
  it("calcule le jour dans le fuseau d'exploitation", () => {
    expect(dayKey(new Date("2026-10-08T22:30:00Z"))).toBe("2026-10-09");
  });

  it("n'envoie les récapitulatifs qu'à partir de l'heure paramétrée (NOT-04)", () => {
    expect(isDigestTime(new Date("2026-10-08T04:30:00Z"), 7)).toBe(false);
    expect(isDigestTime(new Date("2026-10-08T05:30:00Z"), 7)).toBe(true);
  });

  it("repère les paliers d'échéance des documents : J-30, J-7, expiré", () => {
    const at = (days: number) => new Date(now.getTime() + days * 86_400_000);
    expect(documentExpiryStage(at(45), now)).toBeNull();
    expect(documentExpiryStage(at(30), now)).toBe("J30");
    expect(documentExpiryStage(at(6), now)).toBe("J7");
    expect(documentExpiryStage(at(-1), now)).toBe("J0");
  });
});

describe("Courriels : modèles", () => {
  const base = "https://gmao.example.fr/";

  it("échappe les valeurs saisies dans la version HTML", () => {
    const mail = renderEmail(
      "APPROVAL_PENDING",
      { title: "À valider : <script>alert(1)</script>", link: "/validations" },
      { baseUrl: base, recipientName: "Karim" },
    );
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.subject).toBe("[GMAO] À valider : <script>alert(1)</script>");
    expect(mail.text).toContain("https://gmao.example.fr/validations");
  });

  it("n'accepte que des liens internes à l'application", () => {
    expect(absoluteLink(base, "/ordres-de-travail/1")).toBe("https://gmao.example.fr/ordres-de-travail/1");
    expect(absoluteLink(base, "https://pirate.example")).toBeNull();
    expect(absoluteLink(base, "//pirate.example")).toBeNull();
  });

  it("signale une alerte obligatoire et renvoie aux préférences sinon", () => {
    expect(renderEmail("URGENT_REQUEST", { title: "DI P1" }, { baseUrl: base }).text).toContain("Alerte obligatoire");
    expect(renderEmail("STOCK_ALERT", { title: "Stock", items: [{ label: "FLT-01", detail: "2 u" }] }, { baseUrl: base }).text).toContain(
      "https://gmao.example.fr/notifications",
    );
  });
});
