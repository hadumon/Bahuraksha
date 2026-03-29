import AppLayout from '@/components/layout/AppLayout';
import { CheckCircle, Clock, Satellite, Cloud, Mountain, Users, Brain, Radio } from 'lucide-react';

const dataSources = [
  { name: 'Sentinel-1 SAR', provider: 'ESA', type: 'Satellite', status: 'active', lastUpdate: '2h ago', icon: Satellite, desc: 'Synthetic Aperture Radar — flood detection through clouds' },
  { name: 'Sentinel-2 Optical', provider: 'ESA', type: 'Satellite', status: 'active', lastUpdate: '4h ago', icon: Satellite, desc: 'Multispectral optical imagery for land cover analysis' },
  { name: 'SRTM DEM', provider: 'NASA', type: 'Terrain', status: 'active', lastUpdate: 'Static', icon: Mountain, desc: '30m resolution Digital Elevation Model' },
  { name: 'Rainfall Forecast', provider: 'GFS/ECMWF', type: 'Weather', status: 'active', lastUpdate: '30m ago', icon: Cloud, desc: 'Global precipitation models and forecasts' },
  { name: 'River Gauges', provider: 'DHM Nepal', type: 'Hydrology', status: 'active', lastUpdate: '15m ago', icon: Radio, desc: 'Real-time water level from gauge stations' },
  { name: 'Citizen Reports', provider: 'Community', type: 'Ground Truth', status: 'active', lastUpdate: '5m ago', icon: Users, desc: 'ML-verified field observations from citizens' },
  { name: 'LSTM Model', provider: 'BAHURAKSHA', type: 'ML', status: 'active', lastUpdate: 'Running', icon: Brain, desc: 'River level prediction — 48-hour forecast window' },
  { name: 'XGBoost Classifier', provider: 'BAHURAKSHA', type: 'ML', status: 'active', lastUpdate: 'Running', icon: Brain, desc: 'Landslide probability classification model' },
];

export default function DataSourcesPage() {
  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Data Sources & Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-1">Multi-source data ingestion — satellite, terrain, weather, citizen, ML models</p>
        </div>

        {/* Pipeline diagram */}
        <div className="gradient-card rounded-xl border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">System Pipeline</h3>
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
            {['Data Sources', 'Ingestion', 'Processing', 'ML Engine', 'Risk Assessment', 'Alerts'].map((step, i) => (
              <div key={step} className="flex items-center gap-2 flex-shrink-0">
                <div className="gradient-primary text-primary-foreground text-xs font-semibold px-4 py-2 rounded-lg whitespace-nowrap">
                  {step}
                </div>
                {i < 5 && <span className="text-muted-foreground">→</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Data sources grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dataSources.map(source => (
            <div key={source.name} className="gradient-card rounded-xl border border-border p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                  <source.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">{source.name}</h3>
                    <span className="flex items-center gap-1 text-xs text-risk-safe">
                      <CheckCircle className="w-3 h-3" /> Active
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{source.desc}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{source.provider}</span>
                    <span>•</span>
                    <span>{source.type}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {source.lastUpdate}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
