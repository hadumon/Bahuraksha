import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import RiskMap from "@/components/map/RiskMap";
import RiskLevelBadge from "@/components/dashboard/RiskLevelBadge";
import { useQuery } from "@tanstack/react-query";
import {
  fetchRainfallForecasts,
  fetchRiskZones,
  fetchRiverStations,
  type RiskLevel,
} from "@/lib/operationalData";
import { getLatest } from "@/lib/bahuraksha-api";
import { computeCompositeRiskZones, normalizeRainfallForecasts } from "@/lib/riskEngine";
import { persistRiskAssessments } from "@/lib/riskAssessments";

const legendItems: { level: RiskLevel; desc: string }[] = [
  { level: "safe", desc: "Normal conditions" },
  { level: "watch", desc: "Monitor closely" },
  { level: "warning", desc: "Prepare for action" },
  { level: "evacuate", desc: "Immediate evacuation" },
];

export default function RiskMapPage() {
  const [persistStatus, setPersistStatus] = useState<string | null>(null);
  const { data: zoneRisks = [] } = useQuery({
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
    zones: zoneRisks,
    stations,
    rainfall: normalizeRainfallForecasts(rainfallRows),
    xgboostPrediction,
  });

  const handlePersistAssessments = async () => {
    setPersistStatus("Saving assessments...");
    const result = await persistRiskAssessments(computedZones);
    setPersistStatus(
      result.error
        ? `Save failed: ${result.error}`
        : `Saved ${result.inserted} risk assessments and triggered alert automation.`,
    );
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Risk Map</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Composite risk overlay — rainfall + gauges + XGBoost + HEC-RAS
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePersistAssessments}
              className="rounded-lg border border-ocean-400/40 bg-ocean-400/10 px-3 py-1.5 text-xs font-medium text-ocean-400 hover:bg-ocean-400/20"
            >
              Persist assessments
            </button>
            {legendItems.map((item) => (
              <div key={item.level} className="flex items-center gap-1.5">
                <RiskLevelBadge level={item.level} />
              </div>
            ))}
          </div>
        </div>

        {persistStatus && <p className="text-xs text-muted-foreground">{persistStatus}</p>}

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          <div className="xl:col-span-3">
            <RiskMap className="h-[calc(100vh-180px)]" />
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Zones
            </h3>
            {computedZones.map((zone) => (
              <div key={zone.id} className="gradient-card p-3 rounded-lg border border-border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">{zone.name}</span>
                  <RiskLevelBadge level={zone.computedRiskLevel} />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Flood</p>
                    <div className="w-full h-1.5 bg-secondary rounded-full mt-1">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${zone.computedFloodProb * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Landslide</p>
                    <div className="w-full h-1.5 bg-secondary rounded-full mt-1">
                      <div
                        className="h-full rounded-full bg-risk-warning"
                        style={{ width: `${zone.landslideProb * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Data quality: {zone.dataQuality}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
