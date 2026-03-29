import { riverLevelHistory } from '@/data/mockData';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart } from 'recharts';

export default function RiverLevelChart() {
  return (
    <div className="gradient-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">River Level — Teku Station</h3>
          <p className="text-xs text-muted-foreground mt-1">48-hour view • LSTM prediction after 24h mark</p>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-primary inline-block" /> Actual</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-risk-watch inline-block" /> Predicted</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart data={riverLevelHistory}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
          <XAxis dataKey="time" tick={{ fill: 'hsl(215, 12%, 50%)', fontSize: 10 }} tickLine={false} axisLine={false} interval={5} />
          <YAxis domain={[2, 7]} tick={{ fill: 'hsl(215, 12%, 50%)', fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ background: 'hsl(220, 18%, 10%)', border: '1px solid hsl(220, 14%, 18%)', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: 'hsl(210, 20%, 92%)' }}
          />
          <ReferenceLine y={5.5} stroke="hsl(0, 72%, 51%)" strokeDasharray="5 5" label={{ value: 'DANGER', fill: 'hsl(0, 72%, 51%)', fontSize: 10 }} />
          <ReferenceLine y={4.8} stroke="hsl(25, 95%, 53%)" strokeDasharray="5 5" label={{ value: 'WARNING', fill: 'hsl(25, 95%, 53%)', fontSize: 10 }} />
          <Line type="monotone" dataKey="actual" stroke="hsl(199, 89%, 48%)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="predicted" stroke="hsl(45, 93%, 47%)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
