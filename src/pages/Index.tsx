import { useEffect, useMemo } from "react";
import { motion, type Variants } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Satellite,
  Users,
  Gauge,
  Brain,
  Shield,
  Radio,
  Mountain,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
import StatCard from "@/components/dashboard/StatCard";
import AlertFeed from "@/components/dashboard/AlertFeed";
import RiverLevelChart from "@/components/dashboard/RiverLevelChart";
import ZoneRiskTable from "@/components/dashboard/ZoneRiskTable";
import RainfallChart from "@/components/dashboard/RainfallChart";
import {
  fetchDashboardStats,
  fetchRainfallForecasts,
  fetchRiskZones,
  fetchRiverStations,
} from "@/lib/operationalData";
import ModelStatusPanel from "@/components/dashboard/ModelStatusPanel";
import RiskExplanationPanel from "@/components/dashboard/RiskExplanationPanel";
import { computeCompositeRiskZones, normalizeRainfallForecasts } from "@/lib/riskEngine";
import { getLatest, getHistory } from "@/lib/bahuraksha-api";
import { fetchSyntheticRoutingResults } from "@/lib/hecrasModel";
import type { LandslideZoneInput } from "@/lib/landslideModel";
import { predictBatchLandslideRisk, checkApiHealth } from "@/lib/landslideModel";
import type { LiveRiskZone } from "@/lib/operationalData";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type AlertRow = {
  id: string;
  type: "flood" | "landslide";
  severity: "safe" | "watch" | "warning" | "evacuate";
  title: string;
  message: string;
  zone: string;
  created_at?: string;
  is_active: boolean;
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  },
};

function zonesToLandslideInput(
  zones: LiveRiskZone[],
): LandslideZoneInput[] {
  if (!zones.length) return [];
  return zones.map((z, i) => ({
    id: z.id ?? `zone-${i}`,
    name: z.name,
    district: z.district,
    coordinates: z.coordinates,
    slopeAngleDeg: z.name.includes("Kirtipur") || z.name.includes("Budhanilkantha") ? 22 : 10,
    soilMoisturePct: 50,
    rainfall7DayMm: 35,
    rainfallTodayMm: 8,
    seismicActivityMg: 0.008,
    vegetationCoverPct: z.name.includes("Budhanilkantha") ? 45 : 20,
    elevationM: z.name.includes("Budhanilkantha") ? 1600 : z.name.includes("Kirtipur") ? 1450 : 1350,
    distanceToRoadKm: 0.5,
  }));
}

export default function Index() {
  const queryClient = useQueryClient();

  // Fetch today's flood/glacier prediction
  // Fetch flood/glacier risk history for the last 7 days
  const { data: history, isLoading: isHistoryLoading } = useQuery({
    queryKey: ["bahuraksha-history", 7],
    queryFn: () => getHistory(7),
    staleTime: 1000 * 60 * 10,
  });
  const { data: prediction, isLoading: isPredictionLoading } = useQuery({
    queryKey: ["bahuraksha-latest-prediction"],
    queryFn: getLatest,
    staleTime: 1000 * 60 * 10, // 10 min
  });

  const { data: alerts = [], isLoading } = useQuery<AlertRow[]>({
    queryKey: ["alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchDashboardStats,
  });
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
  const { data: hecRasResults } = useQuery({
    queryKey: ["hec-ras-routing"],
    queryFn: fetchSyntheticRoutingResults,
    staleTime: 1000 * 60 * 15,
    retry: 1,
  });
  const computedZones = computeCompositeRiskZones({
    zones,
    stations,
    rainfall: normalizeRainfallForecasts(rainfallRows),
    xgboostPrediction: prediction,
    hecRasResults,
  });

  const landslideZoneInputs = useMemo(() => zonesToLandslideInput(zones), [zones]);

  const { data: landslideApiAvailable = false } = useQuery({
    queryKey: ["landslide-api-health-dashboard"],
    queryFn: checkApiHealth,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const { data: landslidePredictions = [] } = useQuery({
    queryKey: ["landslide-predictions-dashboard", landslideApiAvailable, zones.length],
    queryFn: () =>
      landslideZoneInputs.length
        ? predictBatchLandslideRisk(landslideZoneInputs)
        : Promise.resolve([]),
    staleTime: 1000 * 60 * 10,
  });

  const landslideStats = useMemo(() => {
    if (!landslidePredictions.length) return { maxProb: 0, highRiskCount: 0, avgConfidence: 0, maxRiskLevel: "safe" as const };
    const maxProb = Math.max(...landslidePredictions.map((p) => p.probability));
    const highRiskCount = landslidePredictions.filter((p) => p.riskLevel === "evacuate" || p.riskLevel === "warning").length;
    const avgConfidence = landslidePredictions.reduce((sum, p) => sum + p.confidence, 0) / landslidePredictions.length;
    const maxRiskLevel = maxProb >= 0.78 ? "evacuate" : maxProb >= 0.58 ? "warning" : maxProb >= 0.32 ? "watch" : "safe";
    return { maxProb, highRiskCount, avgConfidence, maxRiskLevel };
  }, [landslidePredictions]);

  useEffect(() => {
    const channel = supabase
      .channel("alerts-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => {
        queryClient.invalidateQueries({ queryKey: ["alerts"] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const activeAlerts = alerts.filter((alert) => alert.is_active).length;
  const hasCriticalAlerts = alerts.some((a) => a.is_active && a.severity === "evacuate");

  return (
    <AppLayout>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="p-4 md:p-6 lg:p-8 space-y-6"
      >
        {/* Header */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border/50"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-ocean-400 to-ocean-600 shadow-glow">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Command Dashboard
              </h1>
              <p className="text-sm text-muted-foreground">
                Bagmati Basin • Real-time flood & landslide intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex items-center gap-2 rounded-full border px-4 py-2",
                hasCriticalAlerts
                  ? "border-risk-evacuate/50 bg-risk-evacuate/10"
                  : "border-ocean-400/30 bg-ocean-400/10",
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full animate-pulse",
                  hasCriticalAlerts ? "bg-risk-evacuate" : "bg-ocean-400",
                )}
              />
              <Radio className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">
                System {hasCriticalAlerts ? "Alert" : "Online"}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Stats row */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4"
        >
          <StatCard
            title="Active Alerts"
            value={isLoading ? "—" : activeAlerts}
            icon={AlertTriangle}
            variant={activeAlerts > 0 ? "danger" : "default"}
            subtitle={`${activeAlerts} active`}
            trend={activeAlerts > 0 ? "up" : "neutral"}
            trendValue={activeAlerts > 0 ? "live" : "none"}
          />
          <StatCard
            title="Stations"
            value={stats?.totalStations ?? "—"}
            icon={Activity}
            variant="primary"
            subtitle="From live database"
            trend="neutral"
          />
          <StatCard
            title="Sensors"
            value={stats?.activeSensors ?? "—"}
            icon={Gauge}
            variant="default"
            subtitle="Reported by live sources"
          />
          <StatCard
            title="Citizen Reports"
            value={stats?.citizenReports ?? "—"}
            icon={Users}
            variant="default"
            subtitle="Current database count"
          />
          <StatCard
            title="Model Status"
            value={prediction?.prediction ? "Active" : "—"}
            icon={Brain}
            variant="success"
            subtitle={
              prediction?.prediction ? "XGBoost latest available" : "No live model response"
            }
          />
          <StatCard
            title="Prediction"
            value={
              isPredictionLoading
                ? "—"
                : prediction?.prediction
                  ? `${prediction.prediction.label.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())} (${prediction.prediction.risk_score})`
                  : "N/A"
            }
            icon={Satellite}
            variant="primary"
            subtitle={
              isPredictionLoading
                ? "Loading..."
                : prediction?.prediction
                  ? `Confidence: ${(prediction.prediction.confidence * 100).toFixed(0)}%`
                  : "No data"
            }
          />
          <StatCard
            title="Landslide Risk"
            value={landslideStats.maxRiskLevel === "safe" ? "Low" : landslideStats.maxRiskLevel.charAt(0).toUpperCase() + landslideStats.maxRiskLevel.slice(1)}
            icon={Mountain}
            variant={landslideStats.maxRiskLevel === "evacuate" ? "danger" : "default"}
            subtitle={`${landslideStats.highRiskCount} zones elevated`}
            trend={landslideStats.highRiskCount > 0 ? "up" : "neutral"}
          />
        </motion.div>

        {/* Flood/Glacier Risk History Chart */}
        <motion.div
          variants={itemVariants}
          className="w-full bg-card rounded-xl p-4 border border-border/50 shadow-card mb-4"
        >
          <h3 className="text-base font-semibold mb-2">Flood/Glacier Risk (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={history?.history || []}
              margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value, name) =>
                  name === "risk_score" ? [`${value}`, "Risk Score"] : [value, name]
                }
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="risk_score"
                stroke="#ef4444"
                strokeWidth={2}
                name="Risk Score"
                dot
              />
              <Line
                type="monotone"
                dataKey="confidence"
                stroke="#0ea5e9"
                strokeWidth={2}
                name="Confidence"
                dot
              />
            </LineChart>
          </ResponsiveContainer>
          {isHistoryLoading && (
            <div className="text-xs text-muted-foreground mt-2">Loading history…</div>
          )}
        </motion.div>

        {/* Landslide Risk Overview */}
        <motion.div
          variants={itemVariants}
          className="w-full bg-card rounded-xl p-4 border border-border/50 shadow-card"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold">Landslide Susceptibility (ML Model)</h3>
            <span className={`text-xs px-2 py-0.5 rounded ${landslideApiAvailable ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
              {landslideApiAvailable ? "XGBoost Live" : "Fallback"}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {landslidePredictions.map((pred) => (
              <div key={pred.id} className="p-3 rounded-lg border border-border bg-secondary/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">{pred.name}</span>
                  <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                    pred.riskLevel === "evacuate" ? "bg-red-500/20 text-red-500" :
                    pred.riskLevel === "warning" ? "bg-amber-500/20 text-amber-500" :
                    pred.riskLevel === "watch" ? "bg-emerald-500/20 text-emerald-500" :
                    "bg-blue-400/20 text-blue-400"
                  }`}>
                    {pred.riskLevel}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
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
                <p className="text-[10px] text-muted-foreground mt-1">
                  {(pred.probability * 100).toFixed(0)}% · {pred.primaryDriver}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Main content grid */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <RiverLevelChart />
            <RiskExplanationPanel zones={computedZones} />
            <ZoneRiskTable />
          </div>
          <div className="space-y-6">
            <ModelStatusPanel />
            <AlertFeed
              alerts={alerts.map((a) => ({
                ...a,
                timestamp: a.created_at ?? new Date().toISOString(),
              }))}
            />
            <RainfallChart />
          </div>
        </motion.div>
      </motion.div>
    </AppLayout>
  );
}
