import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import RiskMap from "@/components/map/RiskMap";
import LandslideMap from "@/components/map/LandslideMap";
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
import { predictBatchLandslideRisk, checkApiHealth } from "@/lib/landslideModel";

const NEPAL_LANDSLIDE_ZONES = [
  { id: "1", name: "Sindhupalchok", district: "Sindhupalchok", coordinates: [27.78, 85.85] as [number, number], slopeAngleDeg: 42, soilMoisturePct: 88, rainfall7DayMm: 320, rainfallTodayMm: 65, seismicActivityMg: 0.015, vegetationCoverPct: 25, elevationM: 1800, distanceToRoadKm: 0.3 },
  { id: "2", name: "Rasuwa", district: "Rasuwa", coordinates: [28.15, 85.35] as [number, number], slopeAngleDeg: 38, soilMoisturePct: 75, rainfall7DayMm: 210, rainfallTodayMm: 35, seismicActivityMg: 0.008, vegetationCoverPct: 45, elevationM: 2200, distanceToRoadKm: 0.8 },
  { id: "3", name: "Dolakha", district: "Dolakha", coordinates: [27.67, 86.18] as [number, number], slopeAngleDeg: 28, soilMoisturePct: 55, rainfall7DayMm: 120, rainfallTodayMm: 15, seismicActivityMg: 0.003, vegetationCoverPct: 65, elevationM: 1400, distanceToRoadKm: 2.5 },
  { id: "4", name: "Gorkha", district: "Gorkha", coordinates: [28.00, 84.63] as [number, number], slopeAngleDeg: 35, soilMoisturePct: 70, rainfall7DayMm: 180, rainfallTodayMm: 25, seismicActivityMg: 0.005, vegetationCoverPct: 50, elevationM: 1600, distanceToRoadKm: 1.2 },
  { id: "5", name: "Kaski", district: "Kaski", coordinates: [28.24, 83.98] as [number, number], slopeAngleDeg: 32, soilMoisturePct: 60, rainfall7DayMm: 150, rainfallTodayMm: 20, seismicActivityMg: 0.002, vegetationCoverPct: 55, elevationM: 1200, distanceToRoadKm: 1.8 },
  { id: "6", name: "Lamjung", district: "Lamjung", coordinates: [28.22, 84.38] as [number, number], slopeAngleDeg: 40, soilMoisturePct: 80, rainfall7DayMm: 250, rainfallTodayMm: 45, seismicActivityMg: 0.01, vegetationCoverPct: 35, elevationM: 1800, distanceToRoadKm: 0.6 },
  { id: "7", name: "Myagdi", district: "Myagdi", coordinates: [28.42, 83.55] as [number, number], slopeAngleDeg: 45, soilMoisturePct: 65, rainfall7DayMm: 160, rainfallTodayMm: 18, seismicActivityMg: 0.004, vegetationCoverPct: 40, elevationM: 2000, distanceToRoadKm: 1.5 },
  { id: "8", name: "Baglung", district: "Baglung", coordinates: [28.27, 83.60] as [number, number], slopeAngleDeg: 38, soilMoisturePct: 72, rainfall7DayMm: 200, rainfallTodayMm: 30, seismicActivityMg: 0.006, vegetationCoverPct: 48, elevationM: 1500, distanceToRoadKm: 0.9 },
];

function LandslideZoneList() {
  const { data: apiAvailable = false } = useQuery({
    queryKey: ["landslide-api-health-sidebar"],
    queryFn: checkApiHealth,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const { data: predictions = [], isLoading } = useQuery({
    queryKey: ["landslide-predictions-sidebar", apiAvailable],
    queryFn: () => predictBatchLandslideRisk(NEPAL_LANDSLIDE_ZONES),
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
        {apiAvailable ? "XGBoost ML model" : "Heuristic fallback"}
      </p>
      {sorted.map((pred) => (
        <div key={pred.id} className="gradient-card p-3 rounded-lg border border-border">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-foreground">{pred.name}</span>
            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
              pred.riskLevel === "evacuate" ? "bg-red-500/20 text-red-500" :
              pred.riskLevel === "warning" ? "bg-amber-500/20 text-amber-500" :
              pred.riskLevel === "watch" ? "bg-emerald-500/20 text-emerald-500" :
              "bg-blue-400/20 text-blue-400"
            }`}>
              {pred.riskLevel}
            </span>
          </div>
          <div className="w-full h-1.5 bg-secondary rounded-full mt-2">
            <div
              className={`h-full rounded-full ${
                pred.riskLevel === "evacuate" ? "bg-red-500" :
                pred.riskLevel === "warning" ? "bg-amber-500" :
                pred.riskLevel === "watch" ? "bg-emerald-500" :
                "bg-blue-400"
              }`}
              style={{ width: `${pred.probability * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            {(pred.probability * 100).toFixed(0)}% · {pred.primaryDriver}
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
                ? "Composite risk overlay — rainfall + gauges + XGBoost + HEC-RAS"
                : "ML-powered landslide susceptibility predictions"}
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
