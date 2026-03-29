/**
 * Bahuraksha Sentinel Data Ingestion Script
 * Source: Microsoft Planetary Computer STAC API
 * Collections: sentinel-1-rtc (SAR), sentinel-2-l2a (optical/glacial)
 * Target: Supabase
 */

import { createClient } from "@supabase/supabase-js";

const STAC_BASE = "https://planetarycomputer.microsoft.com/api/stac/v1/search";

// Bahuraksha / Rolwaling Himal bounding box [west, south, east, north]
const BBOX = [86.0, 27.7, 86.6, 28.1];

const COLLECTIONS = [
  {
    id: "sentinel-1-rtc",
    label: "Sentinel-1 RTC",
    use: "flood_sar",
    extraFilter: null,
  },
  {
    id: "sentinel-2-l2a",
    label: "Sentinel-2 L2A",
    use: "optical_glacial",
    extraFilter: { "eo:cloud_cover": { lte: 30 } },
  },
];

const DEFAULT_LOOKBACK_DAYS = 30;
const PAGE_LIMIT = 50;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    "ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

async function getLastIngestedAt(collectionId) {
  const { data, error } = await supabase
    .from("sentinel_scenes")
    .select("scene_datetime")
    .eq("collection", collectionId)
    .order("scene_datetime", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    console.log(
      `[${collectionId}] No previous ingestion found — using ${DEFAULT_LOOKBACK_DAYS}d lookback.`,
    );
    return daysAgo(DEFAULT_LOOKBACK_DAYS);
  }

  return data.scene_datetime;
}

async function fetchSTACItems(collection, dateFrom) {
  const items = [];
  let token = null;

  console.log(`\n[${collection.id}] Searching from ${dateFrom} ...`);

  while (true) {
    const body = {
      collections: [collection.id],
      bbox: BBOX,
      datetime: `${dateFrom}/..`,
      limit: PAGE_LIMIT,
      sortby: [{ field: "properties.datetime", direction: "desc" }],
    };

    if (collection.extraFilter) {
      body.query = collection.extraFilter;
    }

    if (token) {
      body.token = token;
    }

    const res = await fetch(STAC_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`STAC API error ${res.status}: ${text}`);
    }

    const json = await res.json();
    const features = json.features || [];

    console.log(
      `[${collection.id}] Page returned ${features.length} items (total matched: ${json.context?.matched ?? "?"})`,
    );

    items.push(...features);

    const nextLink = json.links?.find((l) => l.rel === "next");
    if (!nextLink || features.length < PAGE_LIMIT) {
      break;
    }

    const nextUrl = new URL(nextLink.href);
    token = nextUrl.searchParams.get("token");
    if (!token) {
      break;
    }
  }

  return items;
}

function mapItemToRow(item, collection) {
  const props = item.properties || {};
  const bbox = item.bbox || BBOX;

  return {
    scene_id: item.id,
    collection: collection.id,
    use_case: collection.use,
    scene_datetime: props.datetime,
    cloud_cover: props["eo:cloud_cover"] ?? null,
    platform: props.platform ?? null,
    instrument_mode: props["sar:instrument_mode"] ?? null,
    polarizations: props["sar:polarizations"]
      ? JSON.stringify(props["sar:polarizations"])
      : null,
    orbit_state: props["sat:orbit_state"] ?? null,
    mgrs_tile: props["s2:mgrs_tile"] ?? null,
    processing_baseline: props["s2:processing_baseline"] ?? null,
    bbox_west: bbox[0],
    bbox_south: bbox[1],
    bbox_east: bbox[2],
    bbox_north: bbox[3],
    geometry: item.geometry ? JSON.stringify(item.geometry) : null,
    assets_json: item.assets ? JSON.stringify(item.assets) : null,
    stac_item_url:
      item.links?.find((l) => l.rel === "self")?.href ?? null,
    ingested_at: new Date().toISOString(),
  };
}

async function upsertScenes(rows) {
  if (rows.length === 0) {
    return { count: 0, errors: [] };
  }

  const { error } = await supabase
    .from("sentinel_scenes")
    .upsert(rows, { onConflict: "scene_id", ignoreDuplicates: false });

  if (error) {
    console.error("Supabase upsert error:", error);
    return { count: 0, errors: [error] };
  }

  return { count: rows.length, errors: [] };
}

async function main() {
  console.log("=== Bahuraksha Sentinel Ingestion ===");
  console.log(`BBOX: [${BBOX.join(", ")}]`);
  console.log(`STAC endpoint: ${STAC_BASE}\n`);

  const summary = [];

  for (const collection of COLLECTIONS) {
    try {
      const dateFrom = await getLastIngestedAt(collection.id);
      const items = await fetchSTACItems(collection, dateFrom);

      if (items.length === 0) {
        console.log(`[${collection.id}] No new scenes found.`);
        summary.push({ collection: collection.id, fetched: 0, upserted: 0 });
        continue;
      }

      const rows = items.map((item) => mapItemToRow(item, collection));
      const { count, errors } = await upsertScenes(rows);

      console.log(
        `[${collection.id}] \u2713 Upserted ${count} scenes into sentinel_scenes`,
      );

      summary.push({
        collection: collection.id,
        fetched: items.length,
        upserted: count,
        errors: errors.length,
      });
    } catch (err) {
      console.error(`[${collection.id}] Fatal error:`, err.message);
      summary.push({ collection: collection.id, error: err.message });
    }
  }

  console.log("\n=== Run Summary ===");
  console.table(summary);
}

main();
