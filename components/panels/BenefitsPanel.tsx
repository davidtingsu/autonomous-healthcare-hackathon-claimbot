"use client";

import { useState } from "react";
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
import { eventSummary } from "@/lib/actor-feed";
import {
  actorHeaders,
  useCommandCenter,
} from "@/lib/context/CommandCenterContext";
import { filterEventsForActor } from "@/lib/actor-feed";

export function BenefitsPanel() {
  const { users, claims, events, setSelectedClaimId, refresh } = useCommandCenter();
  const reviewingClaims = claims.filter((c) => c.status === "reviewing");
  const benefitsEvents = filterEventsForActor(events, claims, "benefits_company");

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

  return (
    <ActorEventFeed
      heightClass="h-[600px]"
      events={benefitsEvents.filter(
        (e) => !reviewingClaims.some((c) => c.id === e.claim_request_id)
      )}
      emptyMessage="No claims awaiting benefits review"
      pinnedHeader={
        <>
          {reviewingClaims.map((claim) => {
          const edit = getEdit(claim.id, claim);
          const validationEvent = benefitsEvents.find(
            (e) =>
              e.claim_request_id === claim.id &&
              e.event_type.startsWith("receipt_validation")
          );
          const user = claim.users as { first_name: string; last_name: string } | undefined;

          return (
            <div
              key={claim.id}
              className="rounded-md border border-amber-800/40 bg-amber-950/10 p-3"
            >
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="text-left text-sm font-semibold hover:text-teal-400"
                  onClick={() => setSelectedClaimId(claim.id)}
                >
                  Claim {claim.id.slice(0, 8)}…
                </button>
                <Badge className="bg-amber-950/50 text-amber-400">reviewing</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {user ? `${user.first_name} ${user.last_name}` : ""} · ${Number(claim.claimed_amount).toFixed(2)} · {claim.service_date}
              </p>

              {validationEvent && (
                <div className="mt-2 rounded border border-dashed border-amber-700/50 bg-amber-950/20 p-2 text-xs">
                  <p className="font-medium">{eventSummary(validationEvent)}</p>
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
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.first_name} {u.last_name}
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
