export const RISK_THRESHOLDS = {
  evacuate: 0.78,
  warning: 0.58,
  watch: 0.32,
} as const;

export function riskLevelFromScore(score: number): "evacuate" | "warning" | "watch" | "safe" {
  if (score >= RISK_THRESHOLDS.evacuate) return "evacuate";
  if (score >= RISK_THRESHOLDS.warning) return "warning";
  if (score >= RISK_THRESHOLDS.watch) return "watch";
  return "safe";
}
