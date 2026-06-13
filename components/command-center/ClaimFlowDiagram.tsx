"use client";

import { useEffect, useMemo } from "react";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Badge } from "@/components/ui/badge";
import { EVENT_TO_NODE } from "@/lib/types";
import { useCommandCenter } from "@/lib/context/CommandCenterContext";

const NODE_DEFS = [
  { id: "created", label: "Created", x: 0, y: 0 },
  { id: "benefits_hitl", label: "Benefits HITL", x: 220, y: 0 },
  { id: "revision", label: "Revision", x: 220, y: 120 },
  { id: "cancelled", label: "Cancelled", x: 440, y: 120 },
  { id: "submitted", label: "Submitted", x: 440, y: 0 },
  { id: "insurance_processing", label: "Insurance Processing", x: 660, y: 0 },
  { id: "insurance_hitl", label: "Insurance HITL", x: 880, y: 0 },
  { id: "notified", label: "Notified", x: 1100, y: 0 },
];

const EDGES = [
  ["created", "benefits_hitl"],
  ["benefits_hitl", "submitted"],
  ["benefits_hitl", "revision"],
  ["benefits_hitl", "cancelled"],
  ["revision", "created"],
  ["submitted", "insurance_processing"],
  ["insurance_processing", "insurance_hitl"],
  ["insurance_hitl", "notified"],
] as const;

export function ClaimFlowDiagram() {
  const { events, selectedClaimId, setSelectedClaimId } = useCommandCenter();

  const claimEvents = useMemo(() => {
    if (!selectedClaimId) return events.slice(0, 20);
    return events.filter((e) => e.claim_request_id === selectedClaimId);
  }, [events, selectedClaimId]);

  const activeNode = useMemo(() => {
    const latest = claimEvents[0];
    if (!latest) return "created";
    return EVENT_TO_NODE[latest.event_type] ?? "created";
  }, [claimEvents]);

  const validationBadge = useMemo(() => {
    const v = claimEvents.find((e) =>
      e.event_type.startsWith("receipt_validation")
    );
    if (!v) return null;
    return v.event_type.replace("receipt_validation_", "");
  }, [claimEvents]);

  const initialNodes = NODE_DEFS.map((n) => ({
    id: n.id,
    position: { x: n.x, y: n.y },
    data: {
      label: (
        <div className="text-center">
          <div>{n.label}</div>
          {n.id === "benefits_hitl" && validationBadge && (
            <Badge variant="outline" className="mt-1 text-[10px]">
              AI: {validationBadge}
            </Badge>
          )}
        </div>
      ),
    },
    style: {
      border:
        n.id === activeNode
          ? "2px solid rgb(20 184 166)"
          : n.id === "cancelled"
            ? "1px solid rgb(244 63 94)"
            : "1px solid rgb(71 85 105)",
      background: n.id === activeNode ? "rgba(20,184,166,0.15)" : "hsl(var(--card))",
      color: "hsl(var(--card-foreground))",
      borderRadius: 8,
      padding: 8,
      minWidth: 120,
      fontSize: 12,
    },
  }));

  const initialEdges = EDGES.map(([source, target], i) => ({
    id: `e-${i}`,
    source,
    target,
    animated: activeNode === target,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: activeNode === target ? "#14b8a6" : "#64748b" },
  }));

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    // initialNodes/initialEdges are recreated each render from activeNode state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNode, validationBadge, setNodes, setEdges]);

  return (
    <div className="h-72 rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <h2 className="text-sm font-semibold">Claim lifecycle</h2>
        {selectedClaimId && (
          <button
            type="button"
            className="text-xs text-teal-400 hover:underline"
            onClick={() => setSelectedClaimId(null)}
          >
            Clear selection
          </button>
        )}
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
