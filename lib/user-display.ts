import type { ClaimEvent, ClaimRequest, User } from "@/lib/types";

export function formatUserName(
  user: Pick<User, "first_name" | "last_name"> | null | undefined
): string {
  if (!user?.first_name && !user?.last_name) return "Unknown user";
  return `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
}

export function formatUserShortName(
  user: Pick<User, "first_name" | "last_name"> | null | undefined
): string {
  if (!user?.first_name && !user?.last_name) return "Unknown";
  const first = user.first_name?.trim() ?? "";
  const lastInitial = user.last_name?.trim()?.[0];
  if (!first) return lastInitial ? `${lastInitial}.` : "Unknown";
  return lastInitial ? `${first} ${lastInitial}.` : first;
}

export function shortUserId(userId: string): string {
  return `#${userId.slice(0, 8)}`;
}

export function formatSubscriberLabel(user: User): string {
  return `${formatUserName(user)} · ${shortUserId(user.id)}`;
}

export function formatPatientLabel(user: User): string {
  const label = formatSubscriberLabel(user);
  return user.primary_id ? `${label} (dependent)` : label;
}

export function getClaimUserShortName(
  claim: ClaimRequest,
  usersById: Map<string, User>
): string {
  if (claim.users) return formatUserShortName(claim.users);
  return formatUserShortName(usersById.get(claim.user_id));
}

export function formatUserLabel(
  user: Pick<User, "first_name" | "last_name" | "primary_id">
): string {
  const name = formatUserName(user);
  return user.primary_id ? `${name} (dependent)` : name;
}

export function buildUsersById(users: User[]): Map<string, User> {
  return new Map(users.map((user) => [user.id, user]));
}

export function getClaimUserName(
  claim: ClaimRequest,
  usersById: Map<string, User>
): string {
  if (claim.users) return formatUserName(claim.users);
  return formatUserName(usersById.get(claim.user_id));
}

export function getClaimPatientLabel(
  claim: ClaimRequest,
  usersById?: Map<string, User>
): string {
  const user = claim.users ?? usersById?.get(claim.user_id);
  return user ? formatUserLabel(user) : formatUserName(user);
}

export function shortClaimId(claimId: string): string {
  return `#${claimId.slice(0, 8)}`;
}

export function filterClaimsByUserId(
  claims: ClaimRequest[],
  userId: string | null
): ClaimRequest[] {
  if (!userId) return claims;
  return claims.filter((claim) => claim.user_id === userId);
}

export function filterEventsByClaimUser(
  events: ClaimEvent[],
  claims: ClaimRequest[],
  userId: string | null
): ClaimEvent[] {
  if (!userId) return events;
  const claimIds = new Set(
    claims.filter((claim) => claim.user_id === userId).map((claim) => claim.id)
  );
  return events.filter((event) => claimIds.has(event.claim_request_id));
}
