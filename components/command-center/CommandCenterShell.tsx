"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ActorDrawer } from "@/components/command-center/ActorDrawer";
import { ClaimFlowDiagram } from "@/components/command-center/ClaimFlowDiagram";
import { DiagramHeader } from "@/components/command-center/DiagramHeader";
import { EventLog } from "@/components/command-center/EventLog";

const DRAWER_STORAGE_KEY = "claimbot-actor-drawer-open";

function readDrawerOpen(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(DRAWER_STORAGE_KEY);
  return stored === null ? true : stored === "true";
}

export function CommandCenterShell() {
  const [drawerOpen, setDrawerOpen] = useState(readDrawerOpen);
  const [eventLogOpen, setEventLogOpen] = useState(true);

  function toggleDrawer() {
    setDrawerOpen((prev) => {
      const next = !prev;
      localStorage.setItem(DRAWER_STORAGE_KEY, String(next));
      return next;
    });
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <DiagramHeader drawerOpen={drawerOpen} onToggleDrawer={toggleDrawer} />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          className={`flex min-h-0 flex-1 flex-col transition-[margin] duration-200 ${
            drawerOpen ? "lg:mr-[420px]" : ""
          }`}
        >
          <ClaimFlowDiagram />

          <div className="shrink-0 border-t bg-card">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-muted/30"
              onClick={() => setEventLogOpen((open) => !open)}
            >
              <span className="text-sm font-semibold">Global event log</span>
              {eventLogOpen ? (
                <ChevronDown className="size-4 text-muted-foreground" />
              ) : (
                <ChevronUp className="size-4 text-muted-foreground" />
              )}
            </button>
            {eventLogOpen && <EventLog />}
          </div>
        </div>

        <ActorDrawer open={drawerOpen} onClose={() => toggleDrawer()} />
      </div>
    </div>
  );
}
