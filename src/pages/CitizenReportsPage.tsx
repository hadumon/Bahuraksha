import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, MapPin, Clock, ShieldCheck, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const typeLabels = {
  rising_water: '🌊 Rising Water',
  cracks: '⚠️ Ground Cracks',
  blocked_drain: '🚧 Blocked Drain',
  landslide_signs: '⛰️ Landslide Signs',
  other: '📝 Other',
};

export default function CitizenReportsPage() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ type: 'rising_water', description: '', location: '' });
  const [reports, setReports] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('citizen_reports').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      if (data) setReports(data);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('citizen_reports').insert({
      type: formData.type,
      description: formData.description,
      location_name: formData.location,
      location_lat: 27.7,
      location_lng: 85.3,
    });
    if (error) {
      toast.error('Failed to submit report');
      return;
    }
    toast.success('Report submitted successfully! Our ML system will verify your report.');
    setShowForm(false);
    setFormData({ type: 'rising_water', description: '', location: '' });
    // Refresh
    const { data } = await supabase.from('citizen_reports').select('*').order('created_at', { ascending: false });
    if (data) setReports(data);
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Citizen Reports</h1>
            <p className="text-sm text-muted-foreground mt-1">Community-sourced field observations with ML verification</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="gradient-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" /> Submit Report
          </Button>
        </div>

        {/* Report form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="gradient-card rounded-xl border border-primary/30 p-6 shadow-glow-primary">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">New Field Report</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground uppercase block mb-1">Report Type</label>
                <select
                  value={formData.type}
                  onChange={e => setFormData(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                >
                  {Object.entries(typeLabels).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase block mb-1">Location</label>
                <Input
                  placeholder="e.g. Teku Bridge"
                  value={formData.location}
                  onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  className="bg-secondary border-border"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground uppercase block mb-1">Description</label>
                <Textarea
                  placeholder="Describe what you observe..."
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="bg-secondary border-border"
                  rows={3}
                  required
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <Button type="submit" className="gradient-primary text-primary-foreground">Submit Report</Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        )}

        {/* Reports list */}
        <div className="space-y-3">
          {reports.map(report => (
            <div key={report.id} className="gradient-card rounded-xl border border-border p-4">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-sm font-medium">{typeLabels[report.type as keyof typeof typeLabels] || report.type}</span>
                    {report.verified ? (
                      <span className="flex items-center gap-1 text-xs text-risk-safe"><CheckCircle className="w-3 h-3" /> Verified</span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-risk-watch"><XCircle className="w-3 h-3" /> Pending</span>
                    )}
                  </div>
                  <p className="text-sm text-foreground mt-1">{report.description}</p>
                  <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {report.location_name}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(report.created_at).toLocaleString()}</span>
                    <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Trust: {(report.trust_score * 100).toFixed(0)}%</span>
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
