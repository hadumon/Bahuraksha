import { useQuery } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
import RiskLevelBadge from "@/components/dashboard/RiskLevelBadge";
import RiverLevelChart from "@/components/dashboard/RiverLevelChart";
import HecRasModelPanel from "@/components/dashboard/HecRasModelPanel";
import DigitalTwinPanel from "@/components/flood/DigitalTwinPanel";
import { fetchRiverStations } from "@/lib/operationalData";
import { ArrowUp, ArrowDown, Minus, Droplets, Activity, Waves } from "lucide-react";

const trendIcons = { rising: ArrowUp, falling: ArrowDown, stable: Minus };
const trendColors = {
  rising: "text-risk-evacuate",
  falling: "text-risk-safe",
  stable: "text-muted-foreground",
};
const glowDotClass = {
  rising: "glow-dot-danger",
  falling: "glow-dot-safe",
  stable: "",
};

export default function MonitoringPage() {
  const {
    data: riverStations = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["river-stations"],
    queryFn: fetchRiverStations,
  });

  const stationCount = riverStations.length;
  const warningCount = riverStations.filter((s) => s.riskLevel === "warning" || s.riskLevel === "evacuate").length;
  const avgLevel = stationCount > 0 ? (riverStations.reduce((a, s) => a + s.currentLevel, 0) / stationCount).toFixed(2) : "—";

  return (
    <AppLayout>
      <div className="relative">
        {/* Ambient background glow */}
        <div className="pointer-events-none absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute -top-24 right-1/3 h-80 w-80 rounded-full bg-accent/5 blur-3xl" />

        <div className="relative p-4 md:p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="metric-badge">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary glow-dot-primary animate-pulse" />
                  Live
                </span>
                <span className="text-xs text-muted-foreground font-mono">Bagmati Basin</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
                River Monitoring
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Real-time gauge station data with LSTM predictions
              </p>
            </div>

            {/* Quick stats */}
            <div className="flex items-center gap-3">
              <QuickStat icon={Activity} label="Stations" value={stationCount.toString()} />
              <QuickStat icon={Droplets} label="Avg Level" value={`${avgLevel}m`} accent />
              {warningCount > 0 && (
                <QuickStat icon={Waves} label="Alerts" value={warningCount.toString()} danger />
              )}
            </div>
          </div>

          {/* Station cards */}
          <div>
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider section-header mb-4">
              Gauge Stations
            </h2>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="station-card p-4 animate-pulse"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <div className="h-4 w-24 bg-secondary/60 rounded mb-3" />
                    <div className="h-8 w-20 bg-secondary/60 rounded mb-3" />
                    <div className="h-2 bg-secondary/60 rounded mb-2" />
                    <div className="flex gap-2 mt-2">
                      <div className="h-3 w-10 bg-secondary/60 rounded" />
                      <div className="h-3 w-14 bg-secondary/60 rounded" />
                      <div className="h-3 w-14 bg-secondary/60 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="rounded-xl border border-risk-evacuate/30 bg-risk-evacuate/5 p-8 text-center space-y-2">
                <div className="w-12 h-12 mx-auto rounded-full bg-risk-evacuate/10 flex items-center justify-center">
                  <Waves className="w-6 h-6 text-risk-evacuate" />
                </div>
                <p className="text-risk-evacuate font-semibold">Failed to load river stations</p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">The data source may be unavailable. Please try again later.</p>
              </div>
            ) : riverStations.length === 0 ? (
              <div className="rounded-xl border border-border/50 bg-secondary/20 p-8 text-center space-y-2">
                <div className="w-12 h-12 mx-auto rounded-full bg-secondary/40 flex items-center justify-center">
                  <Waves className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-semibold">No river stations found</p>
                <p className="text-sm text-muted-foreground">Station data will appear here once ingested.</p>
              </div>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
              {riverStations.map((station) => {
                const TrendIcon = trendIcons[station.trend];
                const percentage = (station.currentLevel / station.dangerLevel) * 100;
                const isDanger = percentage > 100;
                const isWarning = percentage > 85;

                return (
                  <div key={station.id} className="station-card grain-overlay p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-foreground">{station.name}</h3>
                      <RiskLevelBadge level={station.riskLevel} />
                    </div>

                    <div className="flex items-end gap-2 mb-3">
                      <span className="text-3xl font-bold font-mono text-foreground tracking-tight">
                        {station.currentLevel}
                      </span>
                      <span className="text-sm text-muted-foreground mb-1">m</span>
                      <TrendIcon className={`w-4 h-4 mb-1 ${trendColors[station.trend]}`} />
                    </div>

                    {/* Level bar with glow */}
                    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          isDanger ? "bg-risk-evacuate" : isWarning ? "bg-risk-warning" : "bg-primary"
                        }`}
                        style={{
                          width: `${Math.min(percentage, 100)}%`,
                          boxShadow: isDanger
                            ? "0 0 12px hsl(var(--risk-evacuate) / 0.4)"
                            : isWarning
                              ? "0 0 12px hsl(var(--risk-warning) / 0.3)"
                              : "0 0 12px hsl(var(--primary) / 0.2)",
                        }}
                      />
                    </div>

                    <div className="flex justify-between mt-2 gap-1">
                      <span className="text-[9px] sm:text-[10px] text-muted-foreground shrink-0">0m</span>
                      <span className="text-[9px] sm:text-[10px] text-risk-warning truncate">
                        W:{station.warningLevel}m
                      </span>
                      <span className="text-[9px] sm:text-[10px] text-risk-evacuate truncate">
                        D:{station.dangerLevel}m
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>

          <DigitalTwinPanel stations={riverStations} />
          <RiverLevelChart />
          <HecRasModelPanel />
        </div>
      </div>
    </AppLayout>
  );
}

function QuickStat({
  icon: Icon,
  label,
  value,
  accent = false,
  danger = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: boolean;
  danger?: boolean;
}) {
  const colorClass = danger
    ? "text-risk-evacuate bg-risk-evacuate/10 border-risk-evacuate/20"
    : accent
      ? "text-accent bg-accent/10 border-accent/20"
      : "text-primary bg-primary/10 border-primary/20";

  return (
    <div className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${colorClass}`}>
      <Icon className="h-3.5 w-3.5 opacity-70" />
      <div>
        <div className="text-[10px] uppercase tracking-wider opacity-60">{label}</div>
        <div className="text-sm font-bold font-mono tabular-nums">{value}</div>
      </div>
    </div>
  );
}
