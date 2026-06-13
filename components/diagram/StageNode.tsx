"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { TIER_STYLES } from "@/lib/diagram/nodes";

export type StageNodeData = {
  label: string;
  color: string;
  who: string;
  tier: keyof typeof TIER_STYLES;
  tierNote: string;
  count: number;
  validationBadge?: string | null;
};

function StageNodeComponent({ data }: NodeProps & { data: StageNodeData }) {
  const tier = TIER_STYLES[data.tier];

  return (
    <div
      className="min-w-[128px] rounded-lg border bg-card px-2.5 py-2 text-center shadow-md"
      style={{
        borderColor: `${data.color}66`,
      }}
    >
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground" />
      <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold">
        <span
          className="inline-block size-2 shrink-0 rounded-full"
          style={{ background: data.color }}
        />
        <span>{data.label}</span>
      </div>
      {data.who && (
        <p className="mt-0.5 text-[8.5px] uppercase tracking-wide text-muted-foreground">
          {data.who}
        </p>
      )}
      <p className="mt-1 border-t border-border pt-1 text-sm font-bold">{data.count}</p>
      {data.validationBadge && (
        <span className="mt-1 inline-block rounded border px-1.5 py-0.5 text-[9px] text-muted-foreground">
          AI: {data.validationBadge}
        </span>
      )}
      <span
        className="mt-1 inline-block rounded px-1.5 py-0.5 text-[8px] font-bold tracking-wide"
        style={{ background: `${tier.color}18`, color: tier.color }}
      >
        {tier.label}
        {data.tierNote ? ` · ${data.tierNote}` : ""}
      </span>
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground" />
    </div>
  );
}

export const StageNode = memo(StageNodeComponent);
