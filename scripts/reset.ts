/**
 * Vide entièrement la base de développement (schéma public et journal des migrations).
 * Usage : npm run db:reset (enchaîne reset, migrations et données de démonstration).
 */
import "dotenv/config";
import { Pool } from "pg";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (process.env.NODE_ENV === "production" || /prod/i.test(url)) {
    throw new Error("Refus de vider une base qui semble être de production.");
  }
  const pool = new Pool({ connectionString: url });
  await pool.query("drop schema if exists public cascade; create schema public; drop schema if exists drizzle cascade;");
  await pool.end();
  console.log("Base vidée.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
