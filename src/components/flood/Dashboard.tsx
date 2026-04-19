import { Activity, Droplets, Gauge, Waves, Wind, Thermometer } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface DashboardProps {
  waterLevel: number;
  flowSpeed: number;
  setWaterLevel: (v: number) => void;
  setFlowSpeed: (v: number) => void;
}

function getRisk(level: number) {
  if (level < 0.35)
    return { label: "LOW", bg: "bg-flood-safe", text: "text-flood-safe", varName: "--flood-safe", pct: level * 100 };
  if (level < 0.7)
    return { label: "ELEVATED", bg: "bg-flood-warn", text: "text-flood-warn", varName: "--flood-warn", pct: level * 100 };
  return { label: "CRITICAL", bg: "bg-flood-danger", text: "text-flood-danger", varName: "--flood-danger", pct: level * 100 };
}

export function Dashboard({ waterLevel, flowSpeed, setWaterLevel, setFlowSpeed }: DashboardProps) {
  const risk = getRisk(waterLevel);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col p-4 md:p-6">
      {/* Top bar */}
      <header className="pointer-events-auto flex items-center justify-between">
        <div className="glass rounded-2xl px-4 py-2.5 flex items-center gap-3">
          <div className="relative">
            <div className={`h-2.5 w-2.5 rounded-full ${risk.bg}`} />
            <div className={`absolute inset-0 h-2.5 w-2.5 rounded-full ${risk.bg} pulse-dot`} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-foreground/60">Live Status</div>
            <div className="text-sm font-semibold tracking-tight">Sensor Network · Online</div>
          </div>
        </div>
        <div className="glass rounded-2xl px-4 py-2.5 hidden md:block">
          <div className="text-[10px] uppercase tracking-[0.18em] text-foreground/60">Station</div>
          <div className="text-sm font-semibold tracking-tight">Riverside Gauge #07-A</div>
        </div>
      </header>

      <div className="flex-1" />

      {/* Bottom panels */}
      <div className="pointer-events-auto grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Flood risk meter */}
        <div className="glass-strong rounded-3xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-foreground/70" />
              <h3 className="text-sm font-semibold tracking-tight">Flood Risk</h3>
            </div>
            <span className={`text-xs font-bold tracking-wider ${risk.text}`}>{risk.label}</span>
          </div>
          <div className="relative h-3 rounded-full bg-foreground/10 overflow-hidden">
            <div
              className={`h-full ${risk.bg} transition-all duration-500 ease-out`}
              style={{ width: `${risk.pct}%`, boxShadow: `0 0 20px var(${risk.varName})` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-foreground/50 font-mono">
            <span>0.0m</span>
            <span>SAFE</span>
            <span>WARN</span>
            <span>4.5m</span>
          </div>
          <div className="mt-4 text-3xl font-bold tabular-nums tracking-tight">
            {(waterLevel * 4.5).toFixed(2)}<span className="text-base text-foreground/50 ml-1">m</span>
          </div>
        </div>

        {/* Real-time Metrics */}
        <div className="glass-strong rounded-3xl p-5 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-foreground/70" />
              <h3 className="text-sm font-semibold tracking-tight">Real-time Metrics</h3>
            </div>
            <span className="text-[10px] font-mono text-foreground/50">UPDATED · 2s ago</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric icon={Droplets} label="Discharge" value={`${(flowSpeed * 480).toFixed(0)}`} unit="m³/s" />
            <Metric icon={Waves} label="Velocity" value={`${(flowSpeed * 3.2).toFixed(2)}`} unit="m/s" />
            <Metric icon={Wind} label="Turbidity" value={`${(waterLevel * 850).toFixed(0)}`} unit="NTU" />
            <Metric icon={Thermometer} label="Temp" value="14.6" unit="°C" />
          </div>

          {/* Controls */}
          <div className="mt-5 pt-4 border-t border-foreground/10 grid grid-cols-2 gap-5">
            <div>
              <div className="flex justify-between text-[10px] uppercase tracking-wider text-foreground/60 mb-2">
                <span>Water Level</span>
                <span className="font-mono">{(waterLevel * 100).toFixed(0)}%</span>
              </div>
              <Slider value={[waterLevel * 100]} onValueChange={(v) => setWaterLevel(v[0] / 100)} max={100} step={1} />
            </div>
            <div>
              <div className="flex justify-between text-[10px] uppercase tracking-wider text-foreground/60 mb-2">
                <span>Flow Speed</span>
                <span className="font-mono">{flowSpeed.toFixed(2)}×</span>
              </div>
              <Slider value={[flowSpeed * 50]} onValueChange={(v) => setFlowSpeed(v[0] / 50)} max={150} step={1} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  unit,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="rounded-2xl bg-foreground/5 border border-foreground/10 p-3">
      <div className="flex items-center gap-1.5 text-foreground/60 mb-1.5">
        <Icon className="h-3 w-3" />
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-xl font-bold tabular-nums tracking-tight">
        {value}
        <span className="text-xs font-normal text-foreground/50 ml-1">{unit}</span>
      </div>
    </div>
  );
}
