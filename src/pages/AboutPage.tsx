import AppLayout from '@/components/layout/AppLayout';
import { Shield, Target, Users, Brain, Satellite, Mountain } from 'lucide-react';

export default function AboutPage() {
  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-8 max-w-4xl">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">BAHURAKSHA</h1>
              <p className="text-sm text-primary font-mono">बहुरक्षा • Predictive Flood & Landslide Intelligence System</p>
            </div>
          </div>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Nepal faces escalating threats from floods and landslides, particularly during the monsoon season.
            Traditional early warning systems provide only 2–7 hours of lead time — insufficient for coordinated
            evacuation and governance response. BAHURAKSHA aims to shift this paradigm entirely, delivering
            actionable predictions days or weeks ahead of disaster events.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { icon: Brain, title: 'ML Prediction', desc: 'LSTM neural networks for river level forecasting, XGBoost for landslide risk classification' },
            { icon: Satellite, title: 'Satellite Intelligence', desc: 'Sentinel-1 SAR flood detection through clouds, Sentinel-2 optical imagery analysis' },
            { icon: Mountain, title: 'Digital Twin', desc: 'HEC-RAS hydrological simulation for water flow, flood extent, and infrastructure impact' },
            { icon: Users, title: 'Citizen Science', desc: 'Structured mobile reporting with ML-based image classification and trust scoring' },
            { icon: Target, title: 'Risk Assessment', desc: 'Composite risk scoring across 4 levels: Safe, Watch, Warning, Evacuate' },
            { icon: Shield, title: 'Predictive Governance', desc: 'Bridge failure prediction, village relocation, embankment planning, budget prioritization' },
          ].map(item => (
            <div key={item.title} className="gradient-card rounded-xl border border-border p-5">
              <item.icon className="w-6 h-6 text-primary mb-3" />
              <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="gradient-card rounded-xl border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">Team</h3>
          <p className="text-sm text-muted-foreground">
            Tribhuvan University • Institute of Science and Technology • Madan Bhandari Memorial College
          </p>
          <div className="flex gap-6 mt-3 text-sm text-foreground">
            <span>Loozah Shrestha</span>
            <span>Sneha Devkota</span>
            <span>Nilima Shrestha</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Central Department of Computer Science and Information Technology
          </p>
        </div>

        <div className="gradient-card rounded-xl border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">MVP Pilot Region</h3>
          <p className="text-sm text-muted-foreground">Bagmati River Basin, Kathmandu Valley</p>
          <p className="text-xs text-muted-foreground mt-2">
            Future expansion: Koshi Basin, Gandaki Basin, GLOF monitoring (Imja Tsho, Tsho Rolpa)
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
