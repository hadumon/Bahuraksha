import { useRef, useState } from "react";
import { Activity } from "lucide-react";
import type { Telemetry } from "@/hooks/useTelemetry";

function riskTone(level: number) {
  if (level < 0.4) return { label: "NOMINAL", cls: "text-flood-safe", dot: "bg-flood-safe", stroke: "var(--flood-safe)" };
  if (level < 0.7) return { label: "ELEVATED", cls: "text-flood-warn", dot: "bg-flood-warn", stroke: "var(--flood-warn)" };
  return { label: "CRITICAL", cls: "text-flood-danger", dot: "bg-flood-danger", stroke: "var(--flood-danger)" };
}

interface HoverInfo {
  index: number;
  value: number;
  x: number;
  y: number;
}

function Sparkline({
  values,
  stroke,
  intervalSec = 1.5,
  onHover,
}: {
  values: number[];
  stroke: string;
  intervalSec?: number;
  onHover?: (h: HoverInfo | null) => void;
}) {
  const w = 220, h = 36, pad = 2;
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  if (values.length < 2) return <svg width={w} height={h} />;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const step = (w - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = pad + i * step;
    const y = pad + (h - pad * 2) * (1 - (v - min) / range);
    return [x, y] as const;
  });
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${d} L${pts[pts.length - 1][0].toFixed(1)},${h - pad} L${pts[0][0].toFixed(1)},${h - pad} Z`;
  const last = pts[pts.length - 1];

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * w;
    const idx = Math.max(0, Math.min(values.length - 1, Math.round((px - pad) / step)));
    const [x, y] = pts[idx];
    const info = { index: idx, value: values[idx], x, y };
    setHover(info);
    onHover?.(info);
  }
  function handleLeave() {
    setHover(null);
    onHover?.(null);
  }

  const secondsAgo = hover ? (values.length - 1 - hover.index) * intervalSec : 0;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width={w}
        height={h}
        className="block cursor-crosshair"
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
      >
        <defs>
          <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#spark-fill)" />
        <path d={d} fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        {!hover && (
          <>
            <circle cx={last[0]} cy={last[1]} r="2.2" fill={stroke} />
            <circle cx={last[0]} cy={last[1]} r="4.5" fill={stroke} opacity="0.25" />
          </>
        )}
        {hover && (
          <g pointerEvents="none">
            <line x1={hover.x} x2={hover.x} y1={pad} y2={h - pad} stroke={stroke} strokeOpacity="0.4" strokeWidth="1" strokeDasharray="2 2" />
            <circle cx={hover.x} cy={hover.y} r="3" fill={stroke} />
            <circle cx={hover.x} cy={hover.y} r="6" fill={stroke} opacity="0.25" />
          </g>
        )}
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md glass-strong px-2 py-1 text-[10px] whitespace-nowrap"
          style={{
            left: `${(hover.x / w) * 100}%`,
            top: hover.y - 4,
          }}
        >
          <div className="tabular-nums font-semibold text-foreground">
            {hover.value} <span className="text-foreground/50">m³/s</span>
          </div>
          <div className="text-foreground/50 text-[9px]">
            {secondsAgo === 0 ? "now" : `−${secondsAgo.toFixed(1)}s`}
          </div>
        </div>
      )}
    </div>
  );
}

export function TelemetryHUD({ t }: { t: Telemetry }) {
  const r = riskTone(t.level);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const displayedDischarge = hover ? hover.value : t.discharge;
  return (
    <div className="fixed bottom-6 left-6 z-30 hidden md:block">
      <div className="glass-strong rounded-2xl px-4 py-3 font-mono text-[11px] w-[260px]">
        <div className="mb-2 flex items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className={`pulse-dot h-1.5 w-1.5 rounded-full ${r.dot}`} />
            <span className="text-[10px] uppercase tracking-[0.2em] text-foreground/60">Live Telemetry</span>
          </div>
          <span className={`text-[10px] font-bold tracking-wider ${r.cls}`}>{r.label}</span>
        </div>

        {/* Discharge sparkline */}
        <div className="mb-3 rounded-xl bg-foreground/5 border border-foreground/10 p-2">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[9px] uppercase tracking-wider text-foreground/50">
              Discharge · 60s {hover && <span className="text-foreground/40">· hover</span>}
            </span>
            <span className="tabular-nums text-foreground text-[12px] font-semibold">
              {displayedDischarge}<span className="text-foreground/40 ml-0.5 text-[9px]">m³/s</span>
            </span>
          </div>
          <Sparkline values={t.history} stroke={r.stroke} onHover={setHover} />
        </div>

        <div className="grid grid-cols-3 gap-x-4 gap-y-1.5">
          <Row label="VEL" value={t.velocity.toFixed(2)} unit="m/s" />
          <Row label="LEVEL" value={(t.level * 4.5).toFixed(2)} unit="m" />
          <Row label="TURB" value={`${t.turbidity}`} unit="NTU" />
          <Row label="TEMP" value={t.tempC.toFixed(1)} unit="°C" />
          <Row label="RAIN" value={t.rainfall.toFixed(1)} unit="mm/h" />
          <Row label="FLOW" value={(t.flow * 100).toFixed(0)} unit="%" />
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-foreground/10 pt-2 text-[9px] text-foreground/50">
          <span className="flex items-center gap-1.5">
            <Activity className="h-3 w-3" />
            {t.sensorsOnline.toLocaleString()} sensors
          </span>
          <span>tick #{t.tick} · {t.lastUpdateSec}s ago</span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-foreground/45">{label}</span>
      <span className="tabular-nums text-foreground">
        {value}
        <span className="ml-0.5 text-foreground/40">{unit}</span>
      </span>
    </div>
  );
}
