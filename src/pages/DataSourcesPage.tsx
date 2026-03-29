import { useQuery } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
import { CheckCircle, Clock, Satellite, Cloud, Mountain, Users, Brain, Radio } from "lucide-react";
import { fetchDataSources, fetchSatelliteProducts } from "@/lib/operationalData";

const iconByCategory = {
  satellite: Satellite,
  weather: Cloud,
  terrain: Mountain,
  "ground-truth": Users,
  hydrology: Radio,
  ml: Brain,
} as const;

export default function DataSourcesPage() {
  const { data: sources = [] } = useQuery({
    queryKey: ["data-sources"],
    queryFn: fetchDataSources,
  });
  const { data: satelliteProducts = [] } = useQuery({
    queryKey: ["satellite-products", "data-sources"],
    queryFn: fetchSatelliteProducts,
  });

  const latestSatelliteUpdate =
    satelliteProducts[0]?.observedAt ?? sources.find((source) => source.category === "satellite")?.lastUpdated;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Data Sources & Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live operational sources from Supabase-backed ingestion and satellite products.
          </p>
        </div>

        <div className="gradient-card rounded-xl border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">System Pipeline</h3>
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
            {["Data Sources", "Ingestion", "Processing", "ML Engine", "Risk Assessment", "Alerts"].map((step, i) => (
              <div key={step} className="flex items-center gap-2 flex-shrink-0">
                <div className="gradient-primary text-primary-foreground text-xs font-semibold px-4 py-2 rounded-lg whitespace-nowrap">
                  {step}
                </div>
                {i < 5 && <span className="text-muted-foreground">→</span>}
              </div>
            ))}
          </div>
          {latestSatelliteUpdate && (
            <p className="text-xs text-muted-foreground mt-4">
              Latest satellite ingestion: {new Date(latestSatelliteUpdate).toLocaleString()}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sources.map((source) => {
            const Icon = iconByCategory[source.category as keyof typeof iconByCategory] ?? Satellite;
            return (
              <div key={source.id} className="gradient-card rounded-xl border border-border p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-foreground">{source.name}</h3>
                      <span className="flex items-center gap-1 text-xs text-risk-safe">
                        <CheckCircle className="w-3 h-3" /> {source.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{source.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                      <span>{source.provider}</span>
                      <span>•</span>
                      <span>{source.category}</span>
                      {source.lastUpdated && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {new Date(source.lastUpdated).toLocaleString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
