"use client";

import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { eventSummary } from "@/lib/actor-feed";
import { useCommandCenter } from "@/lib/context/CommandCenterContext";
import { buildUsersById, getClaimUserName, shortClaimId } from "@/lib/user-display";

export function EventLog() {
  const { users, claims, events, selectedClaimId, setSelectedClaimId } = useCommandCenter();
  const usersById = useMemo(() => buildUsersById(users), [users]);
  const claimsById = useMemo(
    () => new Map(claims.map((claim) => [claim.id, claim])),
    [claims]
  );

  const filtered = selectedClaimId
    ? events.filter((event) => event.claim_request_id === selectedClaimId)
    : events;

  return (
    <div className="relative z-10 border-t bg-card/95">
      <div className="border-b px-4 py-1.5">
        <p className="text-xs text-muted-foreground">
          {selectedClaimId ? "Filtered to selected claim" : "All claims"}
        </p>
      </div>
      <ScrollArea className="h-40">
        <div className="space-y-1 p-2">
          {filtered.map((event) => {
            const claim = claimsById.get(event.claim_request_id);
            const patientName = claim
              ? getClaimUserName(claim, usersById)
              : "Unknown user";
            const claimRef = shortClaimId(event.claim_request_id);

            return (
              <button
                key={event.id}
                type="button"
                onClick={() => setSelectedClaimId(event.claim_request_id)}
                className="w-full rounded-md border border-transparent px-3 py-2 text-left text-sm hover:border-border hover:bg-muted/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {patientName} · {claimRef} · {event.event_type}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {eventSummary(event)} · {event.actor_role}
                </p>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No events yet
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
