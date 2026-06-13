"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActorEventFeed } from "@/components/panels/ActorEventFeed";
import { PanelUserFilter } from "@/components/panels/PanelUserFilter";
import {
  eventSummaryWithUser,
  filterEventsForActor,
  getInsuranceDecision,
  insuranceDecisionLabel,
} from "@/lib/actor-feed";
import {
  actorHeaders,
  useCommandCenter,
} from "@/lib/context/CommandCenterContext";
import {
  buildUsersById,
  filterClaimsByUserId,
  filterEventsByClaimUser,
  getClaimUserName,
  shortClaimId,
} from "@/lib/user-display";
import { STATUS_BADGE_CLASS } from "@/lib/types";

export function InsurancePanel() {
  const { users, claims, events, setSelectedClaimId, refresh } = useCommandCenter();
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ claimId: string; action: string } | null>(null);
  const usersById = useMemo(() => buildUsersById(users), [users]);

  const pendingClaims = useMemo(
    () =>
      filterClaimsByUserId(
        claims.filter((claim) => claim.status === "submitted"),
        filterUserId
      ),
    [claims, filterUserId]
  );

  const insuranceEvents = useMemo(() => {
    const actorEvents = filterEventsForActor(events, claims, "insurance_company");
    return filterEventsByClaimUser(actorEvents, claims, filterUserId);
  }, [events, claims, filterUserId]);

  const reviewedClaims = useMemo(() => {
    return filterClaimsByUserId(
      claims.filter((claim) => {
        const decision = getInsuranceDecision(insuranceEvents, claim.id);
        return decision !== null && !pendingClaims.some((pending) => pending.id === claim.id);
      }),
      filterUserId
    ).map((claim) => ({
      claim,
      decision: getInsuranceDecision(insuranceEvents, claim.id)!,
    }));
  }, [claims, insuranceEvents, pendingClaims, filterUserId]);

  function claimName(claim: (typeof claims)[0]) {
    return getClaimUserName(claim, usersById);
  }

  async function review(claimId: string, action: "approve" | "deny") {
    setPending({ claimId, action });
    try {
      await fetch(`/api/claims/${claimId}/insurance-review`, {
        method: "POST",
        headers: actorHeaders("insurance_company"),
        body: JSON.stringify({ action }),
      });
      await refresh();
    } finally {
      setPending(null);
    }
  }

  const historyEvents = insuranceEvents.filter((event) => {
    const isPending = pendingClaims.some(
      (claim) => claim.id === event.claim_request_id
    );
    const isReviewedCard = reviewedClaims.some(
      ({ claim }) => claim.id === event.claim_request_id
    );
    const isDecisionEvent =
      event.event_type === "insurance_approved" ||
      event.event_type === "insurance_denied";
    return !isPending && !(isReviewedCard && isDecisionEvent);
  });

  const hasContent = pendingClaims.length > 0 || reviewedClaims.length > 0;

  return (
    <div className="space-y-3">
      <PanelUserFilter users={users} value={filterUserId} onChange={setFilterUserId} />
      <ActorEventFeed
        heightClass="h-[380px]"
        events={historyEvents}
        emptyMessage={
          hasContent ? "No additional insurance events" : "No insurance claims awaiting review"
        }
        pinnedHeader={
          <>
            {pendingClaims.map((claim) => {
              const patientName = claimName(claim);
              const createdEvent = insuranceEvents.find(
                (event) =>
                  event.claim_request_id === claim.id &&
                  event.event_type === "insurance_claim_created"
              );

              return (
                <div
                  key={claim.id}
                  className="rounded-md border border-violet-800/40 bg-violet-950/10 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className="text-left text-sm font-semibold hover:text-teal-400"
                      onClick={() => setSelectedClaimId(claim.id)}
                    >
                      {patientName} · ${Number(claim.claimed_amount).toFixed(2)} · {claim.service_date}
                    </button>
                    <Badge className="bg-blue-950/50 text-blue-400">Awaiting review</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{shortClaimId(claim.id)}</p>
                  {createdEvent && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {eventSummaryWithUser(createdEvent, patientName)}
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      disabled={pending?.claimId === claim.id}
                      onClick={() => review(claim.id, "approve")}
                    >
                      {pending?.claimId === claim.id && pending?.action === "approve" && (
                        <Loader2 className="animate-spin" />
                      )}
                      {pending?.claimId === claim.id && pending?.action === "approve"
                        ? "Approving..."
                        : "Approve"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={pending?.claimId === claim.id}
                      onClick={() => review(claim.id, "deny")}
                    >
                      {pending?.claimId === claim.id && pending?.action === "deny" && (
                        <Loader2 className="animate-spin" />
                      )}
                      {pending?.claimId === claim.id && pending?.action === "deny"
                        ? "Denying..."
                        : "Deny"}
                    </Button>
                  </div>
                </div>
              );
            })}

            {reviewedClaims.map(({ claim, decision }) => {
              const patientName = claimName(claim);
              const decisionEvent = insuranceEvents.find(
                (event) =>
                  event.claim_request_id === claim.id &&
                  (event.event_type === "insurance_approved" ||
                    event.event_type === "insurance_denied")
              );
              const matchEvent = insuranceEvents.find(
                (event) =>
                  event.claim_request_id === claim.id &&
                  (event.event_type === "claim_matched_approved" ||
                    event.event_type === "claim_matched_denied")
              );

              return (
                <div
                  key={claim.id}
                  className={`rounded-md border p-3 ${
                    decision === "approved"
                      ? "border-emerald-800/40 bg-emerald-950/10"
                      : "border-rose-800/40 bg-rose-950/10"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className="text-left text-sm font-semibold hover:text-teal-400"
                      onClick={() => setSelectedClaimId(claim.id)}
                    >
                      {patientName} · ${Number(claim.claimed_amount).toFixed(2)} · {claim.service_date}
                    </button>
                    <Badge className={STATUS_BADGE_CLASS[decision]}>
                      {insuranceDecisionLabel(decision)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{shortClaimId(claim.id)}</p>
                  {decisionEvent && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {eventSummaryWithUser(decisionEvent, patientName)}
                    </p>
                  )}
                  {matchEvent && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {eventSummaryWithUser(matchEvent, patientName)}
                    </p>
                  )}
                </div>
              );
            })}
          </>
        }
        renderEvent={(event) => {
          const claim = claims.find((item) => item.id === event.claim_request_id);
          const patientName = claim ? claimName(claim) : undefined;
          const decision = claim
            ? getInsuranceDecision(insuranceEvents, claim.id)
            : null;

          return (
            <button
              type="button"
              onClick={() => setSelectedClaimId(event.claim_request_id)}
              className="w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/30"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{event.event_type}</span>
                {decision &&
                  (event.event_type === "insurance_approved" ||
                    event.event_type === "insurance_denied" ||
                    event.event_type.includes("match")) && (
                    <Badge className={STATUS_BADGE_CLASS[decision]}>
                      {insuranceDecisionLabel(decision)}
                    </Badge>
                  )}
              </div>
              <p className="text-xs text-muted-foreground">
                {eventSummaryWithUser(event, patientName)}
              </p>
            </button>
          );
        }}
      />
    </div>
  );
}
