import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
import RiskMap from "@/components/map/RiskMap";
import LandslideMap from "@/components/map/LandslideMap";
import RiskLevelBadge from "@/components/dashboard/RiskLevelBadge";
import {
  fetchRainfallForecasts,
  fetchRiskZones,
  fetchRiverStations,
  type RiskLevel,
} from "@/lib/operationalData";
import { getLatest } from "@/lib/bahuraksha-api";
import { computeCompositeRiskZones, normalizeRainfallForecasts } from "@/lib/riskEngine";
import { persistRiskAssessments } from "@/lib/riskAssessments";
import { fetchLatestLandslidePredictions } from "@/lib/landslidePersistence";

function LandslideZoneList() {
  const { data: predictions = [], isLoading } = useQuery({
    queryKey: ["landslide-predictions-sidebar", "supabase", "ml-api"],
    queryFn: async () => {
      const rows = await fetchLatestLandslidePredictions();
      return rows.filter((row) => row.model_source === "ml-api");
    },
    staleTime: 1000 * 60 * 10,
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading predictions...</p>;
  }

  const sorted = [...predictions].sort((a, b) => b.probability - a.probability);

  return (
    <>
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
        Susceptible Zones
      </h3>
      <p className="text-[10px] text-muted-foreground">
        {sorted.length ? "Persisted ML API predictions" : "No live ML predictions available"}
      </p>
      {sorted.map((pred) => (
        <div key={pred.id ?? pred.zone_id} className="gradient-card p-3 rounded-lg border border-border">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-foreground">{pred.zone_name}</span>
            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
              pred.risk_level === "evacuate" ? "bg-red-500/20 text-red-500" :
              pred.risk_level === "warning" ? "bg-amber-500/20 text-amber-500" :
              pred.risk_level === "watch" ? "bg-emerald-500/20 text-emerald-500" :
              "bg-blue-400/20 text-blue-400"
            }`}>
              {pred.risk_level}
            </span>
          </div>
          <div className="w-full h-1.5 bg-secondary rounded-full mt-2">
            <div
              className={`h-full rounded-full ${
                pred.risk_level === "evacuate" ? "bg-red-500" :
                pred.risk_level === "warning" ? "bg-amber-500" :
                pred.risk_level === "watch" ? "bg-emerald-500" :
                "bg-blue-400"
              }`}
              style={{ width: `${pred.probability * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            {(pred.probability * 100).toFixed(0)}% - {pred.primary_driver}
          </p>
        </div>
      ))}
    </>
  );
}

const legendItems: { level: RiskLevel; desc: string }[] = [
  { level: "safe", desc: "Normal conditions" },
  { level: "watch", desc: "Monitor closely" },
  { level: "warning", desc: "Prepare for action" },
  { level: "evacuate", desc: "Immediate evacuation" },
];

export default function RiskMapPage() {
  const [persistStatus, setPersistStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"flood" | "landslide">("flood");
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
              {activeTab === "flood"
                ? "Composite risk overlay - rainfall + gauges + XGBoost + HEC-RAS"
                : "Persisted landslide susceptibility predictions from Supabase"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setActiveTab("flood")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === "flood"
                    ? "bg-primary/20 text-primary"
                    : "bg-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Flood Risk
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("landslide")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === "landslide"
                    ? "bg-primary/20 text-primary"
                    : "bg-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Landslide
              </button>
            </div>
            {activeTab === "flood" && (
              <>
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
              </>
            )}
          </div>
        </div>

        {persistStatus && <p className="text-xs text-muted-foreground">{persistStatus}</p>}

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          <div className="xl:col-span-3">
            {activeTab === "flood" ? (
              <RiskMap className="h-[calc(100vh-180px)]" />
            ) : (
              <LandslideMap className="h-[calc(100vh-180px)]" />
            )}
          </div>
          <div className="space-y-3">
            {activeTab === "flood" ? (
              <>
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
              </>
            ) : (
              <LandslideZoneList />
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
