import { createClient } from "@supabase/supabase-js";

const requiredEnv = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SATELLITE_STAC_API"];
const missing = requiredEnv.filter((name) => !process.env[name]);

if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const config = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  stacApi: process.env.SATELLITE_STAC_API,
  collection: process.env.SATELLITE_COLLECTION ?? "sentinel-1-grd",
  sourceSlug: process.env.SATELLITE_SOURCE_SLUG ?? "sentinel-1-sar",
  productType: process.env.SATELLITE_PRODUCT_TYPE ?? "flood_extent",
  regionName: process.env.SATELLITE_REGION ?? "Bagmati Basin",
  provider: process.env.SATELLITE_PROVIDER ?? "Copernicus",
  sourceName: process.env.SATELLITE_SOURCE_NAME ?? "Sentinel ingestion",
  sourceDescription:
    process.env.SATELLITE_SOURCE_DESCRIPTION ??
    "Satellite products ingested from a STAC-compatible endpoint.",
  category: process.env.SATELLITE_CATEGORY ?? "satellite",
  bbox: (process.env.SATELLITE_BBOX ?? "85.20,27.60,85.45,27.82")
    .split(",")
    .map(Number),
  datetime: process.env.SATELLITE_DATETIME ?? "2026-01-01T00:00:00Z/..",
  limit: Number(process.env.SATELLITE_LIMIT ?? "3"),
  riskLevel: process.env.SATELLITE_RISK_LEVEL ?? null,
  floodAreaKm2: process.env.SATELLITE_FLOOD_AREA_KM2
    ? Number(process.env.SATELLITE_FLOOD_AREA_KM2)
    : null,
  cloudCover: process.env.SATELLITE_CLOUD_COVER
    ? Number(process.env.SATELLITE_CLOUD_COVER)
    : null,
  resolutionMeters: process.env.SATELLITE_RESOLUTION_METERS
    ? Number(process.env.SATELLITE_RESOLUTION_METERS)
    : 10,
};

if (config.bbox.length !== 4 || config.bbox.some(Number.isNaN)) {
  console.error("SATELLITE_BBOX must be four comma-separated numbers: minLng,minLat,maxLng,maxLat");
  process.exit(1);
}

const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

async function searchStac() {
  const response = await fetch(config.stacApi, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      collections: [config.collection],
      bbox: config.bbox,
      datetime: config.datetime,
      limit: config.limit,
      sortby: [{ field: "properties.datetime", direction: "desc" }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`STAC search failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  return Array.isArray(payload.features) ? payload.features : [];
}

function toFeatureGeometry(feature) {
  if (!feature?.geometry) {
    return null;
  }

  return {
    type: "Feature",
    properties: {
      stac_id: feature.id,
      collection: feature.collection,
    },
    geometry: feature.geometry,
  };
}

function toSatelliteProductRow(feature, index) {
  const observedAt =
    feature?.properties?.datetime ??
    feature?.properties?.start_datetime ??
    new Date().toISOString();

  return {
    source_slug: config.sourceSlug,
    product_type: config.productType,
    region_name: config.regionName,
    observed_at: observedAt,
    risk_level: config.riskLevel,
    flood_area_km2: config.floodAreaKm2,
    cloud_cover:
      typeof feature?.properties?.["eo:cloud_cover"] === "number"
        ? feature.properties["eo:cloud_cover"]
        : config.cloudCover,
    resolution_meters: config.resolutionMeters,
    footprint_geojson: toFeatureGeometry(feature),
    metadata: {
      ingestion_rank: index,
      stac_id: feature.id,
      collection: feature.collection,
      assets: Object.keys(feature.assets ?? {}),
      properties: feature.properties ?? {},
      links: feature.links ?? [],
    },
    product_url:
      feature?.assets?.visual?.href ??
      feature?.assets?.rendered_preview?.href ??
      feature?.assets?.thumbnail?.href ??
      null,
    thumbnail_url: feature?.assets?.thumbnail?.href ?? null,
    is_latest: index === 0,
  };
}

async function main() {
  console.log(`Searching ${config.collection} from ${config.stacApi} for ${config.regionName}...`);
  const features = await searchStac();

  if (!features.length) {
    console.log("No satellite features found for the requested parameters.");
    return;
  }

  const latestObservedAt =
    features[0]?.properties?.datetime ??
    features[0]?.properties?.start_datetime ??
    new Date().toISOString();

  const { error: sourceError } = await supabase.from("data_sources").upsert(
    {
      slug: config.sourceSlug,
      name: config.sourceName,
      provider: config.provider,
      category: config.category,
      status: "active",
      description: config.sourceDescription,
      last_updated: latestObservedAt,
      metadata: {
        collection: config.collection,
        stac_api: config.stacApi,
        region: config.regionName,
      },
    },
    { onConflict: "slug" },
  );

  if (sourceError) {
    throw sourceError;
  }

  const { error: resetError } = await supabase
    .from("satellite_products")
    .update({ is_latest: false })
    .eq("source_slug", config.sourceSlug)
    .eq("product_type", config.productType)
    .eq("region_name", config.regionName);

  if (resetError) {
    throw resetError;
  }

  const rows = features.map(toSatelliteProductRow);
  const { error: insertError } = await supabase.from("satellite_products").insert(rows);

  if (insertError) {
    throw insertError;
  }

  console.log(`Inserted ${rows.length} satellite product(s) into Supabase.`);
  console.log(`Latest observation: ${rows[0].observed_at}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
