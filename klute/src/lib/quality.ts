import type { FindingKind } from "./fgs";

export const KIND_COLOUR: Record<FindingKind, string> = {
  missing: "#E5484D",
  zero: "#B91C1C",
  negative: "#9333EA",
  low: "#F97316",
  dip: "#F59E0B",
  partial: "#EAB308",
  spike: "#2563EB",
  flat: "#6B7280",
};
