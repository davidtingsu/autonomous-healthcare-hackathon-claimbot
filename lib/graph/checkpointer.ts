import { MemorySaver } from "@langchain/langgraph-checkpoint";
import type { SupabaseClient } from "@supabase/supabase-js";

const memorySaver = new MemorySaver();

export function getCheckpointer() {
  return memorySaver;
}

export async function saveCheckpointToDb(
  supabase: SupabaseClient,
  threadId: string,
  checkpoint: Record<string, unknown>
) {
  const { error } = await supabase.from("langgraph_checkpoints").upsert({
    thread_id: threadId,
    checkpoint,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function loadCheckpointFromDb(
  supabase: SupabaseClient,
  threadId: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("langgraph_checkpoints")
    .select("checkpoint")
    .eq("thread_id", threadId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.checkpoint as Record<string, unknown>) ?? null;
}
