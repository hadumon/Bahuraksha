import AppLayout from '@/components/layout/AppLayout';
import RiskLevelBadge from '@/components/dashboard/RiskLevelBadge';
import RiverLevelChart from '@/components/dashboard/RiverLevelChart';
import { riverStations } from '@/data/mockData';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

const trendIcons = { rising: ArrowUp, falling: ArrowDown, stable: Minus };
const trendColors = { rising: 'text-risk-evacuate', falling: 'text-risk-safe', stable: 'text-muted-foreground' };

export default function MonitoringPage() {
  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">River Monitoring</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time gauge station data with LSTM predictions</p>
        </div>

        {/* Station cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {riverStations.map(station => {
            const TrendIcon = trendIcons[station.trend];
            const percentage = (station.currentLevel / station.dangerLevel) * 100;
            return (
              <div key={station.id} className="gradient-card rounded-xl border border-border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-foreground">{station.name}</h3>
                  <RiskLevelBadge level={station.riskLevel} />
                </div>
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-3xl font-bold font-mono text-foreground">{station.currentLevel}</span>
                  <span className="text-sm text-muted-foreground mb-1">m</span>
                  <TrendIcon className={`w-4 h-4 mb-1 ${trendColors[station.trend]}`} />
                </div>
                <div className="w-full h-2 bg-secondary rounded-full">
                  <div
                    className={`h-full rounded-full transition-all ${percentage > 100 ? 'bg-risk-evacuate' : percentage > 85 ? 'bg-risk-warning' : 'bg-primary'}`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground">0m</span>
                  <span className="text-[10px] text-risk-warning">Warn: {station.warningLevel}m</span>
                  <span className="text-[10px] text-risk-evacuate">Danger: {station.dangerLevel}m</span>
                </div>
              </div>
            );
          })}
        </div>

        <RiverLevelChart />
      </div>
    </AppLayout>
  );
}
