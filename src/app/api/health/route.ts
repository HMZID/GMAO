import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/server/db";

/** Sonde de disponibilité (TEC-08) : vérifie l'accès à la base. */
export async function GET() {
  await connection();
  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok", time: new Date().toISOString() });
  } catch {
    return Response.json({ status: "error" }, { status: 503 });
  }
}
