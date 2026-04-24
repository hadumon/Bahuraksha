import { useQuery } from "@tanstack/react-query";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
  Area,
  Line,
} from "recharts";
import { fetchRiverLevelHistory } from "@/lib/operationalData";
import { Activity, TrendingUp } from "lucide-react";

export default function RiverLevelChart() {
  const { data = [] } = useQuery({
    queryKey: ["river-level-history", "Teku Station"],
    queryFn: () => fetchRiverLevelHistory("Teku Station"),
  });
  const hasData = data.length > 0;

  return (
    <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-card to-secondary/20 p-5 shadow-card overflow-hidden">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ocean-400/15">
            <Activity className="h-4 w-4 text-ocean-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              River Level — Teku Station
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              48-hour view • LSTM prediction after 24h mark
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-2">
            <span className="h-2 w-4 rounded-full bg-ocean-400" />
            <span className="text-muted-foreground">Actual</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-4 rounded-full bg-risk-watch" />
            <span className="text-muted-foreground">Predicted</span>
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(187, 85%, 52%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(187, 85%, 52%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="predictedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(45, 100%, 55%)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="hsl(45, 100%, 55%)" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            vertical={false}
          />

          <XAxis
            dataKey="time"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontFamily: 'Fira Code' }}
            tickLine={false}
            axisLine={false}
            interval={6}
          />

          <YAxis
            domain={[2, 7]}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontFamily: 'Fira Code' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}m`}
          />

          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 12,
              fontSize: 12,
              boxShadow: 'var(--shadow-elevated)'
            }}
            labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
            itemStyle={{ fontSize: 11 }}
          />

          <ReferenceLine
            y={5.5}
            stroke="hsl(var(--risk-evacuate))"
            strokeDasharray="5 5"
            strokeWidth={1.5}
            label={{
              value: 'DANGER',
              fill: 'hsl(var(--risk-evacuate))',
              fontSize: 9,
              fontWeight: 600,
              position: 'right'
            }}
          />

          <ReferenceLine
            y={4.8}
            stroke="hsl(var(--risk-warning))"
            strokeDasharray="5 5"
            strokeWidth={1.5}
            label={{
              value: 'WARNING',
              fill: 'hsl(var(--risk-warning))',
              fontSize: 9,
              fontWeight: 600,
              position: 'right'
            }}
          />

          <Area
            type="monotone"
            dataKey="actual"
            stroke="none"
            fill="url(#actualGradient)"
          />

          <Area
            type="monotone"
            dataKey="predicted"
            stroke="none"
            fill="url(#predictedGradient)"
          />

          <Line
            type="monotone"
            dataKey="actual"
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
            dot={false}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <Line
            type="monotone"
            dataKey="predicted"
            stroke="hsl(var(--risk-watch))"
            strokeWidth={2.5}
            strokeDasharray="6 4"
            dot={false}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Status indicator */}
      <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-risk-safe" />
          <span className="text-xs text-muted-foreground">
            {hasData ? "Teku station data loaded" : "Waiting for live station data"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`h-2 w-2 rounded-full ${
              hasData ? "bg-ocean-400 animate-pulse" : "bg-muted-foreground/40"
            }`}
          />
          <span className="text-muted-foreground">{hasData ? "Live data" : "No data"}</span>
        </div>
      </div>
    </div>
  );
}
