import { Annotation, Command, END, START, StateGraph, interrupt } from "@langchain/langgraph";
import { desc, eq } from "drizzle-orm";
import { validateReceipt } from "@/lib/ai/receipt-validator";
import { getDb, schema } from "@/lib/db";
import {
  emitEvent,
  emitNotification,
  getClaimWithUser,
  NOTIFICATION_MESSAGES,
  updateClaimStatus,
} from "@/lib/graph/events";
import { getCheckpointer } from "@/lib/graph/checkpointer";
import type {
  BenefitsAction,
  ClaimGraphState,
  InsuranceAction,
} from "@/lib/types";

const { claimRequests, insuranceClaims } = schema;

export const ClaimStateAnnotation = Annotation.Root({
  claimRequestId: Annotation<string>,
  userId: Annotation<string>,
  claimedAmount: Annotation<number>,
  serviceDate: Annotation<string>,
  claimStatus: Annotation<string>,
  receiptUrl: Annotation<string | null>,
  insuranceClaimId: Annotation<string | undefined>,
  insuranceStatus: Annotation<string | undefined>,
  aiValidationResult: Annotation<Record<string, unknown> | undefined>,
  hitlDecision: Annotation<BenefitsAction | undefined>,
  insuranceDecision: Annotation<InsuranceAction | undefined>,
  matchResult: Annotation<"approved" | "denied" | undefined>,
  phase: Annotation<string | undefined>,
});

type State = typeof ClaimStateAnnotation.State;

function userFullName(user: { first_name: string; last_name: string }) {
  return `${user.first_name} ${user.last_name}`;
}

export function buildClaimWorkflow() {
  async function enterBenefitsReview(state: State) {
    await updateClaimStatus(state.claimRequestId, "reviewing");
    await emitEvent(state.claimRequestId, "enters_benefits_review", "system");
    return { claimStatus: "reviewing", phase: "benefits_review" };
  }

  async function benefitsHITL(state: State) {
    const claim = await getClaimWithUser(state.claimRequestId);
    const user = claim.users as { first_name: string; last_name: string };

    await emitEvent(state.claimRequestId, "receipt_validation_started", "system");

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
        receipt_extracted_patient_name: validation.extractedPatientName,
        receipt_extracted_amount: String(validation.extractedAmount),
        receipt_extracted_date: validation.extractedDate,
        updated_at: new Date(),
      })
      .where(eq(claimRequests.id, state.claimRequestId));

    const validationEvent = validation.mode === "faked"
      ? "receipt_validation_faked"
      : validation.passed
        ? "receipt_validation_passed"
        : "receipt_validation_failed";

    await emitEvent(state.claimRequestId, validationEvent, "system", {
      ...validation,
    });

    const decision = interrupt({
      type: "benefits_review",
      claimRequestId: state.claimRequestId,
      validation,
    }) as BenefitsAction;

    return {
      hitlDecision: decision,
      aiValidationResult: validation as unknown as Record<string, unknown>,
      phase: "benefits_hitl",
    };
  }

  async function applyBenefitsDecision(state: State) {
    const action = state.hitlDecision;
    if (!action) throw new Error("Missing benefits HITL decision");

    if (action === "revise") {
      await updateClaimStatus(state.claimRequestId, "revision_requested");
      await emitEvent(
        state.claimRequestId,
        "benefits_requests_revision",
        "benefits_company"
      );
      await emitNotification(
        state.userId,
        state.claimRequestId,
        "revision_requested",
        NOTIFICATION_MESSAGES.revision_requested
      );
      return { claimStatus: "revision_requested", phase: "revision" };
    }

    if (action === "cancel") {
      await updateClaimStatus(state.claimRequestId, "cancelled_for_submission");
      await emitEvent(
        state.claimRequestId,
        "benefits_cancels_for_submission",
        "benefits_company"
      );
      await emitNotification(
        state.userId,
        state.claimRequestId,
        "cancelled_for_submission",
        NOTIFICATION_MESSAGES.cancelled_for_submission
      );
      return { claimStatus: "cancelled_for_submission", phase: "cancelled" };
    }

    return { phase: "submit" };
  }

  async function submitToInsurance(state: State) {
    const claim = await getClaimWithUser(state.claimRequestId);
    await updateClaimStatus(state.claimRequestId, "submitted");
    await emitEvent(
      state.claimRequestId,
      "benefits_submits_to_insurance",
      "benefits_company"
    );

    const db = getDb();
    const [insuranceClaim] = await db
      .insert(insuranceClaims)
      .values({
        claim_request_id: state.claimRequestId,
        claimed_amount: String(claim.claimed_amount),
        service_date: String(claim.service_date),
        status: "created",
      })
      .returning();

    if (!insuranceClaim) throw new Error("Failed to create insurance claim");

    await emitEvent(state.claimRequestId, "insurance_claim_created", "system", {
      insuranceClaimId: insuranceClaim.id,
    });
    await emitEvent(state.claimRequestId, "insurance_review_required", "system");

    return {
      claimStatus: "submitted",
      insuranceClaimId: insuranceClaim.id,
      insuranceStatus: "created",
      phase: "insurance_processing",
    };
  }

  async function insuranceHITL(state: State) {
    const decision = interrupt({
      type: "insurance_review",
      claimRequestId: state.claimRequestId,
      insuranceClaimId: state.insuranceClaimId,
    }) as InsuranceAction;

    return { insuranceDecision: decision, phase: "insurance_hitl" };
  }

  async function applyInsuranceDecision(state: State) {
    const action = state.insuranceDecision;
    if (!action || !state.insuranceClaimId) {
      throw new Error("Missing insurance decision");
    }

    const status = action === "approve" ? "approved" : "denied";
    const db = getDb();
    await db
      .update(insuranceClaims)
      .set({ status, updated_at: new Date() })
      .where(eq(insuranceClaims.id, state.insuranceClaimId));

    await emitEvent(
      state.claimRequestId,
      action === "approve" ? "insurance_approved" : "insurance_denied",
      "insurance_company",
      { insuranceClaimId: state.insuranceClaimId }
    );

    return { insuranceStatus: status, phase: "matching" };
  }

  async function matchAndNotify(state: State) {
    const claim = await getClaimWithUser(state.claimRequestId);
    const db = getDb();
    const [insuranceClaim] = await db
      .select()
      .from(insuranceClaims)
      .where(eq(insuranceClaims.claim_request_id, state.claimRequestId))
      .orderBy(desc(insuranceClaims.created_at))
      .limit(1);

    const amountsAlign =
      insuranceClaim &&
      Math.abs(Number(insuranceClaim.claimed_amount) - Number(claim.claimed_amount)) < 0.01;
    const datesAlign =
      insuranceClaim && String(insuranceClaim.service_date) === String(claim.service_date);
    const insuranceApproved = insuranceClaim?.status === "approved";
    const matched = Boolean(amountsAlign && datesAlign && insuranceApproved);

    const eventType = matched ? "claim_matched_approved" : "claim_matched_denied";
    const notificationType = matched
      ? "claim_matched_approved"
      : "claim_matched_denied";

    await emitEvent(state.claimRequestId, eventType, "system", {
      matched,
      amountsAlign,
      datesAlign,
      insuranceApproved,
    });
    await emitEvent(state.claimRequestId, "match_complete", "system");
    await emitNotification(
      state.userId,
      state.claimRequestId,
      notificationType,
      NOTIFICATION_MESSAGES[notificationType]
    );

    return {
      matchResult: matched ? "approved" : "denied",
      phase: "notified",
    };
  }

  function routeBenefitsDecision(state: State) {
    if (state.hitlDecision === "submit") return "submitToInsurance";
    if (state.hitlDecision === "revise" || state.hitlDecision === "cancel") {
      return END;
    }
    return END;
  }

  const graph = new StateGraph(ClaimStateAnnotation)
    .addNode("enterBenefitsReview", enterBenefitsReview)
    .addNode("benefitsHITL", benefitsHITL)
    .addNode("applyBenefitsDecision", applyBenefitsDecision)
    .addNode("submitToInsurance", submitToInsurance)
    .addNode("insuranceHITL", insuranceHITL)
    .addNode("applyInsuranceDecision", applyInsuranceDecision)
    .addNode("matchAndNotify", matchAndNotify)
    .addEdge(START, "enterBenefitsReview")
    .addEdge("enterBenefitsReview", "benefitsHITL")
    .addEdge("benefitsHITL", "applyBenefitsDecision")
    .addConditionalEdges("applyBenefitsDecision", routeBenefitsDecision, {
      submitToInsurance: "submitToInsurance",
      [END]: END,
    })
    .addEdge("submitToInsurance", "insuranceHITL")
    .addEdge("insuranceHITL", "applyInsuranceDecision")
    .addEdge("applyInsuranceDecision", "matchAndNotify")
    .addEdge("matchAndNotify", END);

  return graph.compile({ checkpointer: getCheckpointer() });
}

export async function runBenefitsReview(
  state: ClaimGraphState,
  threadId: string
) {
  const graph = buildClaimWorkflow();
  const config = { configurable: { thread_id: threadId } };
  return graph.invoke(state, config);
}

export async function resumeBenefitsReview(
  threadId: string,
  action: BenefitsAction
) {
  const graph = buildClaimWorkflow();
  const config = { configurable: { thread_id: threadId } };
  return graph.invoke(new Command({ resume: action }), config);
}

export async function resumeInsuranceReview(
  threadId: string,
  action: InsuranceAction
) {
  const graph = buildClaimWorkflow();
  const config = { configurable: { thread_id: threadId } };
  return graph.invoke(new Command({ resume: action }), config);
}

export function getCompiledGraph() {
  return buildClaimWorkflow();
}
