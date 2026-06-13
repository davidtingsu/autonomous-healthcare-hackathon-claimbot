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
import { eventSummaryWithUser, notificationTypeLabel } from "@/lib/actor-feed";
import {
  actorHeaders,
  useCommandCenter,
} from "@/lib/context/CommandCenterContext";
import { filterEventsForActor, filterNotificationsForUser } from "@/lib/actor-feed";
import type { ClaimRequest } from "@/lib/types";
import { buildUsersById, getClaimUserName, shortClaimId } from "@/lib/user-display";

function ClaimRow({
  claim,
  patientName,
  onSelect,
}: {
  claim: ClaimRequest;
  patientName: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/30"
    >
      <div className="flex justify-between gap-2">
        <span className="font-medium">
          {patientName} · ${Number(claim.claimed_amount).toFixed(2)}
        </span>
        <Badge variant="outline">{claim.status}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {claim.service_date} · {shortClaimId(claim.id)}
      </p>
    </button>
  );
}

export function UserPanel() {
  const {
    users,
    claims,
    events,
    notifications,
    selectedUserId,
    setSelectedUserId,
    selectedDependentId,
    setSelectedDependentId,
    claimUserId,
    setSelectedClaimId,
    refresh,
    actorRole,
  } = useCommandCenter();

  const [showCreate, setShowCreate] = useState(false);
  const [editingClaimId, setEditingClaimId] = useState<string | null>(null);
  const [amount, setAmount] = useState("150");
  const [serviceDate, setServiceDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const subscribers = users.filter((u) => !u.primary_id);
  const dependents = users.filter((u) => u.primary_id === selectedUserId);
  const usersById = useMemo(() => buildUsersById(users), [users]);
  const actingUser = usersById.get(claimUserId);
  const actingUserName = actingUser
    ? `${actingUser.first_name} ${actingUser.last_name}`
    : "Selected user";
  const userClaims = claims.filter((c) => c.user_id === claimUserId);
  const userEvents = filterEventsForActor(events, claims, "user", claimUserId);
  const userNotifications = filterNotificationsForUser(notifications, claimUserId);

  async function createClaim() {
    const form = new FormData();
    form.append("userId", claimUserId);
    form.append("claimedAmount", amount);
    form.append("serviceDate", serviceDate);
    if (receiptFile) form.append("receipt", receiptFile);
    await fetch("/api/claims", {
      method: "POST",
      headers: { "X-Actor-Role": actorRole },
      body: form,
    });
    setShowCreate(false);
    await refresh();
  }

  async function updateClaim(claimId: string) {
    await fetch(`/api/claims/${claimId}`, {
      method: "PATCH",
      headers: actorHeaders("user"),
      body: JSON.stringify({
        claimedAmount: Number(amount),
        serviceDate,
      }),
    });
    setEditingClaimId(null);
    await refresh();
  }

  async function markRead(ids: string[]) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: actorHeaders("user"),
      body: JSON.stringify({ ids }),
    });
    await refresh();
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Subscriber</Label>
          <Select
            value={selectedUserId}
            onValueChange={(v) => v && setSelectedUserId(v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {subscribers.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.first_name} {u.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Dependent (optional)</Label>
          <Select
            value={selectedDependentId ?? "none"}
            onValueChange={(v) =>
              setSelectedDependentId(v === "none" ? null : v)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {dependents.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.first_name} {u.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ActorEventFeed
        events={userEvents}
        notifications={userNotifications}
        pinnedHeader={
          <div className="rounded-md border border-teal-800/50 bg-teal-950/20 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Create claim</span>
              <Button size="sm" variant="outline" onClick={() => setShowCreate(!showCreate)}>
                {showCreate ? "Close" : "Expand"}
              </Button>
            </div>
            {showCreate && (
              <div className="mt-3 space-y-2">
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" />
                <Input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
                <Input type="file" accept="image/*" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
                <Button size="sm" onClick={createClaim}>Submit claim</Button>
              </div>
            )}
          </div>
        }
        renderNotification={(n) => (
          <div
            className={`rounded-md border p-3 ${n.type === "revision_requested" ? "border-amber-700 bg-amber-950/30" : ""}`}
          >
            <div className="flex justify-between gap-2">
              <span className="text-sm font-medium">{notificationTypeLabel(n.type)}</span>
              {!n.read && <Badge>New</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">{n.message}</p>
            <p className="text-xs text-muted-foreground">{actingUserName}</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSelectedClaimId(n.claim_request_id)}>
                View claim
              </Button>
              {n.type === "revision_requested" && (
                <Button size="sm" onClick={() => setEditingClaimId(n.claim_request_id)}>
                  Edit claim
                </Button>
              )}
              {!n.read && (
                <Button size="sm" variant="outline" onClick={() => markRead([n.id])}>
                  Mark read
                </Button>
              )}
            </div>
            {editingClaimId === n.claim_request_id && (
              <div className="mt-2 space-y-2 border-t pt-2">
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <Input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
                <Button size="sm" onClick={() => updateClaim(n.claim_request_id)}>Save & resubmit</Button>
              </div>
            )}
          </div>
        )}
        renderEvent={(event) => (
          <button
            type="button"
            onClick={() => setSelectedClaimId(event.claim_request_id)}
            className="w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/30"
          >
            <div className="flex justify-between">
              <span className="font-medium">{event.event_type}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(event.created_at).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {eventSummaryWithUser(event, actingUserName)}
            </p>
          </button>
        )}
        emptyMessage="No claims or notifications yet"
      />

      {userClaims.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Your claims</p>
          {userClaims.map((claim) => (
            <ClaimRow
              key={claim.id}
              claim={claim}
              patientName={getClaimUserName(claim, usersById)}
              onSelect={() => setSelectedClaimId(claim.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
