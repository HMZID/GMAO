import "server-only";
import { createReadStream } from "node:fs";
import { mkdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NotFoundError } from "@/server/errors";
import type { FileStorage } from "./index";

/** Pilote disque local : un fichier par clé sous le répertoire racine, écrit de façon atomique. */
export function createLocalStorage(rootDir: string): FileStorage {
  const root = path.resolve(rootDir);

  const resolve = (key: string) => {
    const full = path.resolve(root, key);
    // Défense en profondeur : une clé ne sort jamais du répertoire racine.
    if (!full.startsWith(root + path.sep)) throw new Error("Clé de stockage invalide.");
    return full;
  };

  return {
    driver: "local",

    async put(key, data) {
      const full = resolve(key);
      await mkdir(path.dirname(full), { recursive: true });
      const temp = `${full}.${process.pid}.tmp`;
      await writeFile(temp, data, { flag: "wx" });
      await rename(temp, full);
    },

    async get(key) {
      const full = resolve(key);
      const info = await stat(full).catch(() => null);
      if (!info?.isFile()) throw new NotFoundError("Fichier");
      return { body: Readable.toWeb(createReadStream(full)) as ReadableStream<Uint8Array>, size: info.size };
    },

    async remove(key) {
      await unlink(resolve(key)).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    },
  };
}
