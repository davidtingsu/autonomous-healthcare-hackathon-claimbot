import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

const globalForCheckpointer = globalThis as unknown as {
  __claimbotCheckpointer?: PostgresSaver;
  __claimbotCheckpointerSetup?: Promise<void>;
};

export function getCheckpointer(): PostgresSaver {
  if (!globalForCheckpointer.__claimbotCheckpointer) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is required for the LangGraph checkpointer");
    }
    globalForCheckpointer.__claimbotCheckpointer =
      PostgresSaver.fromConnString(url);
  }
  return globalForCheckpointer.__claimbotCheckpointer;
}

export function ensureCheckpointerReady(): Promise<void> {
  if (!globalForCheckpointer.__claimbotCheckpointerSetup) {
    globalForCheckpointer.__claimbotCheckpointerSetup = getCheckpointer().setup();
  }
  return globalForCheckpointer.__claimbotCheckpointerSetup;
}
