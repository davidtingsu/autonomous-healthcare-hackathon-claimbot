"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatUserLabel } from "@/lib/user-display";
import type { User } from "@/lib/types";

export function PanelUserFilter({
  users,
  value,
  onChange,
}: {
  users: User[];
  value: string | null;
  onChange: (userId: string | null) => void;
}) {
  return (
    <div>
      <Label className="text-xs">Filter by user</Label>
      <Select
        value={value ?? "all"}
        onValueChange={(v) => onChange(v === "all" ? null : v)}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="All users" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All users</SelectItem>
          {users.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              {formatUserLabel(user)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
