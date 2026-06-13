"use client";

import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  computeClaimAggregateStats,
  formatClaimAmount,
} from "@/lib/claim-stats";
import { useCommandCenter } from "@/lib/context/CommandCenterContext";
import { shortClaimId } from "@/lib/user-display";

type DiagramHeaderProps = {
  drawerOpen: boolean;
  onToggleDrawer: () => void;
};

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald" | "default";
}) {
  return (
    <div
      className={`min-w-[140px] flex-1 rounded-lg border px-4 py-3 sm:min-w-[180px] ${
        accent === "emerald"
          ? "border-emerald-800/50 bg-emerald-950/30"
          : "border-border bg-muted/30"
      }`}
    >
      <span
        className={`block text-xs font-medium uppercase tracking-wide sm:text-sm ${
          accent === "emerald" ? "text-emerald-400/80" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
      <span
        className={`mt-1 block text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl ${
          accent === "emerald" ? "text-emerald-200" : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function DiagramHeader({ drawerOpen, onToggleDrawer }: DiagramHeaderProps) {
  const { claims, selectedClaimId, setSelectedClaimId } = useCommandCenter();

  const { claimCount, totalClaimedAmount, approvedClaimedAmount } =
    computeClaimAggregateStats(claims);

  return (
    <header className="shrink-0 border-b bg-card/90">
      <div className="flex items-center justify-between gap-4 px-4 py-2.5">
        <div className="min-w-0">
          <h1 className="text-base font-semibold tracking-tight">
            Claims Command Center
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            Lifecycle diagram · HITL actor panels in drawer
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedClaimId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedClaimId(null)}
            >
              Clear {shortClaimId(selectedClaimId)}
            </Button>
          )}

          <Button size="sm" variant="secondary" className="gap-1.5" onClick={onToggleDrawer}>
            {drawerOpen ? (
              <>
                <PanelRightClose className="size-4" />
                Hide panel
              </>
            ) : (
              <>
                <PanelRightOpen className="size-4" />
                Actor panel
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-stretch gap-3 border-t border-border/60 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
        <StatPill label="Claims" value={String(claimCount)} />
        <StatPill label="Total claimed" value={formatClaimAmount(totalClaimedAmount)} />
        <StatPill
          label="Approved claimed"
          value={formatClaimAmount(approvedClaimedAmount)}
          accent="emerald"
        />
      </div>
    </header>
  );
}
