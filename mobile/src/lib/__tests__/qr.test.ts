import { describe, expect, it } from "vitest";
import { extractQrToken } from "../qr";

describe("Étiquettes QR (MOB-02, EQP-09)", () => {
  it("lit un jeton seul ou une adresse d'étiquette", () => {
    expect(extractQrToken(" Ab3_x-9QZ ")).toBe("Ab3_x-9QZ");
    expect(extractQrToken("https://gmao.example.fr/qr/Ab3_x-9QZ")).toBe("Ab3_x-9QZ");
    expect(extractQrToken("https://gmao.example.fr/api/v1/equipment/by-qr/Ab3_x-9QZ?src=label")).toBe("Ab3_x-9QZ");
  });

  it("renvoie tel quel un contenu sans rapport (le serveur répondra « inconnu »)", () => {
    expect(extractQrToken("WIFI:S:chantier;T:WPA;;")).toBe("WIFI:S:chantier;T:WPA;;");
  });
});
