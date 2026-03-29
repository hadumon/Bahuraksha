import { useQuery } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
import {
  CheckCircle,
  Clock,
  Satellite,
  Cloud,
  Mountain,
  Users,
  Brain,
  Radio,
  Link as LinkIcon,
} from "lucide-react";
import {
  fetchDataSources,
  fetchLatestSentinelScenes,
  fetchSatelliteProducts,
} from "@/lib/operationalData";

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
  const { data: sentinelScenes = [] } = useQuery({
    queryKey: ["sentinel-scenes", "latest"],
    queryFn: () => fetchLatestSentinelScenes(12),
  });

  const latestSatelliteUpdate =
    sentinelScenes[0]?.sceneDatetime ??
    satelliteProducts[0]?.observedAt ??
    sources.find((source) => source.category === "satellite")?.lastUpdated;

  const sceneCounts = sentinelScenes.reduce<Record<string, number>>((acc, scene) => {
    acc[scene.collection] = (acc[scene.collection] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Data Sources & Pipeline
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live operational sources from Supabase-backed ingestion and satellite
            products.
          </p>
        </div>

        <div className="gradient-card rounded-xl border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
            System Pipeline
          </h3>
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
            {[
              "Data Sources",
              "Ingestion",
              "Processing",
              "ML Engine",
              "Risk Assessment",
              "Alerts",
            ].map((step, i) => (
              <div key={step} className="flex items-center gap-2 flex-shrink-0">
                <div className="gradient-primary text-primary-foreground text-xs font-semibold px-4 py-2 rounded-lg whitespace-nowrap">
                  {step}
                </div>
                {i < 5 && <span className="text-muted-foreground">{"->"}</span>}
              </div>
            ))}
          </div>
          {latestSatelliteUpdate && (
            <p className="text-xs text-muted-foreground mt-4">
              Latest satellite ingestion:{" "}
              {new Date(latestSatelliteUpdate).toLocaleString()}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sources.map((source) => {
            const Icon =
              iconByCategory[source.category as keyof typeof iconByCategory] ??
              Satellite;
            const sceneCount =
              source.slug === "sentinel-1-sar"
                ? sceneCounts["sentinel-1-rtc"] ?? 0
                : source.slug === "sentinel-2-optical"
                  ? sceneCounts["sentinel-2-l2a"] ?? 0
                  : 0;

            return (
              <div
                key={source.id}
                className="gradient-card rounded-xl border border-border p-5"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-foreground">
                        {source.name}
                      </h3>
                      <span className="flex items-center gap-1 text-xs text-risk-safe">
                        <CheckCircle className="w-3 h-3" /> {source.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {source.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                      <span>{source.provider}</span>
                      <span>|</span>
                      <span>{source.category}</span>
                      {sceneCount > 0 && (
                        <>
                          <span>|</span>
                          <span>{sceneCount} live scenes</span>
                        </>
                      )}
                      {source.lastUpdated && (
                        <>
                          <span>|</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />{" "}
                            {new Date(source.lastUpdated).toLocaleString()}
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

        <div className="gradient-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Latest Sentinel Scenes
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Real records from `sentinel_scenes` ingested into Supabase
              </p>
            </div>
            <span className="text-xs text-muted-foreground">
              {sentinelScenes.length} recent scenes
            </span>
          </div>

          <div className="space-y-3">
            {sentinelScenes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No ingested Sentinel scenes found yet.
              </p>
            ) : (
              sentinelScenes.map((scene) => (
                <div
                  key={scene.id}
                  className="rounded-lg border border-border/70 bg-secondary/20 p-4"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">
                        {scene.collection}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Scene ID: {scene.sceneId}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(scene.sceneDatetime).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
                    <span>Use case: {scene.useCase}</span>
                    {scene.platform && <span>Platform: {scene.platform}</span>}
                    {scene.instrumentMode && (
                      <span>Mode: {scene.instrumentMode}</span>
                    )}
                    {scene.orbitState && (
                      <span>Orbit: {scene.orbitState}</span>
                    )}
                    {scene.cloudCover !== null && (
                      <span>Cloud cover: {scene.cloudCover}%</span>
                    )}
                    {scene.mgrsTile && <span>Tile: {scene.mgrsTile}</span>}
                  </div>

                  {scene.stacItemUrl && (
                    <a
                      href={scene.stacItemUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 mt-3 text-xs text-primary hover:underline"
                    >
                      <LinkIcon className="w-3 h-3" />
                      View STAC item
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
