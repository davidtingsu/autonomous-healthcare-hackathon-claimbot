"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { ReceiptValidationAlert } from "@/components/panels/ReceiptValidationAlert";
import {
  actorHeaders,
  useCommandCenter,
} from "@/lib/context/CommandCenterContext";
import { filterEventsForActor } from "@/lib/actor-feed";
import { getClaimValidationState } from "@/lib/receipt-validation-display";
import type { ClaimRequest } from "@/lib/types";
import {
  buildUsersById,
  filterClaimsByUserId,
  filterEventsByClaimUser,
  getClaimUserName,
  shortClaimId,
} from "@/lib/user-display";

type ClaimCardProps = {
  claim: ClaimRequest;
  patientName: string;
  validation: ReturnType<typeof getClaimValidationState>;
  edit: { userId: string; amount: string; date: string };
  users: ReturnType<typeof useCommandCenter>["users"];
  receiptFile: File | null;
  statusLabel: string;
  statusClass: string;
  showReviewActions: boolean;
  busy: boolean;
  isAction: (action: string) => boolean;
  onSelect: () => void;
  onEditUser: (userId: string) => void;
  onEditDate: (date: string) => void;
  onEditAmount: (amount: string) => void;
  onReceiptChange: (file: File | null) => void;
  onSave: () => void;
  onRevise?: () => void;
  onSubmit?: () => void;
  onCancel?: () => void;
};

function BenefitsClaimCard({
  claim,
  patientName,
  validation,
  edit,
  users,
  receiptFile,
  statusLabel,
  statusClass,
  showReviewActions,
  busy,
  isAction,
  onSelect,
  onEditUser,
  onEditDate,
  onEditAmount,
  onReceiptChange,
  onSave,
  onRevise,
  onSubmit,
  onCancel,
}: ClaimCardProps) {
  return (
    <div className="rounded-md border border-amber-800/40 bg-amber-950/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="text-left text-sm font-semibold hover:text-teal-400"
          onClick={onSelect}
        >
          {patientName} · ${Number(claim.claimed_amount).toFixed(2)} ·{" "}
          {String(claim.service_date).slice(0, 10)}
        </button>
        <Badge className={statusClass}>{statusLabel}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">{shortClaimId(claim.id)}</p>

      <ReceiptValidationAlert
        issues={validation.issues}
        mode={validation.mode}
        passed={validation.passed}
        scanning={validation.scanning}
      />

      <div className="mt-3 grid gap-2">
        <div>
          <Label className="text-xs">User</Label>
          <Select value={edit.userId} onValueChange={(v) => v && onEditUser(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
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
          <Input type="date" value={edit.date} onChange={(e) => onEditDate(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Amount</Label>
          <Input
            type="number"
            value={edit.amount}
            onChange={(e) => onEditAmount(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Replace receipt (optional)</Label>
          <Input
            type="file"
            accept="image/*,application/pdf,.pdf"
            onChange={(e) => onReceiptChange(e.target.files?.[0] ?? null)}
          />
          {receiptFile && (
            <p className="mt-1 text-xs text-muted-foreground">{receiptFile.name}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={onSave}>
          {isAction("save") && <Loader2 className="animate-spin" />}
          {isAction("save") ? "Saving..." : "Save edits"}
        </Button>
        {showReviewActions && (
          <>
            <Button size="sm" variant="secondary" disabled={busy} onClick={onRevise}>
              {isAction("revise") && <Loader2 className="animate-spin" />}
              {isAction("revise") ? "Requesting..." : "Request revision"}
            </Button>
            <Button size="sm" disabled={busy} onClick={onSubmit}>
              {isAction("submit") && <Loader2 className="animate-spin" />}
              {isAction("submit") ? "Submitting..." : "Submit to insurance"}
            </Button>
            <Button size="sm" variant="destructive" disabled={busy} onClick={onCancel}>
              {isAction("cancel") && <Loader2 className="animate-spin" />}
              {isAction("cancel") ? "Cancelling..." : "Cancel for submission"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

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

  const revisionClaims = useMemo(
    () =>
      filterClaimsByUserId(
        claims.filter((claim) => claim.status === "revision_requested"),
        filterUserId
      ),
    [claims, filterUserId]
  );

  const benefitsEvents = useMemo(() => {
    const actorEvents = filterEventsForActor(events, claims, "benefits_company");
    return filterEventsByClaimUser(actorEvents, claims, filterUserId);
  }, [events, claims, filterUserId]);

  const [edits, setEdits] = useState<
    Record<string, { userId: string; amount: string; date: string }>
  >({});
  const [receiptFiles, setReceiptFiles] = useState<Record<string, File | null>>({});
  const [pending, setPending] = useState<{ claimId: string; action: string } | null>(null);

  function getEdit(claimId: string, claim: ClaimRequest) {
    return (
      edits[claimId] ?? {
        userId: claim.user_id,
        amount: String(claim.claimed_amount),
        date: String(claim.service_date).slice(0, 10),
      }
    );
  }

  function claimName(claim: ClaimRequest) {
    return getClaimUserName(claim, usersById);
  }

  async function saveEdits(claimId: string) {
    const edit = edits[claimId] ?? getEdit(claimId, claims.find((c) => c.id === claimId)!);
    const receiptFile = receiptFiles[claimId];

    setPending({ claimId, action: "save" });
    try {
      if (receiptFile) {
        const form = new FormData();
        form.append("userId", edit.userId);
        form.append("claimedAmount", edit.amount);
        form.append("serviceDate", edit.date);
        form.append("receipt", receiptFile);
        await fetch(`/api/claims/${claimId}`, {
          method: "PATCH",
          headers: { "X-Actor-Role": "benefits_company" },
          body: form,
        });
      } else {
        await fetch(`/api/claims/${claimId}`, {
          method: "PATCH",
          headers: actorHeaders("benefits_company"),
          body: JSON.stringify({
            userId: edit.userId,
            claimedAmount: Number(edit.amount),
            serviceDate: edit.date,
          }),
        });
      }
      setReceiptFiles((prev) => ({ ...prev, [claimId]: null }));
      await refresh();
    } finally {
      setPending(null);
    }
  }

  async function reviewAction(
    claimId: string,
    action: "revise" | "submit" | "cancel"
  ) {
    setPending({ claimId, action });
    try {
      await fetch(`/api/claims/${claimId}/benefits-review`, {
        method: "POST",
        headers: actorHeaders("benefits_company"),
        body: JSON.stringify({ action }),
      });
      await refresh();
    } finally {
      setPending(null);
    }
  }

  const pinnedClaimIds = new Set([
    ...reviewingClaims.map((c) => c.id),
    ...revisionClaims.map((c) => c.id),
  ]);

  const historyEvents = benefitsEvents.filter(
    (event) => !pinnedClaimIds.has(event.claim_request_id)
  );

  function renderClaimCard(claim: ClaimRequest, showReviewActions: boolean) {
    const patientName = claimName(claim);
    const validation = getClaimValidationState(claim, benefitsEvents, patientName);
    const edit = getEdit(claim.id, claim);
    const busy = pending?.claimId === claim.id;
    const isAction = (action: string) => busy && pending?.action === action;

    return (
      <BenefitsClaimCard
        key={claim.id}
        claim={claim}
        patientName={patientName}
        validation={validation}
        edit={edit}
        users={users}
        receiptFile={receiptFiles[claim.id] ?? null}
        statusLabel={claim.status.replace(/_/g, " ")}
        statusClass={
          claim.status === "revision_requested"
            ? "bg-orange-950/50 text-orange-400"
            : "bg-amber-950/50 text-amber-400"
        }
        showReviewActions={showReviewActions}
        busy={busy}
        isAction={isAction}
        onSelect={() => setSelectedClaimId(claim.id)}
        onEditUser={(userId) =>
          setEdits((prev) => ({
            ...prev,
            [claim.id]: { ...getEdit(claim.id, claim), userId },
          }))
        }
        onEditDate={(date) =>
          setEdits((prev) => ({
            ...prev,
            [claim.id]: { ...getEdit(claim.id, claim), date },
          }))
        }
        onEditAmount={(amount) =>
          setEdits((prev) => ({
            ...prev,
            [claim.id]: { ...getEdit(claim.id, claim), amount },
          }))
        }
        onReceiptChange={(file) =>
          setReceiptFiles((prev) => ({ ...prev, [claim.id]: file }))
        }
        onSave={() => saveEdits(claim.id)}
        onRevise={() => reviewAction(claim.id, "revise")}
        onSubmit={() => reviewAction(claim.id, "submit")}
        onCancel={() => reviewAction(claim.id, "cancel")}
      />
    );
  }

  return (
    <div className="space-y-3">
      <PanelUserFilter users={users} value={filterUserId} onChange={setFilterUserId} />
      <ActorEventFeed
        heightClass="h-[380px]"
        events={historyEvents}
        eventsDefaultOpen={false}
        emptyMessage="No claims awaiting benefits review"
        pinnedHeader={
          <>
            {reviewingClaims.map((claim) => renderClaimCard(claim, true))}
            {revisionClaims.map((claim) => renderClaimCard(claim, false))}
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
                {patientName ? `${patientName} · ${event.event_type.replace(/_/g, " ")}` : event.event_type.replace(/_/g, " ")}
              </p>
            </button>
          );
        }}
      />
    </div>
  );
}
