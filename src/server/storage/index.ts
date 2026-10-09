import "server-only";
import { createLocalStorage } from "./local";
import { createS3Storage } from "./s3";

/**
 * Stockage des fichiers (EQP-07), indépendant de la base. Deux pilotes au choix par STORAGE_DRIVER :
 * - `local` (défaut) : répertoire du serveur hors de `public/` (développement, hébergement sur site, TEC-16) ;
 * - `s3` : tout service compatible S3 (AWS, MinIO, Scaleway, OVH), chiffrement côté serveur demandé.
 * Les fichiers ne sont jamais servis directement : ils passent par la route API qui contrôle les droits.
 */
export type StoredObject = { body: ReadableStream<Uint8Array>; size: number };

export interface FileStorage {
  readonly driver: "local" | "s3";
  put(key: string, data: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject>;
  remove(key: string): Promise<void>;
}

const globalForStorage = globalThis as unknown as { gmaoStorage?: FileStorage };

export function getStorage(): FileStorage {
  if (!globalForStorage.gmaoStorage) {
    const driver = (process.env.STORAGE_DRIVER ?? "local").toLowerCase();
    if (driver === "s3") globalForStorage.gmaoStorage = createS3Storage();
    else if (driver === "local") {
      if (process.env.VERCEL)
        throw new Error("Stockage des documents : le disque de Vercel est en lecture seule, configurer STORAGE_DRIVER=s3 et les variables S3_*.");
      globalForStorage.gmaoStorage = createLocalStorage(process.env.STORAGE_LOCAL_DIR ?? "./storage");
    } else throw new Error(`STORAGE_DRIVER inconnu : ${driver} (attendu : local ou s3).`);
  }
  return globalForStorage.gmaoStorage;
}

/** Clé de stockage : cloisonnée par groupe, sans aucune donnée saisie par l'utilisateur. */
export function storageKey(tenantId: string, entityType: string, entityId: string, documentId: string) {
  return `${tenantId}/${entityType.toLowerCase()}/${entityId}/${documentId}`;
}
