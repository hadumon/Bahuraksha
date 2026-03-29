import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  citizenReports as mockCitizenReports,
  rainfallForecast as mockRainfallForecast,
  riverLevelHistory as mockRiverLevelHistory,
  riverStations as mockRiverStations,
  systemStats as mockSystemStats,
  zoneRisks as mockZoneRisks,
} from "@/data/mockData";

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

export type DashboardStats = {
  activeAlerts: number;
  totalStations: number;
  activeSensors: number;
  citizenReports: number;
  modelAccuracy: number;
  predictionHorizon: string;
};

function fallbackDataSources(): LiveDataSource[] {
  const now = new Date().toISOString();

  return [
    {
      id: "source-s1",
      slug: "sentinel-1-sar",
      name: "Sentinel-1 SAR",
      provider: "Copernicus",
      category: "satellite",
      status: "active",
      description: "Synthetic Aperture Radar for flood extent and water detection.",
      lastUpdated: now,
      metadata: { product_type: "flood_extent", collection: "sentinel-1-grd" },
    },
    {
      id: "source-s2",
      slug: "sentinel-2-optical",
      name: "Sentinel-2 Optical",
      provider: "Copernicus",
      category: "satellite",
      status: "active",
      description:
        "Optical multispectral imagery for water, land cover, and glacial observations.",
      lastUpdated: now,
      metadata: { product_type: "surface_reflectance", collection: "sentinel-2-l2a" },
    },
    {
      id: "source-gfs",
      slug: "gfs-forecast",
      name: "Rainfall Forecast",
      provider: "NOAA GFS",
      category: "weather",
      status: "active",
      description: "Weather-driven rainfall forecast for Bagmati Basin.",
      lastUpdated: now,
      metadata: { model: "GFS" },
    },
    {
      id: "source-dhm",
      slug: "dhm-river-gauges",
      name: "River Gauges",
      provider: "DHM Nepal",
      category: "hydrology",
      status: "active",
      description: "Telemetry from river gauge stations.",
      lastUpdated: now,
      metadata: { network: "Bagmati", active_sensors: 23, total_sensors: 25 },
    },
    {
      id: "source-cr",
      slug: "citizen-reports",
      name: "Citizen Reports",
      provider: "Community",
      category: "ground-truth",
      status: "active",
      description: "Field observations submitted by citizens.",
      lastUpdated: now,
      metadata: { verification: "manual+ml" },
    },
    {
      id: "source-ml",
      slug: "bahuraksha-risk-engine",
      name: "Risk Engine",
      provider: "Bahuraksha",
      category: "ml",
      status: "active",
      description: "Composite flood and landslide risk scoring.",
      lastUpdated: now,
      metadata: { models: ["lstm", "xgboost"] },
    },
  ];
}

function isRiskLevel(value: string): value is RiskLevel {
  return ["safe", "watch", "warning", "evacuate"].includes(value);
}

function isStationTrend(value: string): value is StationTrend {
  return ["rising", "falling", "stable"].includes(value);
}

function fallbackRiskZones(): LiveRiskZone[] {
  return mockZoneRisks.map((zone) => ({
    id: zone.id,
    name: zone.name,
    district: zone.district,
    riskLevel: zone.riskLevel,
    floodProb: zone.floodProb,
    landslideProb: zone.landslideProb,
    population: zone.population,
    coordinates: zone.coordinates,
  }));
}

function fallbackRiverStations(): LiveRiverStation[] {
  return mockRiverStations.map((station) => ({
    id: station.id,
    name: station.name,
    location: station.location,
    currentLevel: station.currentLevel,
    dangerLevel: station.dangerLevel,
    warningLevel: station.warningLevel,
    trend: station.trend,
    riskLevel: station.riskLevel,
    lastUpdated: station.lastUpdated,
  }));
}

function fallbackCitizenReports(): LiveCitizenReport[] {
  return mockCitizenReports.map((report) => ({
    id: report.id,
    type: report.type,
    description: report.description,
    location: report.location,
    locationName: report.locationName,
    timestamp: report.timestamp,
    verified: report.verified,
    trustScore: report.trustScore,
  }));
}

export async function fetchRiskZones() {
  const { data, error } = await supabase
    .from("risk_zones")
    .select("*")
    .order("name");

  if (error || !data?.length) {
    return fallbackRiskZones();
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
    return fallbackRiverStations();
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
    return fallbackCitizenReports();
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

export async function fetchRiverLevelHistory(stationName = "Teku Station") {
  const { data: station } = await supabase
    .from("river_stations")
    .select("id")
    .eq("name", stationName)
    .maybeSingle();

  if (!station?.id) {
    return mockRiverLevelHistory.map((point) => ({
      time: point.time,
      actual: point.actual,
      predicted: point.predicted,
      dangerLevel: point.dangerLevel,
      warningLevel: point.warningLevel,
    }));
  }

  const { data, error } = await supabase
    .from("river_level_observations")
    .select("*")
    .eq("station_id", station.id)
    .order("observed_at", { ascending: true })
    .limit(96);

  if (error || !data?.length) {
    return mockRiverLevelHistory.map((point) => ({
      time: point.time,
      actual: point.actual,
      predicted: point.predicted,
      dangerLevel: point.dangerLevel,
      warningLevel: point.warningLevel,
    }));
  }

  return data.map((point) => ({
    time: new Date(point.observed_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    actual: point.actual_level,
    predicted: point.predicted_level,
    dangerLevel: point.danger_level,
    warningLevel: point.warning_level,
  }));
}

export async function fetchRainfallForecasts(basin = "Bagmati Basin") {
  const { data, error } = await supabase
    .from("rainfall_forecasts")
    .select("*")
    .eq("basin", basin)
    .order("forecast_date", { ascending: true })
    .limit(7);

  if (error || !data?.length) {
    return mockRainfallForecast.map((day) => ({
      day: day.day,
      rainfall: day.rainfall,
      probability: day.probability,
    }));
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
    return fallbackDataSources();
  }

  return data;
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const [alertsRes, stationsRes, reportsRes, sourcesRes] = await Promise.all([
    supabase.from("alerts").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("river_stations").select("id", { count: "exact", head: true }),
    supabase.from("citizen_reports").select("id", { count: "exact", head: true }),
    supabase.from("data_sources").select("slug, status, metadata"),
  ]);

  const stationCount = stationsRes.count ?? mockSystemStats.totalStations;
  const activeAlerts = alertsRes.count ?? mockSystemStats.activeAlerts;
  const citizenReports = reportsRes.count ?? mockSystemStats.citizenReports;
  const hydrologyMetadata = sourcesRes.data?.find(
    (source) => source.slug === "dhm-river-gauges",
  )?.metadata;
  const activeSensors =
    hydrologyMetadata &&
    typeof hydrologyMetadata === "object" &&
    "active_sensors" in hydrologyMetadata &&
    typeof hydrologyMetadata.active_sensors === "number"
      ? hydrologyMetadata.active_sensors
      : mockSystemStats.activeSensors;

  return {
    activeAlerts,
    totalStations: stationCount,
    activeSensors,
    citizenReports,
    modelAccuracy: mockSystemStats.modelAccuracy,
    predictionHorizon: mockSystemStats.predictionHorizon,
  };
}
