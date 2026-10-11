import "server-only";
import { contentDisposition } from "@/server/domain/documents";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Fichier produit par le serveur (export CSV, JSON…), téléchargé sous son nom. */
export function fileResponse(file: { fileName: string; contentType: string; body: BodyInit }) {
  return new Response(file.body, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": contentDisposition(file.fileName, false),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

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
