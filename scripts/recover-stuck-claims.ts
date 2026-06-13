import crypto from "node:crypto";
import postgres from "postgres";
import { runBenefitsReview } from "@/lib/graph/claim-workflow";
import { ensureCheckpointerReady } from "@/lib/graph/checkpointer";

/**
 * Recovers "zombie" claims stuck in `reviewing` that have no durable LangGraph
 * interrupt checkpoint (metadata.source = 'loop') for their thread.
 *
 * These were created before the durable PostgresSaver existed (or crashed inside
 * benefitsHITL before reaching interrupt()), so "Submit to insurance" has nothing
 * to resume into. We assign a fresh thread id and re-run the benefits review so
 * the graph reaches a real interrupt() and becomes submittable again.
 *
 * Safe + idempotent: only touches `reviewing` claims whose thread lacks a 'loop'
 * checkpoint. Re-running it after a successful recovery is a no-op.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  // Ensure the checkpointer tables exist before we query them.
  await ensureCheckpointerReady();

  const sql = postgres(url, { prepare: false, max: 2 });

  const zombies = await sql<
    {
      id: string;
      user_id: string;
      claimed_amount: string;
      service_date: string | Date;
      receipt_url: string | null;
      graph_thread_id: string;
    }[]
  >`
    select cr.id, cr.user_id, cr.claimed_amount, cr.service_date,
           cr.receipt_url, cr.graph_thread_id
    from claim_requests cr
    where cr.status = 'reviewing'
      and not exists (
        select 1 from checkpoints c
        where c.thread_id = cr.graph_thread_id
          and c.metadata->>'source' = 'loop'
      )
    order by cr.created_at asc
  `;

  if (zombies.length === 0) {
    console.log("No stuck claims found. Nothing to recover.");
    await sql.end();
    return;
  }

  console.log(`Found ${zombies.length} stuck claim(s) to recover:\n`);

  for (const claim of zombies) {
    const serviceDate =
      claim.service_date instanceof Date
        ? claim.service_date.toISOString().slice(0, 10)
        : String(claim.service_date).slice(0, 10);

    const newThreadId = crypto.randomUUID();
    console.log(
      `- Claim ${claim.id}: assigning fresh thread ${newThreadId} and re-running benefits review...`
    );

    await sql`
      update claim_requests
      set graph_thread_id = ${newThreadId}, updated_at = now()
      where id = ${claim.id}
    `;

    await runBenefitsReview(
      {
        claimRequestId: claim.id,
        userId: claim.user_id,
        claimedAmount: Number(claim.claimed_amount),
        serviceDate,
        claimStatus: "created",
        receiptUrl: claim.receipt_url,
      },
      newThreadId
    );

    const [after] = await sql<{ status: string; has_loop: boolean }[]>`
      select cr.status,
             exists(
               select 1 from checkpoints c
               where c.thread_id = ${newThreadId}
                 and c.metadata->>'source' = 'loop'
             ) as has_loop
      from claim_requests cr where cr.id = ${claim.id}
    `;

    const ok = after?.has_loop ? "OK (interrupt checkpoint created)" : "STILL BROKEN";
    console.log(`    -> status=${after?.status} has_loop=${after?.has_loop} [${ok}]\n`);
  }

  await sql.end();
  console.log("Recovery complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
