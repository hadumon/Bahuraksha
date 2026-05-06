import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import RiskLevelBadge from "@/components/dashboard/RiskLevelBadge";
import type { CompositeRiskZone } from "@/lib/riskEngine";
import { cn } from "@/lib/utils";

export default function RiskExplanationPanel({ zones }: { zones: CompositeRiskZone[] }) {
  const topZones = [...zones].sort((a, b) => b.compositeScore - a.compositeScore).slice(0, 3);

  return (
    <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-card to-secondary/20 p-5 shadow-card">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ocean-400/15">
          <Info className="h-4 w-4 text-ocean-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Why zones are risky</h3>
          <p className="text-xs text-muted-foreground">
            Composite drivers and data-quality score for the highest-risk zones
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {topZones.map((zone) => (
          <div key={zone.id} className="rounded-xl border border-border/70 bg-secondary/20 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-foreground">{zone.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Score {(zone.compositeScore * 100).toFixed(0)}% • Data quality {zone.dataQuality}
                </div>
              </div>
              <RiskLevelBadge level={zone.computedRiskLevel} />
            </div>

            <div className="mb-3 grid grid-cols-3 gap-2 text-[11px] md:grid-cols-6">
              {Object.entries(zone.drivers).map(([driver, value]) => (
                <div key={driver} className="rounded-lg bg-background/60 p-2">
                  <div className="truncate capitalize text-muted-foreground">{driver}</div>
                  <div className="font-mono font-semibold text-foreground">
                    {(value * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>

            <ul className="space-y-1 text-xs text-muted-foreground">
              {zone.explanation.map((item) => (
                <li key={item} className="flex gap-2">
                  {zone.computedRiskLevel === "evacuate" ? (
                    <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0 text-risk-evacuate" />
                  ) : (
                    <CheckCircle2
                      className={cn(
                        "mt-0.5 h-3 w-3 flex-shrink-0",
                        zone.computedRiskLevel === "warning"
                          ? "text-risk-warning"
                          : "text-risk-safe",
                      )}
                    />
                  )}
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
