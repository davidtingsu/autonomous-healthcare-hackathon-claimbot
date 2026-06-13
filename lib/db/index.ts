import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";

let client: ReturnType<typeof postgres> | null = null;
let database: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!database) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is required for database access");
    }
    client = postgres(url, { prepare: false, max: 10 });
    database = drizzle(client, { schema });
  }
  return database;
}

export async function closeDb() {
  if (client) {
    await client.end();
    client = null;
    database = null;
  }
}

export { schema };
