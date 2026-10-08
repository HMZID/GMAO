import { describe, expect, it } from "vitest";
import { canDeleteDocument, checkFile, contentDisposition, maxSizeBytes, safeFileName } from "../documents";

const bytes = (...values: (number | string)[]) =>
  Uint8Array.from(values.flatMap((v) => (typeof v === "string" ? [...v].map((c) => c.charCodeAt(0)) : [v])));

const PDF = bytes("%PDF-1.7");
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const MP4 = bytes(0, 0, 0, 0x18, "ftypmp42");
const EXE = bytes("MZ", 0x90, 0);
const LIMIT = maxSizeBytes("5");

describe("Documents : contrôle des fichiers (EQP-07)", () => {
  it("accepte un PDF, une photo et une vidéo courte dont le contenu correspond à l'extension", () => {
    expect(checkFile({ name: "notice.pdf", size: 1000, head: PDF }, LIMIT)).toMatchObject({ ok: true });
    expect(checkFile({ name: "Photo.JPG", size: 1000, head: JPEG }, LIMIT)).toMatchObject({ ok: true });
    expect(checkFile({ name: "fuite.png", size: 1000, head: PNG }, LIMIT)).toMatchObject({ ok: true });
    expect(checkFile({ name: "bruit.mp4", size: 1000, head: MP4 }, LIMIT)).toMatchObject({ ok: true });
  });

  it("refuse un exécutable renommé en .pdf", () => {
    const result = checkFile({ name: "facture.pdf", size: 1000, head: EXE }, LIMIT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/ne correspond pas/);
  });

  it("refuse un format non prévu", () => {
    const result = checkFile({ name: "script.exe", size: 1000, head: EXE }, LIMIT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/Format non accepté/);
  });

  it("liste toutes les anomalies en une fois (DON-11)", () => {
    const result = checkFile({ name: "gros.exe", size: 6 * 1024 * 1024, head: EXE }, LIMIT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toHaveLength(2);
  });

  it("refuse un fichier vide ou trop volumineux", () => {
    expect(checkFile({ name: "vide.pdf", size: 0, head: new Uint8Array() }, LIMIT).ok).toBe(false);
    expect(checkFile({ name: "gros.pdf", size: LIMIT + 1, head: PDF }, LIMIT).ok).toBe(false);
    expect(checkFile({ name: "limite.pdf", size: LIMIT, head: PDF }, LIMIT).ok).toBe(true);
  });

  it("prend 20 Mo par défaut si la taille paramétrée est absente ou invalide", () => {
    expect(maxSizeBytes(undefined)).toBe(20 * 1024 * 1024);
    expect(maxSizeBytes("abc")).toBe(20 * 1024 * 1024);
    expect(maxSizeBytes("50")).toBe(50 * 1024 * 1024);
  });
});

describe("Documents : noms de fichier", () => {
  it("retire les chemins et les caractères dangereux", () => {
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName("C:\\temp\\rapport VGP.pdf")).toBe("rapport VGP.pdf");
    expect(safeFileName('a"b<c>.pdf')).toBe("a_b_c_.pdf");
    expect(safeFileName("..")).toBe("document");
  });

  it("encode les accents dans Content-Disposition avec un repli ASCII", () => {
    const header = contentDisposition("Contrôle périodique.pdf", false);
    expect(header).toContain('attachment; filename="Controle periodique.pdf"');
    expect(header).toContain("filename*=UTF-8''Contr%C3%B4le%20p%C3%A9riodique.pdf");
    expect(contentDisposition("photo.jpg", true).startsWith("inline;")).toBe(true);
  });
});

describe("Documents : droit de retrait", () => {
  it("autorise le gestionnaire de l'objet", () => {
    expect(canDeleteDocument({ isManager: true, isUploader: false, entityType: "EQUIPMENT" })).toBe(true);
  });

  it("autorise l'auteur d'une pièce jointe d'OT tant que l'OT n'est pas clôturé", () => {
    expect(canDeleteDocument({ isManager: false, isUploader: true, entityType: "WORK_ORDER", workOrderStatus: "IN_PROGRESS" })).toBe(true);
    expect(canDeleteDocument({ isManager: false, isUploader: true, entityType: "WORK_ORDER", workOrderStatus: "TECH_CLOSED" })).toBe(false);
  });

  it("refuse les autres utilisateurs", () => {
    expect(canDeleteDocument({ isManager: false, isUploader: false, entityType: "WORK_ORDER", workOrderStatus: "IN_PROGRESS" })).toBe(false);
    expect(canDeleteDocument({ isManager: false, isUploader: true, entityType: "EQUIPMENT" })).toBe(false);
  });
});
