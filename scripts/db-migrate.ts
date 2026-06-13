import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required. Use your Supabase direct Postgres connection string.");
  }

  const sql = readFileSync(join(process.cwd(), "drizzle/0000_reset.sql"), "utf8");
  const db = postgres(url, { prepare: false, max: 1 });

  console.log("Applying drizzle/0000_reset.sql ...");
  await db.unsafe(sql);
  await db.end();
  console.log("Migration complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
