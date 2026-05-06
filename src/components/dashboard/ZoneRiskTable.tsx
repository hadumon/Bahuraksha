import { useQuery } from "@tanstack/react-query";
import RiskLevelBadge from "./RiskLevelBadge";
import { fetchRainfallForecasts, fetchRiskZones, fetchRiverStations } from "@/lib/operationalData";
import { getLatest } from "@/lib/bahuraksha-api";
import { computeCompositeRiskZones, normalizeRainfallForecasts } from "@/lib/riskEngine";
import { MapPin, Users, TrendingDown, TrendingUp, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function ZoneRiskTable() {
  const { data: zones = [] } = useQuery({
    queryKey: ["risk-zones"],
    queryFn: fetchRiskZones,
  });
  const { data: stations = [] } = useQuery({
    queryKey: ["river-stations"],
    queryFn: fetchRiverStations,
  });
  const { data: rainfallRows = [] } = useQuery({
    queryKey: ["rainfall-forecasts", "Bagmati Basin"],
    queryFn: () => fetchRainfallForecasts("Bagmati Basin"),
  });
  const { data: xgboostPrediction } = useQuery({
    queryKey: ["bahuraksha-latest-prediction"],
    queryFn: getLatest,
    retry: 1,
    staleTime: 1000 * 60 * 10,
  });

  const computedZones = computeCompositeRiskZones({
    zones,
    stations,
    rainfall: normalizeRainfallForecasts(rainfallRows),
    xgboostPrediction,
  });

  const sorted = [...computedZones].sort((a, b) => {
    const order = { evacuate: 0, warning: 1, watch: 2, safe: 3 } as const;
    return order[a.computedRiskLevel] - order[b.computedRiskLevel];
  });

  const getRiskIcon = (level: string) => {
    switch (level) {
      case "evacuate":
        return <TrendingDown className="h-3.5 w-3.5 text-risk-evacuate" />;
      case "warning":
        return <TrendingDown className="h-3.5 w-3.5 text-risk-warning" />;
      case "watch":
        return <Activity className="h-3.5 w-3.5 text-risk-watch" />;
      default:
        return <TrendingUp className="h-3.5 w-3.5 text-risk-safe" />;
    }
  };

  return (
    <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-card to-secondary/20 p-5 shadow-card">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ocean-400/15">
            <MapPin className="h-4 w-4 text-ocean-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Zone Risk Assessment</h3>
            <p className="text-xs text-muted-foreground">
              Composite risk from rainfall, gauges, XGBoost, HEC-RAS, and stored zone priors
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Total pop:</span>
            <span className="font-semibold text-foreground">
              {(sorted.reduce((acc, z) => acc + z.population, 0) / 1000000).toFixed(1)}M
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50">
              <th className="py-2.5 pl-2 pr-4 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Zone
              </th>
              <th className="py-2.5 px-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Risk Level
              </th>
              <th className="py-2.5 px-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Flood
              </th>
              <th className="py-2.5 px-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Landslide
              </th>
              <th className="py-2.5 pl-2 pr-4 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Population
              </th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {sorted.map((zone, index) => (
              <motion.tr
                key={zone.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "border-b border-border/30 transition-colors hover:bg-secondary/30",
                  zone.computedRiskLevel === "evacuate" && "bg-risk-evacuate/5",
                  zone.computedRiskLevel === "warning" && "bg-risk-warning/5",
                )}
              >
                <td className="py-3 pl-2 pr-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary/50">
                      {getRiskIcon(zone.computedRiskLevel)}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{zone.name}</p>
                      <p className="text-[11px] text-muted-foreground">{zone.district}</p>
                    </div>
                  </div>
                </td>

                <td className="py-3 px-2">
                  <RiskLevelBadge level={zone.computedRiskLevel} />
                </td>

                <td className="py-3 px-2 text-right">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="font-mono text-xs font-medium">
                      {(zone.computedFloodProb * 100).toFixed(0)}%
                    </span>
                    <div className="h-1 w-12 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          zone.computedFloodProb > 0.7 && "bg-risk-evacuate",
                          zone.computedFloodProb > 0.4 &&
                            zone.computedFloodProb <= 0.7 &&
                            "bg-risk-warning",
                          zone.computedFloodProb <= 0.4 && "bg-ocean-400",
                        )}
                        style={{ width: `${zone.computedFloodProb * 100}%` }}
                      />
                    </div>
                  </div>
                </td>

                <td className="py-3 px-2 text-right">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="font-mono text-xs font-medium">
                      {(zone.landslideProb * 100).toFixed(0)}%
                    </span>
                    <div className="h-1 w-12 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          zone.landslideProb > 0.7 && "bg-risk-evacuate",
                          zone.landslideProb > 0.4 &&
                            zone.landslideProb <= 0.7 &&
                            "bg-risk-warning",
                          zone.landslideProb <= 0.4 && "bg-ocean-400",
                        )}
                        style={{ width: `${zone.landslideProb * 100}%` }}
                      />
                    </div>
                  </div>
                </td>

                <td className="py-3 pl-2 pr-4 text-right">
                  <span className="font-mono text-xs text-foreground">
                    {zone.population.toLocaleString()}
                  </span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-risk-evacuate" />
            <span className="text-[10px] text-muted-foreground">
              {sorted.filter((z) => z.computedRiskLevel === "evacuate").length} Critical
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-risk-warning" />
            <span className="text-[10px] text-muted-foreground">
              {sorted.filter((z) => z.computedRiskLevel === "warning").length} Warning
            </span>
          </div>
        </div>

        <span className="text-[10px] text-muted-foreground">Composite risk engine</span>
      </div>
    </div>
  );
}
