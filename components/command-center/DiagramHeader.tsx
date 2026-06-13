"use client";

import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { countActiveClaims } from "@/lib/diagram/claim-position";
import { useCommandCenter } from "@/lib/context/CommandCenterContext";
import { shortClaimId } from "@/lib/user-display";

type DiagramHeaderProps = {
  drawerOpen: boolean;
  onToggleDrawer: () => void;
};

export function DiagramHeader({ drawerOpen, onToggleDrawer }: DiagramHeaderProps) {
  const { claims, events, selectedClaimId, setSelectedClaimId } = useCommandCenter();

  const activeCount = countActiveClaims(claims, events);
  const totalCount = claims.length;

  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b bg-card/90 px-4 py-2.5">
      <div className="min-w-0">
        <h1 className="text-base font-semibold tracking-tight">Claims Command Center</h1>
        <p className="truncate text-xs text-muted-foreground">
          Lifecycle diagram · HITL actor panels in drawer
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 sm:flex">
          <span className="rounded-md border bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground">
            Active <b className="text-foreground">{activeCount}</b>
          </span>
          <span className="rounded-md border bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground">
            Total <b className="text-foreground">{totalCount}</b>
          </span>
        </div>

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
    </header>
  );
}
