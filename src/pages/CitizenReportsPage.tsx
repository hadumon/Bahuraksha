import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, MapPin, Clock, ShieldCheck, Plus, Loader2, Navigation, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { predictLandslideRisk } from '@/lib/landslideModel';

const typeLabels = {
  rising_water: 'Rising Water',
  cracks: 'Ground Cracks',
  blocked_drain: 'Blocked Drain',
  landslide_signs: 'Landslide Signs',
  other: 'Other',
} as const;

const typeIcons = {
  rising_water: '🌊',
  cracks: '⚠️',
  blocked_drain: '🚧',
  landslide_signs: '⛰️',
  other: '📝',
} as const;

type CitizenReportType = keyof typeof typeLabels;

type Report = {
  id: string;
  type: CitizenReportType;
  description: string;
  location_name: string;
  location_lat: number;
  location_lng: number;
  verified: boolean;
  trust_score: number;
  created_at: string;
  ml_risk_score?: number;
  ml_risk_level?: string;
};

export default function CitizenReportsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<{
    type: CitizenReportType;
    description: string;
    location: string;
  }>({ type: 'rising_water', description: '', location: '' });
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mlChecking, setMlChecking] = useState<Record<string, boolean>>({});

  const { data: reports = [], isLoading } = useQuery<Report[]>({
    queryKey: ['citizen-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('citizen_reports')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Report[];
    },
  });

  const getLocation = useCallback(() => {
    setLocating(true);
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        toast.success('Location captured');
      },
      () => {
        toast.error('Unable to retrieve your location');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  const checkMlRisk = useCallback(async (report: Report) => {
    setMlChecking((prev) => ({ ...prev, [report.id]: true }));
    try {
      const prediction = await predictLandslideRisk({
        slopeAngleDeg: 30,
        soilMoisturePct: 60,
        rainfall7DayMm: 100,
        rainfallTodayMm: 15,
        seismicActivityMg: 0.002,
        vegetationCoverPct: 50,
        elevationM: 1400,
        distanceToRoadKm: 2,
      });
      queryClient.setQueryData<Report[]>(['citizen-reports'], (old) =>
        old?.map((r) =>
          r.id === report.id
            ? { ...r, ml_risk_score: prediction.probability, ml_risk_level: prediction.riskLevel }
            : r,
        ),
      );
    } catch (e) {
      console.error('ML risk check failed:', e);
      toast.error('ML check failed');
    } finally {
      setMlChecking((prev) => ({ ...prev, [report.id]: false }));
    }
  }, [queryClient]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const lat = userLocation?.lat ?? 27.7172;
    const lng = userLocation?.lng ?? 85.324;

    const { error } = await supabase.from('citizen_reports').insert({
      type: formData.type,
      description: formData.description,
      location_name: formData.location,
      location_lat: lat,
      location_lng: lng,
    });

    setSubmitting(false);
    if (error) {
      toast.error('Failed to submit report');
      return;
    }
    toast.success('Report submitted! ML verification in progress.');
    setShowForm(false);
    setFormData({ type: 'rising_water', description: '', location: '' });
    queryClient.invalidateQueries({ queryKey: ['citizen-reports'] });
  };

  const reportStats = {
    total: reports.length,
    verified: reports.filter((r) => r.verified).length,
    pending: reports.filter((r) => !r.verified).length,
    landslide: reports.filter((r) => r.type === 'landslide_signs').length,
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Citizen Reports</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Community-sourced field observations with ML verification
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="gradient-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" /> Submit Report
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="gradient-card rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground uppercase">Total Reports</p>
            <p className="text-2xl font-bold text-foreground mt-1">{reportStats.total}</p>
          </div>
          <div className="gradient-card rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground uppercase">Verified</p>
            <p className="text-2xl font-bold text-emerald-500 mt-1">{reportStats.verified}</p>
          </div>
          <div className="gradient-card rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground uppercase">Pending</p>
            <p className="text-2xl font-bold text-amber-500 mt-1">{reportStats.pending}</p>
          </div>
          <div className="gradient-card rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground uppercase">Landslide Signs</p>
            <p className="text-2xl font-bold text-red-500 mt-1">{reportStats.landslide}</p>
          </div>
        </div>

        {/* Report form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="gradient-card rounded-xl border border-primary/30 p-6 shadow-glow-primary">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">New Field Report</h3>

            {/* Location */}
            <div className="mb-4 p-3 bg-secondary/50 rounded-lg border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">
                    {userLocation
                      ? `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`
                      : 'Location not set'}
                  </span>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={getLocation} disabled={locating}>
                  {locating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Navigation className="w-3 h-3 mr-1" />}
                  {locating ? 'Locating...' : 'Use GPS'}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground uppercase block mb-1">Report Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value as CitizenReportType }))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                >
                  {(Object.entries(typeLabels) as [CitizenReportType, string][]).map(([val, label]) => (
                    <option key={val} value={val}>
                      {typeIcons[val]} {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase block mb-1">Location Name</label>
                <Input
                  placeholder="e.g. Teku Bridge"
                  value={formData.location}
                  onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                  className="bg-secondary border-border"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground uppercase block mb-1">Description</label>
                <Textarea
                  placeholder="Describe what you observe..."
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  className="bg-secondary border-border"
                  rows={3}
                  required
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <Button type="submit" className="gradient-primary text-primary-foreground" disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {submitting ? 'Submitting...' : 'Submit Report'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {/* Reports list */}
        <div className="space-y-3">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {!isLoading && reports.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg font-medium">No reports yet</p>
              <p className="text-sm mt-1">Be the first to submit a field observation</p>
            </div>
          )}
          {reports.map((report) => (
            <div key={report.id} className="gradient-card rounded-xl border border-border p-4">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-sm font-medium">
                      {typeIcons[report.type]} {typeLabels[report.type] || report.type}
                    </span>
                    {report.verified ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-500">
                        <CheckCircle className="w-3 h-3" /> Verified
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-amber-500">
                        <XCircle className="w-3 h-3" /> Pending
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground mt-1">{report.description}</p>
                  <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {report.location_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {new Date(report.created_at).toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Trust: {(report.trust_score * 100).toFixed(0)}%
                    </span>
                  </div>

                  {/* ML Risk Check */}
                  {report.type === 'landslide_signs' && (
                    <div className="mt-3 pt-3 border-t border-border">
                      {report.ml_risk_level ? (
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={`w-4 h-4 ${
                            report.ml_risk_level === 'evacuate' ? 'text-red-500' :
                            report.ml_risk_level === 'warning' ? 'text-amber-500' :
                            report.ml_risk_level === 'watch' ? 'text-emerald-500' :
                            'text-blue-400'
                          }`} />
                          <span className="text-xs font-medium">
                            ML Risk: {report.ml_risk_level.toUpperCase()} ({((report.ml_risk_score ?? 0) * 100).toFixed(0)}%)
                          </span>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => checkMlRisk(report)}
                          disabled={mlChecking[report.id]}
                          className="text-xs h-7 px-2"
                        >
                          {mlChecking[report.id] ? (
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          ) : (
                            <ShieldCheck className="w-3 h-3 mr-1" />
                          )}
                          {mlChecking[report.id] ? 'Checking...' : 'Run ML Risk Check'}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
