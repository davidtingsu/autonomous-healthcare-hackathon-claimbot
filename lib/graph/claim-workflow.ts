import { Annotation, Command, END, START, StateGraph, interrupt } from "@langchain/langgraph";
import type { SupabaseClient } from "@supabase/supabase-js";
import { validateReceipt } from "@/lib/ai/receipt-validator";
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

export function buildClaimWorkflow(supabase: SupabaseClient) {
  async function enterBenefitsReview(state: State) {
    await updateClaimStatus(supabase, state.claimRequestId, "reviewing");
    await emitEvent(
      supabase,
      state.claimRequestId,
      "enters_benefits_review",
      "system"
    );
    return { claimStatus: "reviewing", phase: "benefits_review" };
  }

  async function benefitsHITL(state: State) {
    const claim = await getClaimWithUser(supabase, state.claimRequestId);
    const user = claim.users as { first_name: string; last_name: string };

    await emitEvent(
      supabase,
      state.claimRequestId,
      "receipt_validation_started",
      "system"
    );

    const validation = await validateReceipt({
      claimedAmount: Number(claim.claimed_amount),
      serviceDate: claim.service_date,
      expectedPatientName: userFullName(user),
      receiptUrl: claim.receipt_url,
    });

    await supabase
      .from("claim_requests")
      .update({
        receipt_extracted_patient_name: validation.extractedPatientName,
        receipt_extracted_amount: validation.extractedAmount,
        receipt_extracted_date: validation.extractedDate,
      })
      .eq("id", state.claimRequestId);

    const validationEvent = validation.mode === "faked"
      ? "receipt_validation_faked"
      : validation.passed
        ? "receipt_validation_passed"
        : "receipt_validation_failed";

    await emitEvent(supabase, state.claimRequestId, validationEvent, "system", {
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
      await updateClaimStatus(supabase, state.claimRequestId, "revision_requested");
      await emitEvent(
        supabase,
        state.claimRequestId,
        "benefits_requests_revision",
        "benefits_company"
      );
      await emitNotification(
        supabase,
        state.userId,
        state.claimRequestId,
        "revision_requested",
        NOTIFICATION_MESSAGES.revision_requested
      );
      return { claimStatus: "revision_requested", phase: "revision" };
    }

    if (action === "cancel") {
      await updateClaimStatus(
        supabase,
        state.claimRequestId,
        "cancelled_for_submission"
      );
      await emitEvent(
        supabase,
        state.claimRequestId,
        "benefits_cancels_for_submission",
        "benefits_company"
      );
      await emitNotification(
        supabase,
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
    const claim = await getClaimWithUser(supabase, state.claimRequestId);
    await updateClaimStatus(supabase, state.claimRequestId, "submitted");
    await emitEvent(
      supabase,
      state.claimRequestId,
      "benefits_submits_to_insurance",
      "benefits_company"
    );

    const { data: insuranceClaim, error } = await supabase
      .from("insurance_claims")
      .insert({
        claim_request_id: state.claimRequestId,
        claimed_amount: claim.claimed_amount,
        service_date: claim.service_date,
        status: "created",
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    await emitEvent(
      supabase,
      state.claimRequestId,
      "insurance_claim_created",
      "system",
      { insuranceClaimId: insuranceClaim.id }
    );
    await emitEvent(
      supabase,
      state.claimRequestId,
      "insurance_review_required",
      "system"
    );

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
    await supabase
      .from("insurance_claims")
      .update({ status })
      .eq("id", state.insuranceClaimId);

    await emitEvent(
      supabase,
      state.claimRequestId,
      action === "approve" ? "insurance_approved" : "insurance_denied",
      "insurance_company",
      { insuranceClaimId: state.insuranceClaimId }
    );

    return { insuranceStatus: status, phase: "matching" };
  }

  async function matchAndNotify(state: State) {
    const claim = await getClaimWithUser(supabase, state.claimRequestId);
    const { data: insuranceClaim } = await supabase
      .from("insurance_claims")
      .select("*")
      .eq("claim_request_id", state.claimRequestId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const amountsAlign =
      insuranceClaim &&
      Math.abs(Number(insuranceClaim.claimed_amount) - Number(claim.claimed_amount)) < 0.01;
    const datesAlign =
      insuranceClaim && insuranceClaim.service_date === claim.service_date;
    const insuranceApproved = insuranceClaim?.status === "approved";
    const matched = Boolean(amountsAlign && datesAlign && insuranceApproved);

    const eventType = matched ? "claim_matched_approved" : "claim_matched_denied";
    const notificationType = matched
      ? "claim_matched_approved"
      : "claim_matched_denied";

    await emitEvent(supabase, state.claimRequestId, eventType, "system", {
      matched,
      amountsAlign,
      datesAlign,
      insuranceApproved,
    });
    await emitEvent(supabase, state.claimRequestId, "match_complete", "system");
    await emitNotification(
      supabase,
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
  supabase: SupabaseClient,
  state: ClaimGraphState,
  threadId: string
) {
  const graph = buildClaimWorkflow(supabase);
  const config = { configurable: { thread_id: threadId } };
  return graph.invoke(state, config);
}

export async function resumeBenefitsReview(
  supabase: SupabaseClient,
  threadId: string,
  action: BenefitsAction
) {
  const graph = buildClaimWorkflow(supabase);
  const config = { configurable: { thread_id: threadId } };
  return graph.invoke(new Command({ resume: action }), config);
}

export async function resumeInsuranceReview(
  supabase: SupabaseClient,
  threadId: string,
  action: InsuranceAction
) {
  const graph = buildClaimWorkflow(supabase);
  const config = { configurable: { thread_id: threadId } };
  return graph.invoke(new Command({ resume: action }), config);
}

export function getCompiledGraph(supabase: SupabaseClient) {
  return buildClaimWorkflow(supabase);
}
