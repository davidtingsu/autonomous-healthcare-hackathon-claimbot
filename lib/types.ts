export type ActorRole = "user" | "benefits_company" | "insurance_company";

export type ClaimRequestStatus =
  | "created"
  | "reviewing"
  | "cancelled_for_submission"
  | "revision_requested"
  | "submitted";

export type InsuranceClaimStatus = "created" | "approved" | "denied";

export type NotificationType =
  | "revision_requested"
  | "cancelled_for_submission"
  | "claim_matched_approved"
  | "claim_matched_denied";

export type BenefitsAction = "revise" | "submit" | "cancel";
export type InsuranceAction = "approve" | "deny";

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  primary_id: string | null;
  created_at?: string;
}

export interface ClaimRequest {
  id: string;
  user_id: string;
  claimed_amount: number;
  service_date: string;
  receipt_url: string | null;
  receipt_extracted_patient_name: string | null;
  receipt_extracted_amount: number | null;
  receipt_extracted_date: string | null;
  status: ClaimRequestStatus;
  graph_thread_id: string;
  created_at: string;
  updated_at: string;
  users?: User;
  insurance_claim?: InsuranceClaim | null;
}

export interface InsuranceClaim {
  id: string;
  claim_request_id: string;
  claimed_amount: number;
  service_date: string;
  status: InsuranceClaimStatus;
  created_at: string;
  updated_at: string;
}

export interface ClaimEvent {
  id: string;
  claim_request_id: string;
  event_type: string;
  actor_role: ActorRole | "system";
  payload: Record<string, unknown>;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  claim_request_id: string;
  type: NotificationType;
  message: string;
  read: boolean;
  created_at: string;
}

export interface ClaimGraphState {
  claimRequestId: string;
  userId: string;
  claimedAmount: number;
  serviceDate: string;
  claimStatus: ClaimRequestStatus;
  receiptUrl?: string | null;
  insuranceClaimId?: string;
  insuranceStatus?: InsuranceClaimStatus;
  aiValidationResult?: Record<string, unknown>;
  hitlDecision?: BenefitsAction;
  insuranceDecision?: InsuranceAction;
  matchResult?: "approved" | "denied";
  phase?: string;
}

export const EVENT_TO_NODE: Record<string, string> = {
  claim_created: "created",
  enters_benefits_review: "benefits_hitl",
  receipt_validation_started: "benefits_hitl",
  receipt_validation_passed: "benefits_hitl",
  receipt_validation_failed: "benefits_hitl",
  receipt_validation_faked: "benefits_hitl",
  benefits_updated_claim: "benefits_hitl",
  benefits_requests_revision: "revision",
  benefits_cancels_for_submission: "cancelled",
  benefits_submits_to_insurance: "submitted",
  insurance_claim_created: "insurance_processing",
  insurance_review_required: "insurance_hitl",
  insurance_approved: "insurance_hitl",
  insurance_denied: "insurance_hitl",
  claim_matched_approved: "notified",
  claim_matched_denied: "notified",
  match_complete: "notified",
};

import { DEMO_USER_IDS } from "@/lib/db/constants";

export const DEMO_SUBSCRIBERS = [
  DEMO_USER_IDS.john,
  DEMO_USER_IDS.jane,
];

export const STATUS_BADGE_CLASS: Record<string, string> = {
  created: "bg-slate-800 text-slate-400 border-slate-700",
  reviewing: "bg-amber-950/50 text-amber-400 border-amber-800",
  revision_requested: "bg-orange-950/50 text-orange-400 border-orange-800",
  submitted: "bg-blue-950/50 text-blue-400 border-blue-800",
  cancelled_for_submission: "bg-red-950/50 text-red-400 border-red-800",
  approved: "bg-emerald-950/50 text-emerald-400 border-emerald-800",
  denied: "bg-rose-950/50 text-rose-400 border-rose-800",
};
