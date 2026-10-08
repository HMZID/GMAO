/**
 * Applique les migrations SQL du dossier `drizzle/` (npm run db:migrate).
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "./drizzle" });
  await pool.end();
  console.log("Migrations appliquées.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
