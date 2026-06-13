import { eq } from "drizzle-orm";
import { MemorySaver } from "@langchain/langgraph-checkpoint";
import { getDb, schema } from "@/lib/db";

const { langgraphCheckpoints } = schema;
const memorySaver = new MemorySaver();

export function getCheckpointer() {
  return memorySaver;
}

export async function saveCheckpointToDb(
  threadId: string,
  checkpoint: Record<string, unknown>
) {
  const db = getDb();
  await db
    .insert(langgraphCheckpoints)
    .values({
      thread_id: threadId,
      checkpoint,
      updated_at: new Date(),
    })
    .onConflictDoUpdate({
      target: langgraphCheckpoints.thread_id,
      set: {
        checkpoint,
        updated_at: new Date(),
      },
    });
}

export async function loadCheckpointFromDb(
  threadId: string
): Promise<Record<string, unknown> | null> {
  const db = getDb();
  const [row] = await db
    .select({ checkpoint: langgraphCheckpoints.checkpoint })
    .from(langgraphCheckpoints)
    .where(eq(langgraphCheckpoints.thread_id, threadId))
    .limit(1);
  return (row?.checkpoint as Record<string, unknown>) ?? null;
}
