"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActorEventFeed } from "@/components/panels/ActorEventFeed";
import { eventSummary } from "@/lib/actor-feed";
import {
  actorHeaders,
  useCommandCenter,
} from "@/lib/context/CommandCenterContext";
import { filterEventsForActor } from "@/lib/actor-feed";

export function InsurancePanel() {
  const { claims, events, setSelectedClaimId, refresh } = useCommandCenter();
  const insuranceEvents = filterEventsForActor(events, claims, "insurance_company");
  const pendingClaims = claims.filter((c) => c.status === "submitted");

  async function review(claimId: string, action: "approve" | "deny") {
    await fetch(`/api/claims/${claimId}/insurance-review`, {
      method: "POST",
      headers: actorHeaders("insurance_company"),
      body: JSON.stringify({ action }),
    });
    await refresh();
  }

  return (
    <ActorEventFeed
      heightClass="h-[600px]"
      events={insuranceEvents.filter(
        (e) => !pendingClaims.some((c) => c.id === e.claim_request_id)
      )}
      emptyMessage="No insurance claims awaiting review"
      pinnedHeader={
        <>
          {pendingClaims.map((claim) => {
          const createdEvent = insuranceEvents.find(
            (e) =>
              e.claim_request_id === claim.id &&
              e.event_type === "insurance_claim_created"
          );
          const user = claim.users as { first_name: string; last_name: string } | undefined;

          return (
            <div
              key={claim.id}
              className="rounded-md border border-violet-800/40 bg-violet-950/10 p-3"
            >
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="text-sm font-semibold hover:text-teal-400"
                  onClick={() => setSelectedClaimId(claim.id)}
                >
                  Claim {claim.id.slice(0, 8)}…
                </button>
                <Badge className="bg-blue-950/50 text-blue-400">submitted</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {user ? `${user.first_name} ${user.last_name}` : ""} · ${Number(claim.claimed_amount).toFixed(2)}
              </p>
              {createdEvent && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {eventSummary(createdEvent)}
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => review(claim.id, "approve")}>
                  Approve
                </Button>
                <Button size="sm" variant="destructive" onClick={() => review(claim.id, "deny")}>
                  Deny
                </Button>
              </div>
            </div>
          );
          })}
        </>
      }
      renderEvent={(event) => (
        <button
          type="button"
          onClick={() => setSelectedClaimId(event.claim_request_id)}
          className="w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/30"
        >
          <span className="font-medium">{event.event_type}</span>
          <p className="text-xs text-muted-foreground">{eventSummary(event)}</p>
        </button>
      )}
    />
  );
}
