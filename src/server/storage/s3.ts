import "server-only";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { NotFoundError } from "@/server/errors";
import type { FileStorage } from "./index";

/**
 * Pilote compatible S3. Variables : S3_BUCKET, S3_REGION, S3_ENDPOINT (Scaleway, OVH, SeaweedFS, Garage…),
 * S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_FORCE_PATH_STYLE (true pour SeaweedFS, Garage…),
 * S3_AUTO_CREATE_BUCKET (true en développement : crée le compartiment s'il n'existe pas).
 * Le compartiment reste privé : aucun lien public, les fichiers passent par l'API (TEC-06).
 */
export function createS3Storage(): FileStorage {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET est obligatoire avec STORAGE_DRIVER=s3.");

  const client = new S3Client({
    region: process.env.S3_REGION ?? "eu-west-3",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials:
      process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
        : undefined,
  });
  // Chiffrement au repos (TEC-06) ; désactivable pour un service qui ne le prend pas en charge.
  const encryption = process.env.S3_SERVER_SIDE_ENCRYPTION === "none" ? undefined : "AES256";

  let bucketReady: Promise<void> | null = null;
  const ensureBucket = () =>
    (bucketReady ??= (async () => {
      if (process.env.S3_AUTO_CREATE_BUCKET !== "true") return;
      try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }));
      } catch {
        await client.send(new CreateBucketCommand({ Bucket: bucket }));
      }
    })().catch((error) => {
      bucketReady = null;
      throw error;
    }));

  return {
    driver: "s3",

    async put(key, data, contentType) {
      await ensureBucket();
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: data, ContentType: contentType, ServerSideEncryption: encryption }));
    },

    async get(key) {
      try {
        const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        if (!result.Body) throw new NotFoundError("Fichier");
        return { body: result.Body.transformToWebStream() as ReadableStream<Uint8Array>, size: result.ContentLength ?? 0 };
      } catch (error) {
        if (error instanceof NoSuchKey) throw new NotFoundError("Fichier");
        throw error;
      }
    },

    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}
