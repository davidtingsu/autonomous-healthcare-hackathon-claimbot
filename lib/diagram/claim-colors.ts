const CLAIM_PALETTE = [
  "#6366f1",
  "#06b6d4",
  "#f59e0b",
  "#a78bfa",
  "#22c55e",
  "#f43f5e",
  "#e879f9",
  "#38bdf8",
  "#fb923c",
  "#84cc16",
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getClaimColor(claimId: string): string {
  return CLAIM_PALETTE[hashString(claimId) % CLAIM_PALETTE.length];
}
