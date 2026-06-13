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
import { eventSummaryWithUser, filterEventsForActor, filterNotificationsForUser, isRevisionNotificationResolved, notificationDisplayLabel, notificationDisplayMessage } from "@/lib/actor-feed";
import {
  actorHeaders,
  useCommandCenter,
} from "@/lib/context/CommandCenterContext";
import type { ClaimRequest } from "@/lib/types";
import { buildUsersById, formatPatientLabel, formatSubscriberLabel, getClaimUserName, shortClaimId } from "@/lib/user-display";

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
  const [patientUserId, setPatientUserId] = useState(selectedUserId);
  const [createError, setCreateError] = useState<string | null>(null);

  const subscribers = users.filter((u) => !u.primary_id);
  const dependents = users.filter((u) => u.primary_id === selectedUserId);
  const usersById = useMemo(() => buildUsersById(users), [users]);
  const selectedSubscriber = usersById.get(selectedUserId);
  const selectedPatient = usersById.get(patientUserId);
  const patientOptions = useMemo(() => {
    if (!selectedSubscriber) return [];
    return [selectedSubscriber, ...dependents];
  }, [selectedSubscriber, dependents]);

  const actingUser = usersById.get(claimUserId);
  const actingUserName = actingUser
    ? `${actingUser.first_name} ${actingUser.last_name}`
    : "Selected user";
  const userClaims = claims.filter((c) => c.user_id === claimUserId);
  const claimsById = useMemo(
    () => new Map<string, ClaimRequest>(claims.map((claim) => [claim.id, claim])),
    [claims]
  );
  const userEvents = filterEventsForActor(events, claims, "user", claimUserId);
  const userNotifications = filterNotificationsForUser(notifications, claimUserId);

  async function createClaim() {
    if (!receiptFile) {
      setCreateError("A receipt file (image or PDF) is required.");
      return;
    }

    setCreateError(null);
    const form = new FormData();
    form.append("userId", patientUserId);
    form.append("claimedAmount", amount);
    form.append("serviceDate", serviceDate);
    form.append("receipt", receiptFile);
    const res = await fetch("/api/claims", {
      method: "POST",
      headers: { "X-Actor-Role": actorRole },
      body: form,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setCreateError(data.error ?? "Failed to create claim");
      return;
    }
    setShowCreate(false);
    setReceiptFile(null);
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
            onValueChange={(v) => {
              if (!v) return;
              setSelectedUserId(v);
              setSelectedDependentId(null);
              setPatientUserId(v);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select subscriber">
                {selectedSubscriber
                  ? formatSubscriberLabel(selectedSubscriber)
                  : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {subscribers.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {formatSubscriberLabel(u)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Dependent (optional)</Label>
          <Select
            value={selectedDependentId ?? "none"}
            onValueChange={(v) => {
              const dependentId = v === "none" ? null : v;
              setSelectedDependentId(dependentId);
              if (dependentId) setPatientUserId(dependentId);
              else setPatientUserId(selectedUserId);
            }}
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
        heightClass="h-[360px]"
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
                <div>
                  <Label className="text-xs">Patient</Label>
                  <Select
                    value={patientUserId}
                    onValueChange={(v) => v && setPatientUserId(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select patient">
                        {selectedPatient
                          ? formatPatientLabel(selectedPatient)
                          : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {patientOptions.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {formatPatientLabel(user)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" />
                <Input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
                <div>
                  <Label className="text-xs">Receipt (required, image or PDF)</Label>
                  <Input
                    type="file"
                    accept="image/*,application/pdf,.pdf"
                    required
                    onChange={(e) => {
                      setReceiptFile(e.target.files?.[0] ?? null);
                      setCreateError(null);
                    }}
                  />
                </div>
                {createError && (
                  <p className="text-xs text-destructive">{createError}</p>
                )}
                <Button size="sm" onClick={createClaim} disabled={!receiptFile}>
                  Submit claim
                </Button>
              </div>
            )}
          </div>
        }
        renderNotification={(n) => {
          const claim = claimsById.get(n.claim_request_id);
          const revised = isRevisionNotificationResolved(n, claim);

          return (
          <div
            className={`rounded-md border p-3 ${
              revised
                ? "border-teal-800/40 bg-teal-950/20"
                : n.type === "revision_requested"
                  ? "border-amber-700 bg-amber-950/30"
                  : ""
            }`}
          >
            <div className="flex justify-between gap-2">
              <span className="text-sm font-medium">{notificationDisplayLabel(n, claim)}</span>
              {!n.read && !revised && <Badge>New</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">{notificationDisplayMessage(n, claim)}</p>
            <p className="text-xs text-muted-foreground">{actingUserName}</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSelectedClaimId(n.claim_request_id)}>
                View claim
              </Button>
              {n.type === "revision_requested" && !revised && (
                <Button size="sm" onClick={() => setEditingClaimId(n.claim_request_id)}>
                  Edit claim
                </Button>
              )}
              {!n.read && !revised && (
                <Button size="sm" variant="outline" onClick={() => markRead([n.id])}>
                  Mark read
                </Button>
              )}
            </div>
            {editingClaimId === n.claim_request_id && !revised && (
              <div className="mt-2 space-y-2 border-t pt-2">
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <Input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
                <Button size="sm" onClick={() => updateClaim(n.claim_request_id)}>Save & resubmit</Button>
              </div>
            )}
          </div>
          );
        }}
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
