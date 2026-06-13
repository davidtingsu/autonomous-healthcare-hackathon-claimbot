"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { eventSummary } from "@/lib/actor-feed";
import type { ClaimEvent, Notification } from "@/lib/types";

export function ActorEventFeed({
  events,
  notifications = [],
  emptyMessage = "No events yet",
  pinnedHeader,
  renderNotification,
  renderEvent,
  getEventMeta,
  heightClass = "h-[520px]",
}: {
  events: ClaimEvent[];
  notifications?: Notification[];
  emptyMessage?: string;
  pinnedHeader?: ReactNode;
  renderNotification?: (notification: Notification) => ReactNode;
  renderEvent?: (event: ClaimEvent) => ReactNode;
  getEventMeta?: (event: ClaimEvent) => string | undefined;
  heightClass?: string;
}) {
  const hasContent =
    events.length > 0 || notifications.length > 0 || Boolean(pinnedHeader);

  return (
    <ScrollArea className={`${heightClass} rounded-lg border bg-card`}>
      <div className="space-y-2 p-3">
        {pinnedHeader}

        {notifications.map((notification) =>
          renderNotification ? (
            <div key={notification.id}>{renderNotification(notification)}</div>
          ) : (
            <div key={notification.id} className="rounded-md border p-3">
              <div className="flex justify-between gap-2">
                <span className="text-sm font-medium">{notification.type}</span>
                {!notification.read && <Badge>New</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">{notification.message}</p>
            </div>
          )
        )}

        {events.map((event) =>
          renderEvent ? (
            <div key={event.id}>{renderEvent(event)}</div>
          ) : (
            <div key={event.id} className="rounded-md border px-3 py-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{event.event_type}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(event.created_at).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {getEventMeta?.(event) ?? eventSummary(event)}
              </p>
            </div>
          )
        )}

        {!hasContent && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        )}
      </div>
    </ScrollArea>
  );
}
