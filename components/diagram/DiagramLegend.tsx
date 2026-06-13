"use client";

import { TIER_STYLES, STAGE_LEGEND } from "@/lib/diagram/nodes";

export function DiagramLegend() {
  return (
    <div className="space-y-2 border-b bg-card/80 px-4 py-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Automation tier
        </span>
        {Object.values(TIER_STYLES).map((tier) => (
          <span key={tier.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span
              className="inline-block size-2.5 rounded-sm"
              style={{ background: tier.color }}
            />
            {tier.label}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {STAGE_LEGEND.map((item) => (
          <span key={item.label} className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
            <span
              className="inline-block size-2 rounded-sm"
              style={{ background: item.color }}
            />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
