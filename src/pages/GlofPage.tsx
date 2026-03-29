import { motion } from 'framer-motion';
import AppLayout from '@/components/layout/AppLayout';
import RiskLevelBadge from '@/components/dashboard/RiskLevelBadge';
import { glacialLakes, glofAlerts } from '@/data/mockData';
import { Snowflake, Thermometer, ArrowUp, ArrowDown, Minus, AlertTriangle, MapPin, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

const trendIcons = { expanding: ArrowUp, stable: Minus, shrinking: ArrowDown };
const trendColors = { expanding: 'text-risk-evacuate', stable: 'text-muted-foreground', shrinking: 'text-risk-safe' };

// Mock temporal data for lake area changes
const lakeAreaHistory = Array.from({ length: 12 }, (_, i) => ({
  month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i],
  imja: 1.28 + i * 0.005 + Math.random() * 0.01,
  tsho: 0.55 + i * 0.002 + Math.random() * 0.005,
  thulagi: 0.90 + i * 0.003 + Math.random() * 0.008,
}));

const temperatureData = Array.from({ length: 12 }, (_, i) => ({
  month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i],
  temp: [-8, -5, -2, 2, 5, 8, 10, 9, 6, 1, -3, -6][i],
  meltRate: [0.1, 0.2, 0.4, 0.8, 1.2, 1.8, 2.2, 2.0, 1.4, 0.6, 0.2, 0.1][i],
}));

export default function GlofPage() {
  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
              <Snowflake className="w-6 h-6 text-primary" />
              GLOF Monitoring
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Glacial Lake Outburst Flood surveillance — Satellite-based area tracking
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="w-4 h-4 text-risk-warning" />
            <span>{glofAlerts.filter(a => a.isActive).length} active GLOF alerts</span>
          </div>
        </div>

        {/* Lake cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {glacialLakes.map(lake => {
            const TrendIcon = trendIcons[lake.trend];
            return (
              <motion.div
                key={lake.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="gradient-card rounded-xl border border-border p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">{lake.name}</h3>
                  <RiskLevelBadge level={lake.riskLevel} />
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Area</p>
                    <p className="text-lg font-bold font-mono text-foreground">{lake.area} <span className="text-xs text-muted-foreground">km²</span></p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Elevation</p>
                    <p className="text-lg font-bold font-mono text-foreground">{lake.elevation} <span className="text-xs text-muted-foreground">m</span></p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Dam Type</p>
                    <p className="text-sm text-foreground">{lake.damType}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Trend</p>
                    <div className="flex items-center gap-1">
                      <TrendIcon className={`w-4 h-4 ${trendColors[lake.trend]}`} />
                      <span className={`text-sm capitalize ${trendColors[lake.trend]}`}>{lake.trend}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  <span>{lake.district}, {lake.region}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <Thermometer className="w-3 h-3" />
                  <span>Downstream pop: {lake.downstreamPopulation.toLocaleString()}</span>
                </div>
                {/* Volume bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Volume</span>
                    <span>{lake.volume} million m³</span>
                  </div>
                  <div className="w-full h-2 bg-secondary rounded-full">
                    <div
                      className={`h-full rounded-full ${
                        lake.riskLevel === 'evacuate' ? 'bg-risk-evacuate' :
                        lake.riskLevel === 'warning' ? 'bg-risk-warning' :
                        lake.riskLevel === 'watch' ? 'bg-risk-watch' : 'bg-risk-safe'
                      }`}
                      style={{ width: `${Math.min((lake.volume / 40) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Lake area trend */}
          <div className="gradient-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Lake Area Trend (2026)</h3>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={lakeAreaHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
                <XAxis dataKey="month" tick={{ fill: 'hsl(215 12% 50%)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'hsl(215 12% 50%)', fontSize: 11 }} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ background: 'hsl(220 18% 10%)', border: '1px solid hsl(220 14% 18%)', borderRadius: 8, color: 'hsl(210 20% 92%)' }}
                />
                <Area type="monotone" dataKey="imja" name="Imja Tsho" stroke="hsl(199 89% 48%)" fill="hsl(199 89% 48% / 0.1)" strokeWidth={2} />
                <Area type="monotone" dataKey="tsho" name="Tsho Rolpa" stroke="hsl(25 95% 53%)" fill="hsl(25 95% 53% / 0.1)" strokeWidth={2} />
                <Area type="monotone" dataKey="thulagi" name="Thulagi" stroke="hsl(142 71% 45%)" fill="hsl(142 71% 45% / 0.1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Temperature & melt rate */}
          <div className="gradient-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <Thermometer className="w-4 h-4 text-risk-warning" />
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Temperature & Glacial Melt</h3>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={temperatureData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
                <XAxis dataKey="month" tick={{ fill: 'hsl(215 12% 50%)', fontSize: 11 }} />
                <YAxis yAxisId="temp" tick={{ fill: 'hsl(215 12% 50%)', fontSize: 11 }} />
                <YAxis yAxisId="melt" orientation="right" tick={{ fill: 'hsl(215 12% 50%)', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: 'hsl(220 18% 10%)', border: '1px solid hsl(220 14% 18%)', borderRadius: 8, color: 'hsl(210 20% 92%)' }}
                />
                <Line yAxisId="temp" type="monotone" dataKey="temp" name="Temp (°C)" stroke="hsl(0 72% 51%)" strokeWidth={2} dot={{ r: 3 }} />
                <Line yAxisId="melt" type="monotone" dataKey="meltRate" name="Melt (cm/day)" stroke="hsl(199 89% 48%)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GLOF Alerts */}
        <div className="gradient-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">GLOF Alerts</h3>
          <div className="space-y-3">
            {glofAlerts.map(alert => (
              <div key={alert.id} className={`rounded-lg border p-4 ${alert.isActive ? 'border-border' : 'border-border/50 opacity-60'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <RiskLevelBadge level={alert.severity} />
                  <h4 className="text-sm font-semibold text-foreground flex-1">{alert.title}</h4>
                  <span className="text-xs font-mono text-muted-foreground">{new Date(alert.timestamp).toLocaleString()}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{alert.message}</p>
                <p className="text-xs text-muted-foreground mt-1">Lake: {alert.lake}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
