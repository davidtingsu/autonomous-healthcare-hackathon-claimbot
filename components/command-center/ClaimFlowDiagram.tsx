"use client";

import { useEffect, useMemo } from "react";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ClaimTokenNode } from "@/components/diagram/ClaimTokenNode";
import { DiagramLegend } from "@/components/diagram/DiagramLegend";
import { StageNode } from "@/components/diagram/StageNode";
import { getClaimColor } from "@/lib/diagram/claim-colors";
import {
  getClaimsByStage,
  getClaimStage,
  getTokenOffset,
  isTerminalStage,
} from "@/lib/diagram/claim-position";
import { DIAGRAM_EDGES } from "@/lib/diagram/edges";
import { STAGE_NODES } from "@/lib/diagram/nodes";
import { useCommandCenter } from "@/lib/context/CommandCenterContext";
import {
  buildUsersById,
  getClaimUserShortName,
  shortClaimId,
} from "@/lib/user-display";

const nodeTypes = {
  stage: StageNode,
  claimToken: ClaimTokenNode,
};

export function ClaimFlowDiagram() {
  const { users, claims, events, selectedClaimId, setSelectedClaimId } =
    useCommandCenter();
  const usersById = useMemo(() => buildUsersById(users), [users]);

  const claimsByStage = useMemo(
    () => getClaimsByStage(claims, events),
    [claims, events]
  );

  const activeTargetStages = useMemo(() => {
    const stages = new Set<string>();
    for (const claim of claims) {
      stages.add(getClaimStage(claim.id, events, claim));
    }
    return stages;
  }, [claims, events]);

  const validationByStage = useMemo(() => {
    const map = new Map<string, string>();
    for (const claim of claimsByStage.get("benefits_hitl") ?? []) {
      const validation = events.find(
        (event) =>
          event.claim_request_id === claim.id &&
          event.event_type.startsWith("receipt_validation_")
      );
      if (validation) {
        map.set(
          claim.id,
          validation.event_type.replace("receipt_validation_", "")
        );
      }
    }
    const first = [...map.values()][0];
    return first ?? null;
  }, [claimsByStage, events]);

  const { nodes: builtNodes, edges: builtEdges } = useMemo(() => {
    const nodes: Node[] = STAGE_NODES.map((stage) => {
      const count = claimsByStage.get(stage.id)?.length ?? 0;

      return {
        id: stage.id,
        type: "stage",
        position: { x: stage.x, y: stage.y },
        data: {
          label: stage.label,
          color: stage.color,
          who: stage.who,
          tier: stage.tier,
          tierNote: stage.tierNote,
          count,
          validationBadge:
            stage.id === "benefits_hitl" ? validationByStage : null,
        },
        draggable: false,
        selectable: false,
      };
    });

    for (const [stageId, stageClaims] of claimsByStage.entries()) {
      const stage = STAGE_NODES.find((item) => item.id === stageId);
      if (!stage) continue;

      stageClaims.forEach((claim, index) => {
        const offset = getTokenOffset(index, stageClaims.length);
        const shortName = getClaimUserShortName(claim, usersById);
        const label = `${shortName} · ${shortClaimId(claim.id)}`;

        nodes.push({
          id: `token-${claim.id}`,
          type: "claimToken",
          position: {
            x: stage.x + offset.x - 44,
            y: stage.y + offset.y,
          },
          data: {
            label,
            color: getClaimColor(claim.id),
            selected: selectedClaimId === claim.id,
            terminal: isTerminalStage(stageId),
            claimId: claim.id,
          },
          draggable: false,
        });
      });
    }

    const edges: Edge[] = DIAGRAM_EDGES.map((edge) => {
      const targetStage = STAGE_NODES.find((item) => item.id === edge.target);
      const color = targetStage?.color ?? "#64748b";
      const animated = activeTargetStages.has(edge.target);

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        animated,
        markerEnd: { type: MarkerType.ArrowClosed, color },
        style: {
          stroke: animated ? color : "#475569",
          strokeWidth: animated ? 2 : 1.5,
        },
        labelStyle: { fill: "#94a3b8", fontSize: 10 },
      };
    });

    return { nodes, edges };
  }, [
    claimsByStage,
    usersById,
    selectedClaimId,
    activeTargetStages,
    validationByStage,
  ]);

  const [nodes, setNodes, onNodesChange] = useNodesState(builtNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(builtEdges);

  useEffect(() => {
    setNodes(builtNodes);
    setEdges(builtEdges);
  }, [builtNodes, builtEdges, setNodes, setEdges]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card">
      <DiagramLegend />
      <div className="relative min-h-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, node) => {
            if (node.type === "claimToken" && node.data?.claimId) {
              setSelectedClaimId(node.data.claimId as string);
            }
          }}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          colorMode="dark"
          proOptions={{ hideAttribution: true }}
          className="h-full w-full"
          nodesDraggable={false}
          nodesConnectable={false}
        >
          <Background gap={20} color="#334155" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}
