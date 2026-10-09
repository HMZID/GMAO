import "server-only";
import { contentDisposition } from "@/server/domain/documents";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Fichier Excel produit par le serveur (modèle, rapport), téléchargé sous son nom. */
export function xlsxResponse(file: { fileName: string; buffer: Uint8Array }) {
  return new Response(file.buffer as BodyInit, {
    headers: {
      "Content-Type": XLSX,
      "Content-Disposition": contentDisposition(file.fileName, false),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
