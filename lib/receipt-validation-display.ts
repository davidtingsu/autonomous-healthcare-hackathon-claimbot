import type { ReceiptValidationResult } from "@/lib/ai/receipt-validator";
import type { ClaimEvent, ClaimRequest } from "@/lib/types";
import {
  amountsMatch,
  datesMatch,
  patientNamesMatch,
} from "@/lib/ai/receipt-validator";

export type ReceiptValidationIssue = {
  field: "patientName" | "amount" | "date";
  kind: "missing" | "mismatch";
  message: string;
};

export function buildValidationIssuesFromResult(
  result: Pick<
    ReceiptValidationResult,
    | "extractedPatientName"
    | "extractedAmount"
    | "extractedDate"
    | "expectedPatientName"
    | "patientNameMatch"
    | "amountMatch"
    | "dateMatch"
    | "reasons"
  >,
  claim: Pick<ClaimRequest, "claimed_amount" | "service_date">
): ReceiptValidationIssue[] {
  const issues: ReceiptValidationIssue[] = [];

  const nameMissing = !result.extractedPatientName?.trim();
  const amountMissing =
    result.extractedAmount == null || Number.isNaN(Number(result.extractedAmount));
  const dateMissing = !result.extractedDate?.trim();

  if (nameMissing) {
    issues.push({
      field: "patientName",
      kind: "missing",
      message: "Patient name could not be read from the receipt scan.",
    });
  } else if (!result.patientNameMatch) {
    issues.push({
      field: "patientName",
      kind: "mismatch",
      message: `Patient name mismatch: receipt "${result.extractedPatientName}" vs claim "${result.expectedPatientName}".`,
    });
  }

  if (amountMissing) {
    issues.push({
      field: "amount",
      kind: "missing",
      message: "Amount could not be read from the receipt scan.",
    });
  } else if (!result.amountMatch) {
    issues.push({
      field: "amount",
      kind: "mismatch",
      message: `Amount mismatch: receipt $${Number(result.extractedAmount).toFixed(2)} vs claim $${Number(claim.claimed_amount).toFixed(2)}.`,
    });
  }

  if (dateMissing) {
    issues.push({
      field: "date",
      kind: "missing",
      message: "Service date could not be read from the receipt scan.",
    });
  } else if (!result.dateMatch) {
    issues.push({
      field: "date",
      kind: "mismatch",
      message: `Service date mismatch: receipt ${result.extractedDate} vs claim ${String(claim.service_date).slice(0, 10)}.`,
    });
  }

  return issues;
}

export function buildValidationIssuesFromClaim(
  claim: ClaimRequest,
  expectedPatientName: string
): ReceiptValidationIssue[] {
  const extractedName = claim.receipt_extracted_patient_name ?? "";
  const extractedAmount = claim.receipt_extracted_amount;
  const extractedDate = claim.receipt_extracted_date
    ? String(claim.receipt_extracted_date).slice(0, 10)
    : "";

  const hasScan =
    extractedName !== "" ||
    extractedAmount != null ||
    claim.receipt_extracted_date != null;

  if (!hasScan) return [];

  return buildValidationIssuesFromResult(
    {
      extractedPatientName: extractedName,
      extractedAmount: extractedAmount != null ? Number(extractedAmount) : NaN,
      extractedDate,
      expectedPatientName,
      patientNameMatch:
        Boolean(extractedName.trim()) &&
        patientNamesMatch(extractedName, expectedPatientName),
      amountMatch:
        extractedAmount != null &&
        amountsMatch(Number(extractedAmount), Number(claim.claimed_amount)),
      dateMatch:
        Boolean(extractedDate) &&
        datesMatch(extractedDate, String(claim.service_date)),
      reasons: [],
    },
    claim
  );
}

export function validationIssuesFromEventPayload(
  payload: Record<string, unknown>,
  claim: ClaimRequest,
  expectedPatientName: string
): ReceiptValidationIssue[] {
  if (payload.passed === true) return [];

  return buildValidationIssuesFromResult(
    {
      extractedPatientName: String(payload.extractedPatientName ?? ""),
      extractedAmount: Number(payload.extractedAmount),
      extractedDate: String(payload.extractedDate ?? ""),
      expectedPatientName: String(payload.expectedPatientName ?? expectedPatientName),
      patientNameMatch: Boolean(payload.patientNameMatch),
      amountMatch: Boolean(payload.amountMatch),
      dateMatch: Boolean(payload.dateMatch),
      reasons: (payload.reasons as string[]) ?? [],
    },
    claim
  );
}

export type ClaimValidationState = {
  scanning: boolean;
  passed: boolean;
  mode: "live" | "faked" | null;
  issues: ReceiptValidationIssue[];
};

export function getClaimValidationState(
  claim: ClaimRequest,
  events: ClaimEvent[],
  expectedPatientName: string
): ClaimValidationState {
  const claimEvents = events
    .filter(
      (event) =>
        event.claim_request_id === claim.id &&
        event.event_type.startsWith("receipt_validation")
    )
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  const latest = claimEvents[0];

  if (latest?.event_type === "receipt_validation_started") {
    const hasOutcome = claimEvents.some(
      (event) =>
        event.event_type === "receipt_validation_passed" ||
        event.event_type === "receipt_validation_failed" ||
        event.event_type === "receipt_validation_faked"
    );
    if (!hasOutcome) {
      return { scanning: true, passed: false, mode: null, issues: [] };
    }
  }

  const outcome = claimEvents.find(
    (event) =>
      event.event_type === "receipt_validation_passed" ||
      event.event_type === "receipt_validation_failed" ||
      event.event_type === "receipt_validation_faked"
  );

  if (outcome) {
    const payload = outcome.payload ?? {};
    const passed = outcome.event_type === "receipt_validation_passed";
    const issues = passed
      ? []
      : validationIssuesFromEventPayload(
          payload as Record<string, unknown>,
          claim,
          expectedPatientName
        );

    return {
      scanning: false,
      passed,
      mode: (payload.mode as "live" | "faked" | undefined) ?? null,
      issues,
    };
  }

  const issues = buildValidationIssuesFromClaim(claim, expectedPatientName);
  return {
    scanning: false,
    passed: issues.length === 0 && Boolean(claim.receipt_extracted_patient_name),
    mode: null,
    issues,
  };
}
