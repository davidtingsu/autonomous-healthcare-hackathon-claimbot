import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type {
  ActorRole,
  ClaimEvent,
  ClaimRequestStatus,
  NotificationType,
} from "@/lib/types";

function toClaimEvent(row: {
  id: string;
  claim_request_id: string;
  event_type: string;
  actor_role: string;
  payload: unknown;
  created_at: Date;
}): ClaimEvent {
  return {
    id: row.id,
    claim_request_id: row.claim_request_id,
    event_type: row.event_type,
    actor_role: row.actor_role as ClaimEvent["actor_role"],
    payload: (row.payload ?? {}) as Record<string, unknown>,
    created_at: row.created_at.toISOString(),
  };
}

const {
  claimEvents,
  claimRequests,
  insuranceClaims,
  notifications,
  users,
} = schema;

export async function emitEvent(
  claimRequestId: string,
  eventType: string,
  actorRole: ActorRole | "system",
  payload: Record<string, unknown> = {}
) {
  const db = getDb();
  await db.insert(claimEvents).values({
    claim_request_id: claimRequestId,
    event_type: eventType,
    actor_role: actorRole,
    payload,
  });
}

export async function emitNotification(
  userId: string,
  claimRequestId: string,
  type: NotificationType,
  message: string
) {
  const db = getDb();
  await db.insert(notifications).values({
    user_id: userId,
    claim_request_id: claimRequestId,
    type,
    message,
    read: false,
  });
}

export async function updateClaimStatus(
  claimRequestId: string,
  status: ClaimRequestStatus,
  extra: Record<string, unknown> = {}
) {
  const db = getDb();
  await db
    .update(claimRequests)
    .set({ status, ...extra, updated_at: new Date() })
    .where(eq(claimRequests.id, claimRequestId));
}

export async function getClaimWithUser(claimRequestId: string) {
  const db = getDb();
  const rows = await db
    .select({ claim: claimRequests, user: users })
    .from(claimRequests)
    .innerJoin(users, eq(claimRequests.user_id, users.id))
    .where(eq(claimRequests.id, claimRequestId))
    .limit(1);

  const row = rows[0];
  if (!row) throw new Error("Claim not found");

  return {
    ...row.claim,
    users: row.user,
  };
}

export async function getClaimById(claimRequestId: string) {
  const db = getDb();
  const [claim] = await db
    .select()
    .from(claimRequests)
    .where(eq(claimRequests.id, claimRequestId))
    .limit(1);
  if (!claim) throw new Error("Claim not found");
  return claim;
}

export async function getClaimWithUserById(claimRequestId: string) {
  const db = getDb();
  const rows = await db
    .select({
      claim: claimRequests,
      user: users,
      insurance: insuranceClaims,
    })
    .from(claimRequests)
    .innerJoin(users, eq(claimRequests.user_id, users.id))
    .leftJoin(insuranceClaims, eq(claimRequests.id, insuranceClaims.claim_request_id))
    .where(eq(claimRequests.id, claimRequestId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error("Claim not found");
  return {
    ...row.claim,
    users: row.user,
    insurance_claim: row.insurance ?? null,
  };
}

export async function listClaimsWithUsers() {
  const db = getDb();
  const rows = await db
    .select({
      claim: claimRequests,
      user: users,
      insurance: insuranceClaims,
    })
    .from(claimRequests)
    .innerJoin(users, eq(claimRequests.user_id, users.id))
    .leftJoin(insuranceClaims, eq(claimRequests.id, insuranceClaims.claim_request_id))
    .orderBy(desc(claimRequests.created_at));

  return rows.map((row) => ({
    ...row.claim,
    users: row.user,
    insurance_claim: row.insurance ?? null,
  }));
}

export async function listEvents(limit = 200, claimId?: string | null): Promise<ClaimEvent[]> {
  const db = getDb();
  const rows = claimId
    ? await db
        .select()
        .from(claimEvents)
        .where(eq(claimEvents.claim_request_id, claimId))
        .orderBy(desc(claimEvents.created_at))
        .limit(limit)
    : await db
        .select()
        .from(claimEvents)
        .orderBy(desc(claimEvents.created_at))
        .limit(limit);

  return rows.map(toClaimEvent);
}

export async function listUsers() {
  const db = getDb();
  return db.select().from(users).orderBy(users.first_name);
}

export async function listNotificationsForUser(userId: string) {
  const db = getDb();
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.user_id, userId))
    .orderBy(desc(notifications.created_at));
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
