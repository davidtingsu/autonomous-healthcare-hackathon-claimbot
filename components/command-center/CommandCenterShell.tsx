"use client";

import { ClaimFlowDiagram } from "@/components/command-center/ClaimFlowDiagram";
import { EventLog } from "@/components/command-center/EventLog";
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

export function CommandCenterShell() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 px-6 py-4">
        <h1 className="text-xl font-semibold tracking-tight">Claims Command Center</h1>
        <p className="text-sm text-muted-foreground">
          Interactive claim lifecycle with HITL actor panels
        </p>
      </header>
      <main className="grid gap-4 p-4 lg:grid-cols-12">
        <section className="space-y-4 lg:col-span-7">
          <ClaimFlowDiagram />
          <EventLog />
        </section>
        <section className="space-y-4 lg:col-span-5">
          <RoleSwitcher />
          <ActorPanel />
        </section>
      </main>
    </div>
  );
}
