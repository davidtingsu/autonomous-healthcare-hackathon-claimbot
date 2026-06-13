"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export function BenefitsPanel() {
  const { users, claims, events, setSelectedClaimId, refresh } = useCommandCenter();
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
  const usersById = useMemo(() => buildUsersById(users), [users]);

  const reviewingClaims = useMemo(
    () =>
      filterClaimsByUserId(
        claims.filter((claim) => claim.status === "reviewing"),
        filterUserId
      ),
    [claims, filterUserId]
  );

  const benefitsEvents = useMemo(() => {
    const actorEvents = filterEventsForActor(events, claims, "benefits_company");
    return filterEventsByClaimUser(actorEvents, claims, filterUserId);
  }, [events, claims, filterUserId]);

  const [edits, setEdits] = useState<Record<string, { userId: string; amount: string; date: string }>>({});

  function getEdit(claimId: string, claim: (typeof claims)[0]) {
    return (
      edits[claimId] ?? {
        userId: claim.user_id,
        amount: String(claim.claimed_amount),
        date: claim.service_date,
      }
    );
  }

  function claimName(claim: (typeof claims)[0]) {
    return getClaimUserName(claim, usersById);
  }

  async function saveEdits(claimId: string) {
    const edit = edits[claimId];
    if (!edit) return;
    await fetch(`/api/claims/${claimId}`, {
      method: "PATCH",
      headers: actorHeaders("benefits_company"),
      body: JSON.stringify({
        userId: edit.userId,
        claimedAmount: Number(edit.amount),
        serviceDate: edit.date,
      }),
    });
    await refresh();
  }

  async function reviewAction(claimId: string, action: "revise" | "submit" | "cancel") {
    await fetch(`/api/claims/${claimId}/benefits-review`, {
      method: "POST",
      headers: actorHeaders("benefits_company"),
      body: JSON.stringify({ action }),
    });
    await refresh();
  }

  const historyEvents = benefitsEvents.filter(
    (event) => !reviewingClaims.some((claim) => claim.id === event.claim_request_id)
  );

  return (
    <div className="space-y-3">
      <PanelUserFilter users={users} value={filterUserId} onChange={setFilterUserId} />
      <ActorEventFeed
        heightClass="h-[380px]"
        events={historyEvents}
        emptyMessage="No claims awaiting benefits review"
        pinnedHeader={
          <>
            {reviewingClaims.map((claim) => {
              const edit = getEdit(claim.id, claim);
              const patientName = claimName(claim);
              const validationEvent = benefitsEvents.find(
                (event) =>
                  event.claim_request_id === claim.id &&
                  event.event_type.startsWith("receipt_validation")
              );

              return (
                <div
                  key={claim.id}
                  className="rounded-md border border-amber-800/40 bg-amber-950/10 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className="text-left text-sm font-semibold hover:text-teal-400"
                      onClick={() => setSelectedClaimId(claim.id)}
                    >
                      {patientName} · ${Number(claim.claimed_amount).toFixed(2)} · {claim.service_date}
                    </button>
                    <Badge className="bg-amber-950/50 text-amber-400">reviewing</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {shortClaimId(claim.id)}
                  </p>

                  {validationEvent && (
                    <div className="mt-2 rounded border border-dashed border-amber-700/50 bg-amber-950/20 p-2 text-xs">
                      <p className="font-medium">{eventSummaryWithUser(validationEvent, patientName)}</p>
                      <pre className="mt-1 whitespace-pre-wrap text-muted-foreground">
                        {JSON.stringify(validationEvent.payload, null, 2)}
                      </pre>
                    </div>
                  )}

                  <div className="mt-3 grid gap-2">
                    <div>
                      <Label className="text-xs">User</Label>
                      <Select
                        value={edit.userId}
                        onValueChange={(v) => {
                          if (!v) return;
                          setEdits((prev) => ({
                            ...prev,
                            [claim.id]: { ...getEdit(claim.id, claim), userId: v },
                          }));
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.first_name} {user.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Service date</Label>
                      <Input
                        type="date"
                        value={edit.date}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [claim.id]: { ...getEdit(claim.id, claim), date: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Amount</Label>
                      <Input
                        type="number"
                        value={edit.amount}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [claim.id]: { ...getEdit(claim.id, claim), amount: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => saveEdits(claim.id)}>
                      Save edits
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => reviewAction(claim.id, "revise")}>
                      Request revision
                    </Button>
                    <Button size="sm" onClick={() => reviewAction(claim.id, "submit")}>
                      Submit to insurance
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => reviewAction(claim.id, "cancel")}>
                      Cancel for submission
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
