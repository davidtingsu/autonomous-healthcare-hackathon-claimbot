"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCommandCenter } from "@/lib/context/CommandCenterContext";
import type { ActorRole } from "@/lib/types";

const ROLES: { value: ActorRole; label: string; accent: string }[] = [
  { value: "user", label: "User", accent: "border-teal-500/50" },
  { value: "benefits_company", label: "Benefits Company", accent: "border-indigo-500/50" },
  { value: "insurance_company", label: "Insurance Company", accent: "border-violet-500/50" },
];

export function RoleSwitcher() {
  const { actorRole, setActorRole } = useCommandCenter();
  const current = ROLES.find((r) => r.value === actorRole);

  return (
    <div className={`rounded-lg border p-3 ${current?.accent ?? ""} bg-card`}>
      <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
        Active actor
      </p>
      <Select value={actorRole} onValueChange={(v) => setActorRole(v as ActorRole)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLES.map((role) => (
            <SelectItem key={role.value} value={role.value}>
              {role.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
