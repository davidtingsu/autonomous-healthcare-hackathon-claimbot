export type DiagramEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
};

export const DIAGRAM_EDGES: DiagramEdge[] = [
  { id: "e-created-benefits", source: "created", target: "benefits_hitl" },
  { id: "e-benefits-submitted", source: "benefits_hitl", target: "submitted" },
  { id: "e-benefits-revision", source: "benefits_hitl", target: "revision" },
  { id: "e-benefits-cancelled", source: "benefits_hitl", target: "cancelled" },
  { id: "e-revision-created", source: "revision", target: "created", label: "resubmit" },
  {
    id: "e-submitted-processing",
    source: "submitted",
    target: "insurance_processing",
  },
  {
    id: "e-processing-hitl",
    source: "insurance_processing",
    target: "insurance_hitl",
  },
  { id: "e-hitl-notified", source: "insurance_hitl", target: "notified" },
];
