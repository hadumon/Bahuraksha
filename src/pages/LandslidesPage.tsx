import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Clock, MapPin, Mountain, RadioTower, Wind } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { motion } from "framer-motion";
import AppLayout from "@/components/layout/AppLayout";
import type { RiskLevel } from "@/lib/operationalData";
import {
  fetchLatestLandslidePredictions,
  fetchLandslidePredictionHistory,
  type LandslidePredictionRecord,
} from "@/lib/landslidePersistence";

function getRiskColor(risk: RiskLevel): string {
  switch (risk) {
    case "evacuate": return "text-red-500";
    case "warning": return "text-amber-500";
    case "watch": return "text-emerald-500";
    default: return "text-blue-400";
  }
}

function getRiskBgColor(risk: RiskLevel): string {
  switch (risk) {
    case "evacuate": return "bg-red-500/20";
    case "warning": return "bg-amber-500/20";
    case "watch": return "bg-emerald-500/20";
    default: return "bg-blue-400/20";
  }
}

function getRiskBarColor(risk: RiskLevel): string {
  switch (risk) {
    case "evacuate": return "bg-red-500";
    case "warning": return "bg-amber-500";
    case "watch": return "bg-emerald-500";
    default: return "bg-blue-400";
  }
}

export default function LandslidesPage() {
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);

  const { data: predictions = [], isLoading } = useQuery({
    queryKey: ["landslide-predictions", "page", "supabase", "ml-api"],
    queryFn: async () => {
      const rows = await fetchLatestLandslidePredictions();
      return rows.filter((row) => row.model_source === "ml-api");
    },
    staleTime: 1000 * 60 * 10,
  });

  const sortedPredictions = useMemo(
    () => [...predictions].sort((a, b) => b.probability - a.probability),
    [predictions],
  );

  const activeZone = useMemo(() => {
    if (!sortedPredictions.length) return null;
    return sortedPredictions.find((prediction) => prediction.zone_id === activeZoneId)
      ?? sortedPredictions[0];
  }, [activeZoneId, sortedPredictions]);

  const { data: history = [] } = useQuery({
    queryKey: ["landslide-prediction-history", activeZone?.zone_id],
    queryFn: () => activeZone
      ? fetchLandslidePredictionHistory(activeZone.zone_id, 14)
      : Promise.resolve([] as LandslidePredictionRecord[]),
    enabled: Boolean(activeZone),
    staleTime: 1000 * 60 * 10,
  });

  const predictionData = useMemo(() => {
    return [...history]
      .reverse()
      .filter((row) => row.model_source === "ml-api")
      .map((row) => ({
        date: row.created_at
          ? new Date(row.created_at).toLocaleDateString([], { month: "short", day: "2-digit" })
          : row.zone_name,
        probability: Math.round(row.probability * 100),
        confidence: Math.round(row.confidence * 100),
      }));
  }, [history]);

  const maxSusceptibility = useMemo(
    () => sortedPredictions.length
      ? Math.max(...sortedPredictions.map((prediction) => prediction.susceptibility_score))
      : 0,
    [sortedPredictions],
  );

  const maxSusceptibilityZone = useMemo(
    () => sortedPredictions.find(
      (prediction) => prediction.susceptibility_score === maxSusceptibility,
    )?.zone_name ?? "N/A",
    [maxSusceptibility, sortedPredictions],
  );

  const avgConfidence = useMemo(
    () => sortedPredictions.length
      ? Math.round((sortedPredictions.reduce((sum, prediction) => sum + prediction.confidence, 0) / sortedPredictions.length) * 100)
      : 0,
    [sortedPredictions],
  );

  const overallRisk = useMemo(() => {
    if (!sortedPredictions.length) return { level: "Unavailable", color: "text-muted-foreground" };
    const maxProb = Math.max(...sortedPredictions.map((prediction) => prediction.probability));
    if (maxProb >= 0.78) return { level: "Critical", color: "text-red-500" };
    if (maxProb >= 0.58) return { level: "Elevated", color: "text-amber-500" };
    if (maxProb >= 0.32) return { level: "Moderate", color: "text-emerald-500" };
    return { level: "Low", color: "text-blue-400" };
  }, [sortedPredictions]);

  const highRiskCount = useMemo(
    () => sortedPredictions.filter(
      (prediction) => prediction.risk_level === "evacuate" || prediction.risk_level === "warning",
    ).length,
    [sortedPredictions],
  );

  const latestTimestamp = sortedPredictions[0]?.created_at
    ? new Date(sortedPredictions[0].created_at).toLocaleString()
    : "No ML API records";

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <Mountain className="h-8 w-8 animate-pulse text-ocean-400" />
            <p className="text-sm text-muted-foreground">Loading persisted ML predictions...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
              <Mountain className="w-8 h-8 text-amber-500" />
              Landslide Prediction
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Persisted Supabase records from the landslide ML API. Missing data is shown as unavailable.
            </p>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 border rounded-lg ${overallRisk.color.replace("text-", "bg-").replace("500", "500/10").replace("400", "400/10")} ${overallRisk.color} border-current/20`}>
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">{overallRisk.level} Risk</span>
          </div>
        </div>

        {!sortedPredictions.length && (
          <div className="gradient-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground">No live landslide predictions</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Run the landslide ML service and persist real `ml-api` predictions to Supabase before this page shows operational risk.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="gradient-card border border-border p-5 rounded-xl">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Overall Risk Level</p>
              <Activity className={`w-4 h-4 ${overallRisk.color}`} />
            </div>
            <p className={`text-3xl font-bold mt-2 ${overallRisk.color}`}>{overallRisk.level}</p>
            <p className="text-xs text-red-400 mt-1">
              {highRiskCount} zones require attention
            </p>
          </div>
          <div className="gradient-card border border-border p-5 rounded-xl">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">ML Records</p>
              <RadioTower className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-3xl font-bold text-foreground mt-2">{sortedPredictions.length}</p>
            <p className="text-xs text-blue-400 mt-1">Supabase `ml-api` rows</p>
          </div>
          <div className="gradient-card border border-border p-5 rounded-xl">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Max Susceptibility</p>
              <Mountain className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-3xl font-bold text-foreground mt-2">{Math.round(maxSusceptibility * 100)}%</p>
            <p className="text-xs text-amber-400 mt-1">{maxSusceptibilityZone}</p>
          </div>
          <div className="gradient-card border border-border p-5 rounded-xl">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Model Confidence</p>
              <Wind className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-3xl font-bold text-foreground mt-2">{avgConfidence}%</p>
            <p className="text-xs text-emerald-400 mt-1">Average ML confidence</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 gradient-card border border-border rounded-xl p-5 shadow-xl relative overflow-hidden">
            <h3 className="text-lg font-bold text-foreground mb-1">Prediction History</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {activeZone ? `${activeZone.zone_name} - ${latestTimestamp}` : "No selected prediction"}
            </p>

            <div className="h-50 sm:h-62.5 md:h-75 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={predictionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="landslideProbability" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="landslideConfidence" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="date" stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", borderRadius: "8px" }}
                    itemStyle={{ color: "#f8fafc" }}
                  />
                  <Area type="monotone" dataKey="probability" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#landslideProbability)" name="Risk Probability (%)" />
                  <Area type="monotone" dataKey="confidence" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#landslideConfidence)" name="Confidence (%)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="gradient-card border border-border rounded-xl p-5 shadow-xl flex flex-col">
            <h3 className="text-lg font-bold text-foreground mb-4">Susceptible Zones</h3>
            <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-2">
              {sortedPredictions.map((prediction) => (
                <motion.div
                  key={prediction.id ?? prediction.zone_id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveZoneId(prediction.zone_id)}
                  className={`p-4 rounded-lg cursor-pointer border transition-colors ${
                    activeZone?.zone_id === prediction.zone_id
                      ? "bg-secondary/50 border-primary/50"
                      : "bg-background border-border hover:border-primary/30"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="font-semibold">{prediction.zone_name}</span>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded ${getRiskBgColor(prediction.risk_level)} ${getRiskColor(prediction.risk_level)}`}>
                      {prediction.risk_level}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Failure Probability</span>
                    <span className="text-xs font-mono font-bold">{Math.round(prediction.probability * 100)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full ${getRiskBarColor(prediction.risk_level)}`}
                      style={{ width: `${prediction.probability * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    Primary: {prediction.primary_driver}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {activeZone && (
          <div className="gradient-card border border-border rounded-xl p-5 shadow-xl">
            <h3 className="text-lg font-bold text-foreground mb-4">Model Record & Drivers</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Zone</span>
                  <span className="font-mono">{activeZone.zone_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">District</span>
                  <span className="font-mono">{activeZone.district}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Source</span>
                  <span className="font-mono">{activeZone.model_source}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-mono">{latestTimestamp}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Primary Driver</p>
                  <p className="font-semibold">{activeZone.primary_driver}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Secondary Drivers</p>
                  <div className="flex flex-wrap gap-2">
                    {activeZone.secondary_drivers.map((driver) => (
                      <span key={driver} className="px-2 py-1 bg-muted/50 rounded text-xs">
                        {driver}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Time Horizon</p>
                  <p className="font-semibold">{activeZone.time_horizon_hours} hours</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
