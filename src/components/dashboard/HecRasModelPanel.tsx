import { AlertTriangle, Gauge, GitBranch, Waves } from "lucide-react";
import RiskLevelBadge from "@/components/dashboard/RiskLevelBadge";
import { useQuery } from "@tanstack/react-query";
import {
  getRoutingSummary,
  hecRasCrossSections,
  syntheticRoutingMetadata,
  fetchSyntheticRoutingResults,
} from "@/lib/hecrasModel";

export default function HecRasModelPanel() {
  const { data: results = [] } = useQuery({
    queryKey: ["synthetic-routing"],
    queryFn: fetchSyntheticRoutingResults,
  });

  const summary = getRoutingSummary(results);

  if (!summary || results.length === 0) {
    return (
      <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-secondary/10 p-5 shadow-card flex items-center justify-center min-h-[300px] relative overflow-hidden">
        <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/5 blur-3xl" />
        <div className="animate-pulse flex items-center gap-2 relative">
          <Waves className="h-5 w-5 text-primary" />
          <span className="text-muted-foreground text-sm">Computing routing engine...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-secondary/10 p-5 shadow-card overflow-hidden relative">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/5 blur-3xl" />

      <div className="relative">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
              <Waves className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {syntheticRoutingMetadata.modelType}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Live Forecast • {syntheticRoutingMetadata.reach}
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary max-w-xl">
            <div className="flex items-start gap-2">
              <Gauge className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{syntheticRoutingMetadata.disclaimer}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <Metric label="Modeled stations" value={summary.stationCount.toString()} />
          <Metric label="Warning reaches" value={summary.warningCount.toString()} accent />
          <Metric label="Evacuation reaches" value={summary.evacuationCount.toString()} danger />
          <Metric label="Peak arrival" value={`${summary.maxArrivalTimeHours.toFixed(1)}h`} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Gauge className="h-4 w-4 text-primary" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Synthetic Station Outputs
              </h4>
            </div>
            <div className="space-y-2">
              {results.map((result) => {
                const thresholdRatio = result.waterSurfaceM / result.dangerLevelM;
                return (
                  <div
                    key={result.stationId}
                    className="rounded-lg border border-border/70 bg-secondary/20 p-3 station-card"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          {result.stationName}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          River km {result.riverKm} • {result.flowCms} m³/s • peak +
                          {result.arrivalTimeHours.toFixed(1)}h
                        </div>
                      </div>
                      <RiskLevelBadge level={result.riskLevel} />
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          result.riskLevel === "evacuate"
                            ? "bg-risk-evacuate"
                            : result.riskLevel === "warning"
                              ? "bg-risk-warning"
                              : "bg-primary"
                        }`}
                        style={{
                          width: `${Math.min(thresholdRatio * 100, 100)}%`,
                          boxShadow: result.riskLevel === "evacuate"
                            ? "0 0 12px hsl(var(--risk-evacuate) / 0.4)"
                            : result.riskLevel === "warning"
                              ? "0 0 12px hsl(var(--risk-warning) / 0.3)"
                              : "0 0 12px hsl(var(--primary) / 0.2)",
                        }}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>WSE: {result.waterSurfaceM.toFixed(2)} m</span>
                      <span>Depth: {result.depthM.toFixed(2)} m</span>
                      <span>Velocity: {result.velocityMs.toFixed(2)} m/s</span>
                      <span>Danger: {result.dangerLevelM.toFixed(1)} m</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <GitBranch className="h-4 w-4 text-primary" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Geometry Design Cross Sections
              </h4>
            </div>
            <div className="overflow-hidden rounded-lg border border-border/70">
              <table className="w-full text-xs">
                <thead className="bg-secondary/50 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Section</th>
                    <th className="px-3 py-2 text-right font-medium">km</th>
                    <th className="px-3 py-2 text-right font-medium">Width</th>
                    <th className="px-3 py-2 text-right font-medium">n channel</th>
                  </tr>
                </thead>
                <tbody>
                  {hecRasCrossSections.map((section) => (
                    <tr key={section.id} className="border-t border-border/60 hover:bg-secondary/30 transition-colors">
                      <td className="px-3 py-2 text-foreground">{section.stationName}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {section.riverKm.toFixed(1)}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {section.bankfullWidthM} m
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {section.channelN.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Physical parameters currently computed dynamically based on live Open-Meteo rainfall using Manning's Equation and Muskingum routing curves.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  danger = false,
  accent = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
  accent?: boolean;
}) {
  const colorClass = danger
    ? "text-risk-evacuate"
    : accent
      ? "text-accent"
      : "text-foreground";

  return (
    <div className="rounded-xl border border-border/70 bg-secondary/20 p-3 station-card">
      <div className={`text-2xl font-bold ${colorClass}`}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
