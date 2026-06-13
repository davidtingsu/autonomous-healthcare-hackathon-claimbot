"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { eventSummary } from "@/lib/actor-feed";
import { useCommandCenter } from "@/lib/context/CommandCenterContext";

export function EventLog() {
  const { events, selectedClaimId, setSelectedClaimId } = useCommandCenter();

  const filtered = selectedClaimId
    ? events.filter((e) => e.claim_request_id === selectedClaimId)
    : events;

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Global event log</h2>
        <p className="text-xs text-muted-foreground">
          {selectedClaimId ? "Filtered to selected claim" : "All claims"}
        </p>
      </div>
      <ScrollArea className="h-56">
        <div className="space-y-1 p-2">
          {filtered.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => setSelectedClaimId(event.claim_request_id)}
              className="w-full rounded-md border border-transparent px-3 py-2 text-left text-sm hover:border-border hover:bg-muted/40"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{event.event_type}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(event.created_at).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {eventSummary(event)} · {event.actor_role}
              </p>
            </button>
          ))}
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
