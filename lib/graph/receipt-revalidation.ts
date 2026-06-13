import {
  normalizeExtractedDate,
  validateReceipt,
  type ReceiptValidationResult,
} from "@/lib/ai/receipt-validator";
import { getDb, schema } from "@/lib/db";
import { emitEvent, getClaimWithUser } from "@/lib/graph/events";
import { eq } from "drizzle-orm";

const { claimRequests } = schema;

function userFullName(user: { first_name: string; last_name: string }) {
  return `${user.first_name} ${user.last_name}`;
}

export async function revalidateClaimReceipt(
  claimRequestId: string
): Promise<ReceiptValidationResult> {
  const claim = await getClaimWithUser(claimRequestId);
  const user = claim.users as { first_name: string; last_name: string };

  await emitEvent(claimRequestId, "receipt_validation_started", "system");

  const validation = await validateReceipt({
    claimedAmount: Number(claim.claimed_amount),
    serviceDate: String(claim.service_date),
    expectedPatientName: userFullName(user),
    receiptUrl: claim.receipt_url,
  });

  const db = getDb();
  await db
    .update(claimRequests)
    .set({
      receipt_extracted_patient_name: validation.extractedPatientName || null,
      receipt_extracted_amount: validation.extractedAmount
        ? String(validation.extractedAmount)
        : null,
      receipt_extracted_date: normalizeExtractedDate(validation.extractedDate),
      updated_at: new Date(),
    })
    .where(eq(claimRequests.id, claimRequestId));

  const validationEvent = validation.mode === "faked"
    ? "receipt_validation_faked"
    : validation.passed
      ? "receipt_validation_passed"
      : "receipt_validation_failed";

  await emitEvent(claimRequestId, validationEvent, "system", {
    ...validation,
  });

  return validation;
}
