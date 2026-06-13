import type {
  ActorRole,
  ClaimEvent,
  ClaimRequest,
  Notification,
  NotificationType,
} from "@/lib/types";

export function filterEventsForActor(
  events: ClaimEvent[],
  claims: ClaimRequest[],
  actor: ActorRole,
  userId?: string
): ClaimEvent[] {
  const claimMap = new Map(claims.map((c) => [c.id, c]));

  return events.filter((event) => {
    const claim = claimMap.get(event.claim_request_id);
    if (!claim) return false;

    if (actor === "benefits_company") {
      return [
        "created",
        "reviewing",
        "revision_requested",
        "submitted",
        "cancelled_for_submission",
      ].includes(claim.status);
    }

    if (actor === "insurance_company") {
      return (
        event.event_type.includes("insurance") ||
        event.event_type.includes("match") ||
        claim.status === "submitted"
      );
    }

    if (actor === "user" && userId) {
      return claim.user_id === userId || event.actor_role === "user";
    }

    return false;
  });
}

export function filterNotificationsForUser(
  notifications: Notification[],
  userId: string
): Notification[] {
  return notifications.filter((n) => n.user_id === userId);
}

export function notificationTypeLabel(type: NotificationType): string {
  const labels: Record<NotificationType, string> = {
    revision_requested: "Revision requested",
    cancelled_for_submission: "Cancelled for submission",
    claim_matched_approved: "Claim approved",
    claim_matched_denied: "Claim denied",
  };
  return labels[type];
}

export function isRevisionNotificationResolved(
  notification: Notification,
  claim: ClaimRequest | undefined
): boolean {
  return (
    notification.type === "revision_requested" &&
    Boolean(claim && claim.status !== "revision_requested")
  );
}

export function notificationDisplayLabel(
  notification: Notification,
  claim?: ClaimRequest
): string {
  if (isRevisionNotificationResolved(notification, claim)) return "Revised";
  return notificationTypeLabel(notification.type);
}

export function notificationDisplayMessage(
  notification: Notification,
  claim?: ClaimRequest
): string {
  if (isRevisionNotificationResolved(notification, claim)) {
    return "You updated and resubmitted this claim.";
  }
  return notification.message;
}

export function getInsuranceDecision(
  events: ClaimEvent[],
  claimId: string
): "approved" | "denied" | null {
  const decisionEvent = events.find(
    (event) =>
      event.claim_request_id === claimId &&
      (event.event_type === "insurance_approved" ||
        event.event_type === "insurance_denied")
  );
  if (!decisionEvent) return null;
  return decisionEvent.event_type === "insurance_approved" ? "approved" : "denied";
}

export function insuranceDecisionLabel(decision: "approved" | "denied"): string {
  return decision === "approved" ? "Approved" : "Denied";
}

export function eventSummaryWithUser(
  event: ClaimEvent,
  claimUserName?: string
): string {
  const summary = eventSummary(event);
  return claimUserName ? `${claimUserName} · ${summary}` : summary;
}

export function eventSummary(event: ClaimEvent): string {
  const payload = event.payload ?? {};
  switch (event.event_type) {
    case "receipt_validation_passed":
      return "Receipt validation passed";
    case "receipt_validation_failed":
      return `Receipt validation failed: ${((payload.reasons as string[]) ?? []).join("; ")}`;
    case "receipt_validation_faked":
      return "AI validation faked (no API key)";
    case "benefits_updated_claim":
      return "Benefits updated claim fields";
    case "benefits_requests_revision":
      return "Benefits requested revision";
    case "benefits_cancels_for_submission":
      return "Benefits cancelled submission";
    case "benefits_submits_to_insurance":
      return "Submitted to insurance";
    case "insurance_claim_created":
      return "Insurance claim created";
    case "insurance_approved":
      return "Insurance approved";
    case "insurance_denied":
      return "Insurance denied";
    case "claim_matched_approved":
      return "Claim matched and approved";
    case "claim_matched_denied":
      return "Claim matched and denied";
    default:
      return event.event_type.replace(/_/g, " ");
  }
}
