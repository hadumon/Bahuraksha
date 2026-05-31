import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
import { Mountain, AlertTriangle, CloudRain, Activity, MapPin, ChevronRight, Wind, Loader2 } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { motion } from "framer-motion";
import { predictBatchLandslideRisk, checkApiHealth, computeBatchHeuristic, type LandslideZoneInput, type LandslidePrediction } from "@/lib/landslideModel";
import { fetchRainfallForecasts, type RiskLevel } from "@/lib/operationalData";

const sampleZones: LandslideZoneInput[] = [
  {
    id: "1",
    name: "Sindhupalchok",
    district: "Sindhupalchok",
    coordinates: [27.78, 85.85],
    slopeAngleDeg: 42,
    soilMoisturePct: 88,
    rainfall7DayMm: 320,
    rainfallTodayMm: 65,
    seismicActivityMg: 0.015,
    vegetationCoverPct: 25,
    elevationM: 1800,
    distanceToRoadKm: 0.3,
  },
  {
    id: "2",
    name: "Rasuwa",
    district: "Rasuwa",
    coordinates: [28.15, 85.35],
    slopeAngleDeg: 38,
    soilMoisturePct: 75,
    rainfall7DayMm: 210,
    rainfallTodayMm: 35,
    seismicActivityMg: 0.008,
    vegetationCoverPct: 45,
    elevationM: 2200,
    distanceToRoadKm: 0.8,
  },
  {
    id: "3",
    name: "Dolakha",
    district: "Dolakha",
    coordinates: [27.67, 86.18],
    slopeAngleDeg: 28,
    soilMoisturePct: 55,
    rainfall7DayMm: 120,
    rainfallTodayMm: 15,
    seismicActivityMg: 0.003,
    vegetationCoverPct: 65,
    elevationM: 1400,
    distanceToRoadKm: 2.5,
  },
];

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
  const [predictions, setPredictions] = useState<(LandslidePrediction & { id: string; name: string; district: string; coordinates: [number, number] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiAvailable, setApiAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: rainfallData } = useQuery({
    queryKey: ["rainfall-forecasts"],
    queryFn: () => fetchRainfallForecasts("Bagmati Basin"),
    staleTime: 1000 * 60 * 30,
  });

  const zonesWithForecast = useMemo(() => {
    if (!rainfallData?.length) return sampleZones;
    const totalForecastMm = rainfallData.reduce((s, f) => s + f.rainfall, 0);
    const todayMm = rainfallData[0]?.rainfall ?? 0;
    const origTotal = sampleZones.reduce((s, z) => s + z.rainfall7DayMm, 0);
    const scale = origTotal > 0 ? totalForecastMm / origTotal : 1;
    return sampleZones.map((z) => ({
      ...z,
      rainfall7DayMm: Math.round(z.rainfall7DayMm * scale),
      rainfallTodayMm: Math.round(z.rainfallTodayMm * (todayMm / (sampleZones.reduce((s, z) => s + z.rainfallTodayMm, 0) / 3))),
    }));
  }, [rainfallData]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const healthy = await checkApiHealth();
      if (!cancelled) setApiAvailable(healthy);

      try {
        const results = await predictBatchLandslideRisk(zonesWithForecast);
        if (!cancelled) {
          setPredictions(results.map((r, i) => ({
            ...r,
            coordinates: zonesWithForecast[i].coordinates,
          })));
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setApiAvailable(false);
          const fallback = computeBatchHeuristic(zonesWithForecast);
          setPredictions(fallback.map((r, i) => ({
            ...r,
            coordinates: zonesWithForecast[i].coordinates,
          })));
          setError("ML API unreachable — showing heuristic estimates");
        }
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [zonesWithForecast]);

  const [activeZone, setActiveZone] = useState<(LandslidePrediction & { id: string; name: string; district: string; coordinates: [number, number]; slopeAngleDeg: number; soilMoisturePct: number; rainfall7DayMm: number; rainfallTodayMm: number; seismicActivityMg: number; vegetationCoverPct: number; elevationM: number; distanceToRoadKm: number }) | null>(null);

  useEffect(() => {
    if (predictions.length > 0 && !activeZone) {
      const first = predictions[0];
      const zone = zonesWithForecast.find((z) => z.id === first.id);
      if (zone) {
        setActiveZone({
          ...first,
          coordinates: zone.coordinates,
          slopeAngleDeg: zone.slopeAngleDeg,
          soilMoisturePct: zone.soilMoisturePct,
          rainfall7DayMm: zone.rainfall7DayMm,
          rainfallTodayMm: zone.rainfallTodayMm,
          seismicActivityMg: zone.seismicActivityMg,
          vegetationCoverPct: zone.vegetationCoverPct,
          elevationM: zone.elevationM,
          distanceToRoadKm: zone.distanceToRoadKm,
        });
      }
    }
  }, [predictions, activeZone, zonesWithForecast]);

  const predictionData = useMemo(() => {
    if (!activeZone) return [];
    const now = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now);
      date.setDate(now.getDate() + i);
      const baseMoisture = activeZone.soilMoisturePct;
      const moistureVariation = Math.sin(i * 0.8) * 15;
      const soilMoisture = Math.max(0, Math.min(100, baseMoisture + moistureVariation));
      const riskFactor = (soilMoisture / 100) * 0.6 + (activeZone.rainfall7DayMm / 400) * 0.4;
      const risk = Math.max(0, Math.min(100, riskFactor * 100));
      return {
        date: date.toLocaleDateString([], { month: "short", day: "2-digit" }),
        soilMoisture: Math.round(soilMoisture),
        risk: Math.round(risk),
      };
    });
  }, [activeZone]);

  const maxSusceptibility = useMemo(
    () => predictions.length ? Math.max(...predictions.map((p) => p.susceptibilityScore)) : 0,
    [predictions],
  );

  const maxSusceptibilityZone = useMemo(
    () => predictions.find((p) => p.susceptibilityScore === maxSusceptibility)?.name ?? "N/A",
    [predictions, maxSusceptibility],
  );

  const avgConfidence = useMemo(
    () => predictions.length ? Math.round((predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length) * 100) : 0,
    [predictions],
  );

  const overallRisk = useMemo(() => {
    if (!predictions.length) return { level: "Loading...", color: "text-muted-foreground" };
    const maxProb = Math.max(...predictions.map((p) => p.probability));
    if (maxProb >= 0.78) return { level: "Critical", color: "text-red-500" };
    if (maxProb >= 0.58) return { level: "Elevated", color: "text-amber-500" };
    if (maxProb >= 0.32) return { level: "Moderate", color: "text-emerald-500" };
    return { level: "Low", color: "text-blue-400" };
  }, [predictions]);

  const avgSoilMoisture = useMemo(
    () => predictions.length
      ? Math.round(predictions.reduce((sum, p) => sum + (zonesWithForecast.find((z) => z.id === p.id)?.soilMoisturePct ?? 0), 0) / predictions.length)
      : 0,
    [predictions, zonesWithForecast],
  );

  const highRiskCount = useMemo(
    () => predictions.filter((p) => p.riskLevel === "evacuate" || p.riskLevel === "warning").length,
    [predictions],
  );

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-ocean-400" />
            <p className="text-sm text-muted-foreground">Loading ML predictions...</p>
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
              {error || `XGBoost ML susceptibility ${apiAvailable ? "(live model)" : "(heuristic fallback)"} · ${rainfallData?.length ? "GFS 7-day rainfall forecast" : "local rainfall estimates"}`}
            </p>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 border rounded-lg ${overallRisk.color.replace("text-", "bg-").replace("500", "500/10").replace("400", "400/10")} ${overallRisk.color} border-current/20`}>
            <AlertTriangle className="w-4 h-4 animate-pulse" />
            <span className="text-sm font-medium">{overallRisk.level} Risk Active</span>
          </div>
        </div>

        {/* Top Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="gradient-card border border-border p-5 rounded-xl">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Overall Risk Level</p>
              <Activity className={`w-4 h-4 ${overallRisk.color}`} />
            </div>
            <p className={`text-3xl font-bold mt-2 ${overallRisk.color}`}>{overallRisk.level}</p>
            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
              <ChevronRight className="w-3 h-3" /> {highRiskCount} zones require attention
            </p>
          </div>
          <div className="gradient-card border border-border p-5 rounded-xl">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Avg Soil Moisture</p>
              <CloudRain className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-3xl font-bold text-foreground mt-2">{avgSoilMoisture}%</p>
            <p className="text-xs text-blue-400 mt-1">
              Across monitored zones
            </p>
          </div>
          <div className="gradient-card border border-border p-5 rounded-xl">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Max Susceptibility</p>
              <Mountain className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-3xl font-bold text-foreground mt-2">{Math.round(maxSusceptibility * 100)}%</p>
            <p className="text-xs text-amber-400 mt-1">
              {maxSusceptibilityZone}
            </p>
          </div>
          <div className="gradient-card border border-border p-5 rounded-xl">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Model Confidence</p>
              <Wind className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-3xl font-bold text-foreground mt-2">{avgConfidence}%</p>
            <p className="text-xs text-emerald-400 mt-1">
              Weighted average
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chart Area */}
          <div className="lg:col-span-2 gradient-card border border-border rounded-xl p-5 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 blur-3xl rounded-full" />
            <h3 className="text-lg font-bold text-foreground mb-1">Risk vs Soil Saturation</h3>
            <p className="text-sm text-muted-foreground mb-6">7-day forecast for {activeZone?.name ?? "N/A"}</p>
            
            <div className="h-50 sm:h-62.5 md:h-75 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={predictionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorMoisture" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="date" stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                  <Area type="monotone" dataKey="risk" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorRisk)" name="Risk Probability (%)" />
                  <Area type="monotone" dataKey="soilMoisture" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorMoisture)" name="Soil Moisture (%)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Susceptibility Zones List */}
          <div className="gradient-card border border-border rounded-xl p-5 shadow-xl flex flex-col">
            <h3 className="text-lg font-bold text-foreground mb-4">Susceptible Zones</h3>
            <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-2">
              {predictions.map((prediction) => (
                <motion.div 
                  key={prediction.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    const zone = zonesWithForecast.find((z) => z.id === prediction.id);
                    if (zone) {
                      setActiveZone({
                        ...prediction,
                        coordinates: zone.coordinates,
                        slopeAngleDeg: zone.slopeAngleDeg,
                        soilMoisturePct: zone.soilMoisturePct,
                        rainfall7DayMm: zone.rainfall7DayMm,
                        rainfallTodayMm: zone.rainfallTodayMm,
                        seismicActivityMg: zone.seismicActivityMg,
                        vegetationCoverPct: zone.vegetationCoverPct,
                        elevationM: zone.elevationM,
                        distanceToRoadKm: zone.distanceToRoadKm,
                      });
                    }
                  }}
                  className={`p-4 rounded-lg cursor-pointer border transition-colors ${
                    activeZone?.id === prediction.id 
                      ? 'bg-secondary/50 border-primary/50' 
                      : 'bg-background border-border hover:border-primary/30'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="font-semibold">{prediction.name}</span>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded flex items-center gap-1 ${getRiskBgColor(prediction.riskLevel)} ${getRiskColor(prediction.riskLevel)}`}>
                      {prediction.riskLevel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Failure Probability</span>
                    <span className="text-xs font-mono font-bold">{Math.round(prediction.probability * 100)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                    <div 
                      className={`h-full ${getRiskBarColor(prediction.riskLevel)}`}
                      style={{ width: `${prediction.probability * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    Primary: {prediction.primaryDriver}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Model Details Section */}
        {activeZone && (
        <div className="gradient-card border border-border rounded-xl p-5 shadow-xl">
          <h3 className="text-lg font-bold text-foreground mb-4">Model Parameters & Drivers</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">Active Zone: {activeZone?.name ?? "N/A"}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Slope Angle</span>
                  <span className="font-mono">{activeZone.slopeAngleDeg}°</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Soil Moisture</span>
                  <span className="font-mono">{activeZone.soilMoisturePct}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">7-Day Rainfall</span>
                  <span className="font-mono">{activeZone.rainfall7DayMm}mm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Today's Rainfall</span>
                  <span className="font-mono">{activeZone.rainfallTodayMm}mm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Seismic Activity</span>
                  <span className="font-mono">{activeZone.seismicActivityMg}g</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vegetation Cover</span>
                  <span className="font-mono">{activeZone.vegetationCoverPct}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Elevation</span>
                  <span className="font-mono">{activeZone.elevationM}m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Distance to Road</span>
                  <span className="font-mono">{activeZone.distanceToRoadKm}km</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">Risk Drivers</h4>
              <div className="space-y-2">
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Primary Driver</p>
                  <p className="font-semibold">{activeZone.primaryDriver}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Secondary Drivers</p>
                  <div className="flex flex-wrap gap-2">
                    {activeZone.secondaryDrivers.map((driver, i) => (
                      <span key={i} className="px-2 py-1 bg-muted/50 rounded text-xs">
                        {driver}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Model Confidence</p>
                  <p className="font-semibold">{Math.round(activeZone.confidence * 100)}%</p>
                </div>
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Time Horizon</p>
                  <p className="font-semibold">{activeZone.timeHorizonHours} hours</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

      </div>
    </AppLayout>
  );
}
