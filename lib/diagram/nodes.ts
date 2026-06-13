export type AutomationTier = "auto" | "agent" | "assist" | "human" | "rule";

export type StageNodeDef = {
  id: string;
  label: string;
  x: number;
  y: number;
  color: string;
  who: string;
  tier: AutomationTier;
  tierNote: string;
};

export const TIER_STYLES: Record<
  AutomationTier,
  { label: string; color: string }
> = {
  auto: { label: "Fully Automated", color: "#22c55e" },
  agent: { label: "AI Agent", color: "#38bdf8" },
  assist: { label: "AI Assist", color: "#f59e0b" },
  human: { label: "Human Only", color: "#ef4444" },
  rule: { label: "Rule / Terminal", color: "#64748b" },
};

export const STAGE_NODES: StageNodeDef[] = [
  {
    id: "created",
    label: "Created",
    x: 0,
    y: 0,
    color: "#6366f1",
    who: "user",
    tier: "human",
    tierNote: "user action",
  },
  {
    id: "benefits_hitl",
    label: "Benefits HITL",
    x: 240,
    y: 0,
    color: "#f59e0b",
    who: "benefits reviewer",
    tier: "assist",
    tierNote: "AI receipt validation",
  },
  {
    id: "revision",
    label: "Revision",
    x: 240,
    y: 160,
    color: "#38bdf8",
    who: "user resubmit",
    tier: "agent",
    tierNote: "revision loop",
  },
  {
    id: "cancelled",
    label: "Cancelled",
    x: 480,
    y: 160,
    color: "#ef4444",
    who: "terminal",
    tier: "rule",
    tierNote: "",
  },
  {
    id: "submitted",
    label: "Submitted",
    x: 480,
    y: 0,
    color: "#06b6d4",
    who: "to insurance",
    tier: "auto",
    tierNote: "ledger write",
  },
  {
    id: "insurance_processing",
    label: "Insurance Processing",
    x: 720,
    y: 0,
    color: "#8b5cf6",
    who: "insurer intake",
    tier: "rule",
    tierNote: "external step",
  },
  {
    id: "insurance_hitl",
    label: "Insurance HITL",
    x: 960,
    y: 0,
    color: "#fb923c",
    who: "insurance reviewer",
    tier: "human",
    tierNote: "approve / deny",
  },
  {
    id: "notified",
    label: "Notified",
    x: 1200,
    y: 0,
    color: "#22c55e",
    who: "user notified",
    tier: "auto",
    tierNote: "match complete",
  },
];

export const STAGE_BY_ID = Object.fromEntries(
  STAGE_NODES.map((node) => [node.id, node])
) as Record<string, StageNodeDef>;

export const TERMINAL_STAGES = new Set(["cancelled", "notified"]);

export const STAGE_LEGEND = STAGE_NODES.map((node) => ({
  color: node.color,
  label: node.label,
}));
