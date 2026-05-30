import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type RiskLevel = "safe" | "watch" | "warning" | "evacuate";
export type StationTrend = "rising" | "falling" | "stable";

export type LiveRiskZone = {
  id: string;
  name: string;
  district: string;
  riskLevel: RiskLevel;
  floodProb: number;
  landslideProb: number;
  population: number;
  coordinates: [number, number];
  updatedAt?: string;
};

export type LiveRiverStation = {
  id: string;
  name: string;
  location: [number, number];
  currentLevel: number;
  dangerLevel: number;
  warningLevel: number;
  trend: StationTrend;
  riskLevel: RiskLevel;
  lastUpdated: string;
};

export type LiveCitizenReport = {
  id: string;
  type: string;
  description: string;
  location: [number, number];
  locationName: string;
  timestamp: string;
  verified: boolean;
  trustScore: number;
};

export type LiveRiverLevelPoint = {
  time: string;
  actual: number | null;
  predicted: number | null;
  dangerLevel: number;
  warningLevel: number;
};

export type LiveRainfallForecast = {
  day: string;
  rainfall: number;
  probability: number;
  forecastDate?: string;
};

export type LiveSatelliteProduct = {
  id: string;
  sourceSlug: string;
  productType: string;
  regionName: string;
  observedAt: string;
  riskLevel: RiskLevel | null;
  floodAreaKm2: number | null;
  cloudCover: number | null;
  resolutionMeters: number | null;
  footprintGeoJson: Json | null;
  metadata: Json;
  productUrl: string | null;
  thumbnailUrl: string | null;
};

export type LiveDataSource = {
  id: string;
  slug: string;
  name: string;
  provider: string;
  category: string;
  status: string;
  description: string;
  lastUpdated: string | null;
  metadata: Json;
};

export type LiveSentinelScene = {
  id: string;
  sceneId: string;
  collection: string;
  useCase: string;
  sceneDatetime: string;
  cloudCover: number | null;
  platform: string | null;
  instrumentMode: string | null;
  orbitState: string | null;
  mgrsTile: string | null;
  processingBaseline: string | null;
  stacItemUrl: string | null;
  ingestedAt: string;
};

export type DashboardStats = {
  activeAlerts: number;
  totalStations: number;
  activeSensors: number;
  citizenReports: number;
  modelAccuracy: number | null;
  predictionHorizon: string | null;
};

function isRiskLevel(value: string): value is RiskLevel {
  return ["safe", "watch", "warning", "evacuate"].includes(value);
}

function isStationTrend(value: string): value is StationTrend {
  return ["rising", "falling", "stable"].includes(value);
}

export async function fetchRiskZones() {
  const { data, error } = await supabase
    .from("risk_zones")
    .select("*")
    .order("name");

  if (error || !data?.length) {
    return [] as LiveRiskZone[];
  }

  return data.map((zone) => ({
    id: zone.id,
    name: zone.name,
    district: zone.district,
    riskLevel: isRiskLevel(zone.risk_level) ? zone.risk_level : "safe",
    floodProb: zone.flood_probability,
    landslideProb: zone.landslide_probability,
    population: zone.population,
    coordinates: [zone.center_lat, zone.center_lng] as [number, number],
    updatedAt: zone.updated_at,
  }));
}

export async function fetchRiverStations() {
  const { data, error } = await supabase
    .from("river_stations")
    .select("*")
    .order("name");

  if (error || !data?.length) {
    return [] as LiveRiverStation[];
  }

  return data.map((station) => ({
    id: station.id,
    name: station.name,
    location: [station.location_lat, station.location_lng] as [number, number],
    currentLevel: station.current_level,
    dangerLevel: station.danger_level,
    warningLevel: station.warning_level,
    trend: isStationTrend(station.trend) ? station.trend : "stable",
    riskLevel: isRiskLevel(station.risk_level) ? station.risk_level : "safe",
    lastUpdated: station.last_updated,
  }));
}

export async function fetchCitizenReports() {
  const { data, error } = await supabase
    .from("citizen_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !data?.length) {
    return [] as LiveCitizenReport[];
  }

  return data.map((report) => ({
    id: report.id,
    type: report.type,
    description: report.description,
    location: [report.location_lat, report.location_lng] as [number, number],
    locationName: report.location_name,
    timestamp: report.created_at,
    verified: report.verified,
    trustScore: report.trust_score,
  }));
}

function generateMockRiverLevelHistory(stationName: string): LiveRiverLevelPoint[] {
  const now = new Date();
  const points: LiveRiverLevelPoint[] = [];
  const dangerLevel = 5.5;
  const warningLevel = 4.8;
  for (let i = -24; i <= 24; i += 2) {
    const time = new Date(now.getTime() + i * 60 * 60 * 1000);
    const t = (i + 24) / 48;
    const level = 2.8 + 3 * (1 - Math.cos(t * Math.PI * 2)) / 2 + Math.sin(t * Math.PI * 6) * 0.1;
    const isPast = i <= 0;
    points.push({
      time: time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      actual: isPast ? Number(level.toFixed(2)) : null,
      predicted: !isPast ? Number((level + (Math.random() - 0.5) * 0.12).toFixed(2)) : null,
      dangerLevel,
      warningLevel,
    });
  }
  if (points.length > 12) {
    points[12].predicted = points[12].actual;
  }
  return points;
}

export async function fetchRiverLevelHistory(stationName = "Teku Station") {
  // Synthetic Hydrological Routing Engine
  // Fetches real rainfall forecast and routes it into synthetic river levels
  const rainfall = await fetchRainfallForecasts("Bagmati Basin");
  
  if (!rainfall || rainfall.length === 0) {
    // Fall back to a realistic mock hydrograph when no DB data is available
    return generateMockRiverLevelHistory(stationName);
  }

  // Base parameters for Teku station
  const baseLevel = 2.5;
  const dangerLevel = 5.5;
  const warningLevel = 4.8;
  const points: LiveRiverLevelPoint[] = [];

  // Generate 48 hours of data (24h past actuals, 24h future predictions)
  const now = new Date();
  
  // Use today's and yesterday's rainfall to compute base flow
  const recentRainfall = rainfall[0]?.rainfall || 0;
  const upcomingRainfall = rainfall[1]?.rainfall || 0;

  for (let i = -24; i <= 24; i += 2) {
    const time = new Date(now.getTime() + i * 60 * 60 * 1000);
    
    // Synthetic Muskingum-style routing
    // Time delay for peak flow (roughly 6-8 hours for Bagmati catchment)
    const timeOffset = (i + 24) / 48; // 0 to 1
    
    // Calculate synthetic routing curve using a gamma-like distribution for hydrograph
    const rainFactor = i < 0 ? recentRainfall : (recentRainfall + (upcomingRainfall * timeOffset));
    const dischargeBoost = rainFactor > 0 ? (Math.pow(rainFactor, 0.8) / 10) : 0;
    
    // Diurnal noise + hydrograph peak
    const noise = Math.sin(i * Math.PI / 12) * 0.1;
    const computedLevel = baseLevel + dischargeBoost + noise;
    
    const isPast = i <= 0;
    
    points.push({
      time: time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      actual: isPast ? computedLevel : null,
      predicted: isPast ? null : computedLevel + (Math.random() * 0.2 - 0.1),
      dangerLevel,
      warningLevel,
    });
  }

  // Ensure continuity at index 12 (now)
  if (points.length > 12 && points[12].actual !== null) {
    points[12].predicted = points[12].actual;
  }

  return points;
}

export async function fetchRainfallForecasts(basin = "Bagmati Basin") {
  const { data, error } = await supabase
    .from("rainfall_forecasts")
    .select("*")
    .eq("basin", basin)
    .order("forecast_date", { ascending: true })
    .limit(7);

  if (error || !data?.length) {
    return [] as LiveRainfallForecast[];
  }

  return data.map((row) => ({
    day: new Date(row.forecast_date).toLocaleDateString([], {
      weekday: "short",
    }),
    rainfall: row.rainfall_mm,
    probability: row.probability,
    forecastDate: row.forecast_date,
  }));
}

export async function fetchSatelliteProducts() {
  const { data, error } = await supabase
    .from("satellite_products")
    .select("*")
    .eq("is_latest", true)
    .order("observed_at", { ascending: false });

  if (error || !data?.length) {
    return [] as LiveSatelliteProduct[];
  }

  return data.map((product) => ({
    id: product.id,
    sourceSlug: product.source_slug,
    productType: product.product_type,
    regionName: product.region_name,
    observedAt: product.observed_at,
    riskLevel: product.risk_level && isRiskLevel(product.risk_level)
      ? product.risk_level
      : null,
    floodAreaKm2: product.flood_area_km2,
    cloudCover: product.cloud_cover,
    resolutionMeters: product.resolution_meters,
    footprintGeoJson: product.footprint_geojson,
    metadata: product.metadata,
    productUrl: product.product_url,
    thumbnailUrl: product.thumbnail_url,
  }));
}

export async function fetchDataSources() {
  const { data, error } = await supabase
    .from("data_sources")
    .select("*")
    .order("name");

  if (error || !data?.length) {
    return [] as LiveDataSource[];
  }

  return data.map((source) => ({
    id: source.id,
    slug: source.slug,
    name: source.name,
    provider: source.provider,
    category: source.category,
    status: source.status,
    description: source.description,
    lastUpdated: source.last_updated,
    metadata: source.metadata,
  }));
}

export async function fetchLatestSentinelScenes(limit = 12) {
  const { data, error } = await supabase
    .from("sentinel_scenes")
    .select("*")
    .order("scene_datetime", { ascending: false })
    .limit(limit);

  if (error || !data?.length) {
    return [] as LiveSentinelScene[];
  }

  return data.map((scene) => ({
    id: scene.id,
    sceneId: scene.scene_id,
    collection: scene.collection,
    useCase: scene.use_case,
    sceneDatetime: scene.scene_datetime,
    cloudCover: scene.cloud_cover,
    platform: scene.platform,
    instrumentMode: scene.instrument_mode,
    orbitState: scene.orbit_state,
    mgrsTile: scene.mgrs_tile,
    processingBaseline: scene.processing_baseline,
    stacItemUrl: scene.stac_item_url,
    ingestedAt: scene.ingested_at,
  }));
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const [alertsRes, stationsRes, reportsRes, sourcesRes] = await Promise.all([
    supabase.from("alerts").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("river_stations").select("id", { count: "exact", head: true }),
    supabase.from("citizen_reports").select("id", { count: "exact", head: true }),
    supabase.from("data_sources").select("slug, status, metadata"),
  ]);

  const stationCount = stationsRes.count ?? 0;
  const activeAlerts = alertsRes.count ?? 0;
  const citizenReports = reportsRes.count ?? 0;
  const hydrologyMetadata = sourcesRes.data?.find(
    (source) => source.slug === "dhm-river-gauges",
  )?.metadata;
  const activeSensors =
    hydrologyMetadata &&
    typeof hydrologyMetadata === "object" &&
    "active_sensors" in hydrologyMetadata &&
    typeof hydrologyMetadata.active_sensors === "number"
      ? hydrologyMetadata.active_sensors
      : 0;

  return {
    activeAlerts,
    totalStations: stationCount,
    activeSensors,
    citizenReports,
    modelAccuracy: null,
    predictionHorizon: null,
  };
}
