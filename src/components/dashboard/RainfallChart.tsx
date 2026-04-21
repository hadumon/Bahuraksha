import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { fetchRainfallForecasts } from "@/lib/operationalData";
import { CloudRain, Droplets } from "lucide-react";

export default function RainfallChart() {
  const { data = [] } = useQuery({
    queryKey: ["rainfall-forecasts", "Bagmati Basin"],
    queryFn: () => fetchRainfallForecasts("Bagmati Basin"),
  });

  const getBarColor = (value: number) => {
    if (value >= 50) return "hsl(var(--risk-evacuate))";
    if (value >= 20) return "hsl(var(--risk-warning))";
    if (value >= 10) return "hsl(var(--risk-watch))";
    return "hsl(var(--primary))";
  };

  return (
    <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-card to-secondary/20 p-5 shadow-card">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ocean-400/15">
            <CloudRain className="h-4 w-4 text-ocean-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              7-Day Rainfall Forecast
            </h3>
            <p className="text-xs text-muted-foreground">Bagmati Basin • mm/day</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-lg bg-secondary/50 px-3 py-1.5">
          <Droplets className="h-3.5 w-3.5 text-ocean-400" />
          <span className="text-xs font-medium text-foreground">
            {data.reduce((acc, d) => acc + (d.rainfall || 0), 0).toFixed(0)}mm
          </span>
          <span className="text-[10px] text-muted-foreground">total</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
          <defs>
            <linearGradient id="rainfallGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(187, 85%, 60%)" />
              <stop offset="100%" stopColor="hsl(187, 85%, 40%)" />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            vertical={false}
          />

          <XAxis
            dataKey="day"
            tick={{
              fill: 'hsl(var(--muted-foreground))',
              fontSize: 10,
              fontFamily: 'Fira Code'
            }}
            tickLine={false}
            axisLine={false}
          />

          <YAxis
            tick={{
              fill: 'hsl(var(--muted-foreground))',
              fontSize: 10,
              fontFamily: 'Fira Code'
            }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}mm`}
          />

          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 12,
              fontSize: 12,
              boxShadow: 'var(--shadow-elevated)'
            }}
            labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
          />

          <Bar
            dataKey="rainfall"
            radius={[6, 6, 0, 0]}
            maxBarSize={40}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getBarColor(entry.rainfall)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-ocean-400" />
            <span className="text-[10px] text-muted-foreground">
              {"Light (<10mm)"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-risk-watch" />
            <span className="text-[10px] text-muted-foreground">Moderate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-risk-warning" />
            <span className="text-[10px] text-muted-foreground">Heavy</span>
          </div>
        </div>

        <span className="text-[10px] text-muted-foreground">NOAA GFS Model</span>
      </div>
    </div>
  );
}
