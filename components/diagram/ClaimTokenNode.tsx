"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export type ClaimTokenNodeData = {
  label: string;
  color: string;
  selected: boolean;
  terminal: boolean;
  claimId: string;
};

function ClaimTokenNodeComponent({ data }: NodeProps & { data: ClaimTokenNodeData }) {
  return (
    <div
      className={`min-w-[88px] cursor-pointer rounded-full px-2 py-1 text-center text-[9px] font-bold text-white shadow-lg transition-transform hover:scale-105 ${
        data.selected ? "ring-2 ring-white ring-offset-2 ring-offset-background" : ""
      } ${data.terminal ? "opacity-70" : ""}`}
      style={{ background: data.color }}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <div className="leading-tight">{data.label}</div>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}

export const ClaimTokenNode = memo(ClaimTokenNodeComponent);
