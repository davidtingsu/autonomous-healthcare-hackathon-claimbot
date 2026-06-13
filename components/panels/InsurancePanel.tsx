"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActorEventFeed } from "@/components/panels/ActorEventFeed";
import { PanelUserFilter } from "@/components/panels/PanelUserFilter";
import { eventSummaryWithUser } from "@/lib/actor-feed";
import {
  actorHeaders,
  useCommandCenter,
} from "@/lib/context/CommandCenterContext";
import { filterEventsForActor } from "@/lib/actor-feed";
import {
  buildUsersById,
  filterClaimsByUserId,
  filterEventsByClaimUser,
  getClaimUserName,
  shortClaimId,
} from "@/lib/user-display";

export function InsurancePanel() {
  const { users, claims, events, setSelectedClaimId, refresh } = useCommandCenter();
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
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

  function claimName(claim: (typeof claims)[0]) {
    return getClaimUserName(claim, usersById);
  }

  async function review(claimId: string, action: "approve" | "deny") {
    await fetch(`/api/claims/${claimId}/insurance-review`, {
      method: "POST",
      headers: actorHeaders("insurance_company"),
      body: JSON.stringify({ action }),
    });
    await refresh();
  }

  const historyEvents = insuranceEvents.filter(
    (event) => !pendingClaims.some((claim) => claim.id === event.claim_request_id)
  );

  return (
    <div className="space-y-3">
      <PanelUserFilter users={users} value={filterUserId} onChange={setFilterUserId} />
      <ActorEventFeed
        heightClass="h-[560px]"
        events={historyEvents}
        emptyMessage="No insurance claims awaiting review"
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
                    <Badge className="bg-blue-950/50 text-blue-400">submitted</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{shortClaimId(claim.id)}</p>
                  {createdEvent && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {eventSummaryWithUser(createdEvent, patientName)}
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
        renderEvent={(event) => {
          const claim = claims.find((item) => item.id === event.claim_request_id);
          const patientName = claim ? claimName(claim) : undefined;
          return (
            <button
              type="button"
              onClick={() => setSelectedClaimId(event.claim_request_id)}
              className="w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/30"
            >
              <span className="font-medium">{event.event_type}</span>
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
