import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { fetchRainfallForecasts } from "@/lib/operationalData";

export default function RainfallChart() {
  const { data = [] } = useQuery({
    queryKey: ["rainfall-forecasts", "Bagmati Basin"],
    queryFn: () => fetchRainfallForecasts("Bagmati Basin"),
  });

  return (
    <div className="gradient-card rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-1">7-Day Rainfall Forecast</h3>
      <p className="text-xs text-muted-foreground mb-4">Bagmati Basin • mm/day</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
          <XAxis dataKey="day" tick={{ fill: 'hsl(215, 12%, 50%)', fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: 'hsl(215, 12%, 50%)', fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ background: 'hsl(220, 18%, 10%)', border: '1px solid hsl(220, 14%, 18%)', borderRadius: 8, fontSize: 12 }}
          />
          <Bar dataKey="rainfall" fill="hsl(199, 89%, 48%)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
