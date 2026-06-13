"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  ActorRole,
  ClaimEvent,
  ClaimRequest,
  Notification,
  User,
} from "@/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type CommandCenterContextValue = {
  actorRole: ActorRole;
  setActorRole: (role: ActorRole) => void;
  selectedUserId: string;
  setSelectedUserId: (id: string) => void;
  selectedDependentId: string | null;
  setSelectedDependentId: (id: string | null) => void;
  selectedClaimId: string | null;
  setSelectedClaimId: (id: string | null) => void;
  users: User[];
  claims: ClaimRequest[];
  events: ClaimEvent[];
  notifications: Notification[];
  refresh: () => Promise<void>;
  claimUserId: string;
};

const CommandCenterContext = createContext<CommandCenterContextValue | null>(
  null
);

export function CommandCenterProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [actorRole, setActorRole] = useState<ActorRole>("user");
  const [selectedUserId, setSelectedUserId] = useState(
    "11111111-1111-1111-1111-111111111101"
  );
  const [selectedDependentId, setSelectedDependentId] = useState<string | null>(
    null
  );
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [claims, setClaims] = useState<ClaimRequest[]>([]);
  const [events, setEvents] = useState<ClaimEvent[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const claimUserId = selectedDependentId ?? selectedUserId;

  const refresh = useCallback(async () => {
    const headers = { "X-Actor-Role": actorRole };
    const [usersRes, claimsRes, eventsRes, notifRes] = await Promise.all([
      fetch("/api/users"),
      fetch("/api/claims", { headers }),
      fetch("/api/events"),
      fetch(`/api/notifications?userId=${claimUserId}`, {
        headers: { "X-Actor-Role": "user" },
      }),
    ]);

    if (usersRes.ok) {
      const data = await usersRes.json();
      setUsers(data.users ?? []);
    }
    if (claimsRes.ok) {
      const data = await claimsRes.json();
      setClaims(data.claims ?? []);
    }
    if (eventsRes.ok) {
      const data = await eventsRes.json();
      setEvents(data.events ?? []);
    }
    if (notifRes.ok) {
      const data = await notifRes.json();
      setNotifications(data.notifications ?? []);
    }
  }, [actorRole, claimUserId]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(id);
  }, [refresh]);

  useEffect(() => {
    try {
      const supabase = createSupabaseBrowserClient();
      const channel = supabase
        .channel("command-center")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "claim_events" },
          () => refresh()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications" },
          () => refresh()
        )
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    } catch {
      const interval = setInterval(refresh, 5000);
      return () => clearInterval(interval);
    }
  }, [refresh]);

  const value = useMemo(
    () => ({
      actorRole,
      setActorRole,
      selectedUserId,
      setSelectedUserId,
      selectedDependentId,
      setSelectedDependentId,
      selectedClaimId,
      setSelectedClaimId,
      users,
      claims,
      events,
      notifications,
      refresh,
      claimUserId,
    }),
    [
      actorRole,
      selectedUserId,
      selectedDependentId,
      selectedClaimId,
      users,
      claims,
      events,
      notifications,
      refresh,
      claimUserId,
    ]
  );

  return (
    <CommandCenterContext.Provider value={value}>
      {children}
    </CommandCenterContext.Provider>
  );
}

export function useCommandCenter() {
  const ctx = useContext(CommandCenterContext);
  if (!ctx) throw new Error("useCommandCenter must be used within provider");
  return ctx;
}

export function actorHeaders(role: ActorRole) {
  return { "X-Actor-Role": role, "Content-Type": "application/json" };
}
