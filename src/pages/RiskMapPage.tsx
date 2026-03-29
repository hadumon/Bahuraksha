import AppLayout from '@/components/layout/AppLayout';
import RiskMap from '@/components/map/RiskMap';
import RiskLevelBadge from '@/components/dashboard/RiskLevelBadge';
import { zoneRisks } from '@/data/mockData';
import { RiskLevel } from '@/data/mockData';

const legendItems: { level: RiskLevel; desc: string }[] = [
  { level: 'safe', desc: 'Normal conditions' },
  { level: 'watch', desc: 'Monitor closely' },
  { level: 'warning', desc: 'Prepare for action' },
  { level: 'evacuate', desc: 'Immediate evacuation' },
];

export default function RiskMapPage() {
  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Risk Map</h1>
            <p className="text-sm text-muted-foreground mt-1">Composite risk overlay — Bagmati Basin, Kathmandu Valley</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {legendItems.map(item => (
              <div key={item.level} className="flex items-center gap-1.5">
                <RiskLevelBadge level={item.level} />
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          <div className="xl:col-span-3">
            <RiskMap className="h-[calc(100vh-180px)]" />
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Zones</h3>
            {zoneRisks.map(zone => (
              <div key={zone.id} className="gradient-card p-3 rounded-lg border border-border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">{zone.name}</span>
                  <RiskLevelBadge level={zone.riskLevel} />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Flood</p>
                    <div className="w-full h-1.5 bg-secondary rounded-full mt-1">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${zone.floodProb * 100}%` }} />
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Landslide</p>
                    <div className="w-full h-1.5 bg-secondary rounded-full mt-1">
                      <div className="h-full rounded-full bg-risk-warning" style={{ width: `${zone.landslideProb * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
