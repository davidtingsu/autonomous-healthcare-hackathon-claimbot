"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleSwitcher } from "@/components/command-center/RoleSwitcher";
import { BenefitsPanel } from "@/components/panels/BenefitsPanel";
import { InsurancePanel } from "@/components/panels/InsurancePanel";
import { UserPanel } from "@/components/panels/UserPanel";
import { useCommandCenter } from "@/lib/context/CommandCenterContext";

function ActorPanel() {
  const { actorRole } = useCommandCenter();
  if (actorRole === "benefits_company") return <BenefitsPanel />;
  if (actorRole === "insurance_company") return <InsurancePanel />;
  return <UserPanel />;
}

type ActorDrawerProps = {
  open: boolean;
  onClose: () => void;
};

export function ActorDrawer({ open, onClose }: ActorDrawerProps) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close actor panel"
        className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col border-l bg-background shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Actor panel</h2>
            <p className="text-xs text-muted-foreground">Switch role and take actions</p>
          </div>
          <Button size="icon-sm" variant="ghost" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <RoleSwitcher />
          <ActorPanel />
        </div>
      </aside>
    </>
  );
}
