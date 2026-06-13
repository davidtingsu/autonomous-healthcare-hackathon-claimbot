import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ActorRole,
  ClaimRequestStatus,
  NotificationType,
} from "@/lib/types";

export async function emitEvent(
  supabase: SupabaseClient,
  claimRequestId: string,
  eventType: string,
  actorRole: ActorRole | "system",
  payload: Record<string, unknown> = {}
) {
  const { error } = await supabase.from("claim_events").insert({
    claim_request_id: claimRequestId,
    event_type: eventType,
    actor_role: actorRole,
    payload,
  });
  if (error) throw new Error(error.message);
}

export async function emitNotification(
  supabase: SupabaseClient,
  userId: string,
  claimRequestId: string,
  type: NotificationType,
  message: string
) {
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    claim_request_id: claimRequestId,
    type,
    message,
    read: false,
  });
  if (error) throw new Error(error.message);
}

export async function updateClaimStatus(
  supabase: SupabaseClient,
  claimRequestId: string,
  status: ClaimRequestStatus,
  extra: Record<string, unknown> = {}
) {
  const { error } = await supabase
    .from("claim_requests")
    .update({ status, ...extra })
    .eq("id", claimRequestId);
  if (error) throw new Error(error.message);
}

export async function getClaimWithUser(
  supabase: SupabaseClient,
  claimRequestId: string
) {
  const { data, error } = await supabase
    .from("claim_requests")
    .select("*, users(*)")
    .eq("id", claimRequestId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export const NOTIFICATION_MESSAGES: Record<NotificationType, string> = {
  revision_requested:
    "Your claim requires revision. Please update and resubmit.",
  cancelled_for_submission:
    "Your claim was cancelled before insurance submission.",
  claim_matched_approved:
    "Your claim was matched and approved by the benefits company.",
  claim_matched_denied:
    "Your claim was matched but denied. Please contact support.",
};
