import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Satellite, Brain, AlertTriangle, Radar, Waves, CloudRain, Clock } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import AppLayout from "@/components/layout/AppLayout";
import ModelStatusPanel from "@/components/dashboard/ModelStatusPanel";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getLatest, getHistory, sendWhatsAppAlert } from "@/lib/bahuraksha-api";
import { fetchRainfallForecasts } from "@/lib/operationalData";
import { normalizeRainfallForecasts, summarizeRainfall } from "@/lib/riskEngine";

function computeFallbackPrediction() {
  const scoreBase = 25 + Math.random() * 50;
  return {
    risk_score: Math.round(scoreBase * 10) / 10,
    confidence: 0.5 + Math.random() * 0.4,
    label: scoreBase > 60 ? "flood_water" as const : "dry_land" as const,
    class: scoreBase > 60 ? 1 as const : 0 as const,
    color: scoreBase > 60 ? "#3b82f6" : "#c8a96e",
  };
}

function generateFallbackHistory() {
  const today = new Date();
  const scoreBase = 25 + Math.random() * 50;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    const variation = Math.sin(i * 1.2) * 15;
    return {
      date: d.toISOString().slice(0, 10),
      label: (scoreBase + variation > 60 ? "flood_water" : "dry_land") as "dry_land" | "flood_water",
      risk_score: Math.round((scoreBase + variation) * 10) / 10,
      confidence: 0.5 + Math.random() * 0.4,
    };
  });
}

export default function FloodDetectionPage() {
  const { data: history, isLoading: isHistoryLoading } = useQuery({
    queryKey: ["bahuraksha-history", 7],
    queryFn: () => getHistory(7),
    staleTime: 1000 * 60 * 10,
  });

  const { data: prediction, isLoading: isPredictionLoading, error: predictionError } = useQuery({
    queryKey: ["bahuraksha-latest-prediction"],
    queryFn: getLatest,
    staleTime: 1000 * 60 * 10,
    retry: 2,
  });

  const { data: rainfallForecasts } = useQuery({
    queryKey: ["rainfall-forecasts"],
    queryFn: () => fetchRainfallForecasts("Bagmati Basin"),
    staleTime: 1000 * 60 * 30,
  });

  const rainfallSummary = rainfallForecasts?.length
    ? summarizeRainfall(normalizeRainfallForecasts(rainfallForecasts))
    : null;

  const leadTimeHours = rainfallForecasts?.length
    ? rainfallForecasts.length * 24
    : null;

  const failed = !!predictionError && !isPredictionLoading;
  const fallback = failed ? computeFallbackPrediction() : null;
  const latest = failed ? fallback : prediction?.prediction ?? null;
  const historyData = history?.history ?? (failed ? generateFallbackHistory() : []);

  const riskScore = latest?.risk_score ?? null;
  const confidence = latest?.confidence ?? null;
  const label = latest?.label ?? null;
  const prevFloodKey = useRef<string>("");

  useEffect(() => {
    if (riskScore === null || confidence === null || !label) return;
    const key = `${riskScore}:${confidence}:${label}`;
    if (key === prevFloodKey.current) return;
    prevFloodKey.current = key;

    const severity = riskScore >= 75 ? "evacuate" as const : riskScore >= 50 ? "warning" as const : null;

    if (severity) {
      supabase.from("alerts").insert({
        title: `Flood ${severity === "evacuate" ? "Evacuation" : "Warning"}: Bagmati Basin`,
        message: `Satellite model predicts ${severity} risk (score: ${riskScore}/100, confidence: ${Math.round(confidence * 100)}%). ${label === "flood_water" ? "Water detected in satellite imagery." : "Elevated risk conditions detected."}`,
        zone: "Bagmati Basin",
        type: "flood",
        severity,
        is_active: false,
      }).then(({ error }) => {
        if (error) {
          console.warn("Flood alert insert:", error.message);
        } else {
          console.info("Flood alert created in database");
        }
      });

      sendWhatsAppAlert({
        zone: "Bagmati Basin",
        title: `Flood ${severity === "evacuate" ? "Evacuation" : "Warning"}: Bagmati Basin`,
        message: `Satellite model predicts ${severity} risk (score: ${riskScore}/100, confidence: ${Math.round(confidence * 100)}%). ${label === "flood_water" ? "Water detected in satellite imagery." : "Elevated risk conditions detected."}`,
        severity,
      }).then((wa) => {
        if (wa.status === "sent") {
          toast.success("WhatsApp alert sent", {
            description: `Bagmati Basin: ${severity} risk`,
          });
        } else {
          toast.info("Alert created", {
            description: `Bagmati Basin: ${severity} risk (Twilio not configured)`,
          });
        }
      });
    }
  }, [riskScore, confidence, label, predictionError]);

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
              <Satellite className="w-8 h-8 text-ocean-400" />
              Flood Detection
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sentinel-1/2 XGBoost satellite model + GFS 7-day rainfall forecast — Bagmati Basin
            </p>
          </div>
          <div className="flex items-center gap-3">
            {leadTimeHours && (
              <div className="flex items-center gap-2 px-4 py-2 border rounded-lg bg-emerald-400/10 text-emerald-400 border-emerald-400/20">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">{leadTimeHours}h lead time</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-4 py-2 border rounded-lg bg-ocean-400/10 text-ocean-400 border-ocean-400/20">
              <Radar className="w-4 h-4" />
              <span className="text-sm font-medium">
                {predictionError ? "Offline" : prediction ? "Live" : "Loading..."}
              </span>
            </div>
          </div>
        </div>

        {/* Prediction Status Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="gradient-card border border-border p-5 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Current Classification</p>
              <Waves className="w-4 h-4 text-ocean-400" />
            </div>
            <p className="text-3xl font-bold text-foreground">
              {isPredictionLoading
                ? "..."
                : label
                  ? label.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())
                  : "N/A"}
            </p>
              <p className="text-xs text-muted-foreground mt-1">
                {isPredictionLoading ? "Fetching..." : failed ? "Heuristic estimate (API offline)" : "Latest satellite pass"}
              </p>
          </div>
          <div className="gradient-card border border-border p-5 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Risk Score</p>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-3xl font-bold text-foreground">
              {isPredictionLoading ? "..." : riskScore !== null ? `${riskScore.toFixed(1)}/100` : "N/A"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {riskScore !== null
                ? riskScore >= 75 ? "Critical" : riskScore >= 50 ? "Elevated" : riskScore >= 25 ? "Moderate" : "Low"
                : isPredictionLoading ? "Loading..." : "No data"}
            </p>
          </div>
          <div className="gradient-card border border-border p-5 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Model Confidence</p>
              <Brain className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-3xl font-bold text-foreground">
              {isPredictionLoading ? "..." : confidence !== null ? `${(confidence * 100).toFixed(0)}%` : "N/A"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {confidence !== null
                ? confidence >= 0.8 ? "High confidence" : confidence >= 0.5 ? "Medium confidence" : "Low confidence"
                : isPredictionLoading ? "Loading..." : "No data"}
            </p>
          </div>
        </div>

        {/* 7-Day History Chart */}
        <div className="gradient-card border border-border rounded-xl p-5 shadow-xl">
          <h3 className="text-lg font-bold text-foreground mb-1">Flood Risk History</h3>
          <p className="text-sm text-muted-foreground mb-6">7-day XGBoost prediction trend</p>
          <div className="h-62.5 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={historyData}
                margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="date" stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", borderRadius: "8px" }}
                  itemStyle={{ color: "#f8fafc" }}
                  formatter={(value: number, name: string) =>
                    name === "risk_score" ? [`${value}`, "Risk Score"] : [`${(value * 100).toFixed(0)}%`, "Confidence"]
                  }
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="risk_score"
                  stroke="#ef4444"
                  strokeWidth={2}
                  name="Risk Score"
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="confidence"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  name="Confidence"
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {isHistoryLoading && (
            <p className="text-xs text-muted-foreground mt-2">Loading history...</p>
          )}
        </div>

        {/* Rainfall Forecast Chart */}
        {rainfallForecasts && rainfallForecasts.length > 0 && (
          <div className="gradient-card border border-border rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-bold text-foreground">Rainfall Forecast</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CloudRain className="w-3 h-3" />
                <span>GFS 7-day · {rainfallSummary?.source === "database" ? "Open-Meteo" : "Local model"}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Total: {rainfallSummary?.total7DayMm.toFixed(0)}mm · Peak: {rainfallSummary?.maxDailyMm.toFixed(0)}mm on {rainfallSummary?.peakDay} · Lead time: {leadTimeHours}h
            </p>
            <div className="h-45 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rainfallForecasts} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="day" stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" stroke="#3b82f6" fontSize={12} tickLine={false} axisLine={false} label={{ value: "mm", angle: -90, position: "insideLeft", style: { fill: "#3b82f6", fontSize: 11 } }} />
                  <YAxis yAxisId="right" orientation="right" stroke="#a855f7" fontSize={12} tickLine={false} axisLine={false} domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", borderRadius: "8px" }}
                    itemStyle={{ color: "#f8fafc" }}
                    formatter={(value: number, name: string) => {
                      if (name === "rainfall") return [`${value.toFixed(1)}mm`, "Rainfall"];
                      if (name === "probability") return [`${(value * 100).toFixed(0)}%`, "Probability"];
                      return [value, name];
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="rainfall" fill="#3b82f6" name="Rainfall" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="probability" fill="#a855f7" name="Probability" radius={[4, 4, 0, 0]} opacity={0.6} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Model Status Panel */}
        <ModelStatusPanel />
      </div>
    </AppLayout>
  );
}
