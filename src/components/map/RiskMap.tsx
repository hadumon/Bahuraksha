import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchCitizenReports,
  fetchRainfallForecasts,
  fetchRiskZones,
  fetchRiverStations,
  fetchSatelliteProducts,
  type RiskLevel,
} from "@/lib/operationalData";
import { getLatest } from "@/lib/bahuraksha-api";
import { computeCompositeRiskZones, normalizeRainfallForecasts } from "@/lib/riskEngine";
import { fetchSyntheticRoutingResults } from "@/lib/hecrasModel";
import { ZONE_POLYGONS } from "@/lib/zonePolygons";
import "leaflet/dist/leaflet.css";

const riskColors: Record<RiskLevel, string> = {
  safe: "#22c55e",
  watch: "#eab308",
  warning: "#f97316",
  evacuate: "#ef4444",
};

const riskFillOpacity: Record<RiskLevel, number> = {
  safe: 0.18,
  watch: 0.25,
  warning: 0.32,
  evacuate: 0.40,
};

export default function RiskMap({ className = "" }: { className?: string }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const { data: zones = [] } = useQuery({
    queryKey: ["risk-zones"],
    queryFn: fetchRiskZones,
  });
  const { data: stations = [] } = useQuery({
    queryKey: ["river-stations"],
    queryFn: fetchRiverStations,
  });
  const { data: reports = [] } = useQuery({
    queryKey: ["citizen-reports", "map"],
    queryFn: fetchCitizenReports,
  });
  const { data: satelliteProducts = [] } = useQuery({
    queryKey: ["satellite-products", "latest"],
    queryFn: fetchSatelliteProducts,
  });
  const { data: rainfallRows = [] } = useQuery({
    queryKey: ["rainfall-forecasts", "Bagmati Basin"],
    queryFn: () => fetchRainfallForecasts("Bagmati Basin"),
  });
  const { data: xgboostPrediction } = useQuery({
    queryKey: ["bahuraksha-latest-prediction"],
    queryFn: getLatest,
    retry: 1,
    staleTime: 1000 * 60 * 10,
  });
  const { data: hecRasResults } = useQuery({
    queryKey: ["hec-ras-routing"],
    queryFn: fetchSyntheticRoutingResults,
    staleTime: 1000 * 60 * 15,
    retry: 1,
  });
  const computedZones = computeCompositeRiskZones({
    zones,
    stations,
    rainfall: normalizeRainfallForecasts(rainfallRows),
    xgboostPrediction,
    hecRasResults,
  });

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !mapRef.current) return;

      const map = L.map(mapRef.current, {
        center: [27.7172, 85.324],
        zoom: 12,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      }).addTo(map);

      mapInstanceRef.current = map;
      resizeObserverRef.current = new ResizeObserver(() => map.invalidateSize());
      if (mapRef.current) resizeObserverRef.current.observe(mapRef.current);
      setTimeout(() => map.invalidateSize(), 100);
    });

    return () => {
      cancelled = true;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current) return;

    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !mapInstanceRef.current) return;

      overlaysRef.current.forEach((layer) => {
        mapInstanceRef.current.removeLayer(layer);
      });
      overlaysRef.current = [];

      // ── Risk zone polygons (colored filled regions) ──────────────────
      computedZones.forEach((zone) => {
        const riskLevel = zone.computedRiskLevel;
        const color = riskColors[riskLevel];
        const fillOpacity = riskFillOpacity[riskLevel];

        // Find matching polygon by zone name
        const polygon = ZONE_POLYGONS.find(
          (p) => p.properties.zoneName === zone.name,
        );

        if (polygon) {
          const geoLayer = L.geoJSON(polygon as any, {
            style: {
              color: color,
              weight: 2,
              opacity: 0.85,
              fillColor: color,
              fillOpacity: fillOpacity,
              dashArray: riskLevel === "evacuate" ? undefined : undefined,
            },
          }).addTo(mapInstanceRef.current);

          geoLayer.bindPopup(
            createPopupNode(zone, riskLevel, color),
          );

          overlaysRef.current.push(geoLayer);

          // Add a label marker at the zone center
          const labelIcon = L.divIcon({
            className: "zone-label",
            html: `<div style="
              font-size: 11px;
              font-weight: 600;
              color: #fff;
              text-shadow: 0 1px 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.5);
              white-space: nowrap;
              pointer-events: none;
              text-align: center;
              line-height: 1.3;
            ">
              <div>${zone.name}</div>
              <div style="
                font-size: 9px;
                font-weight: 700;
                color: ${color};
                text-transform: uppercase;
                letter-spacing: 0.5px;
              ">${riskLevel} · ${(zone.computedFloodProb * 100).toFixed(0)}%</div>
            </div>`,
            iconSize: [120, 30],
            iconAnchor: [60, 15],
          });

          const labelMarker = L.marker(zone.coordinates, {
            icon: labelIcon,
            interactive: false,
          }).addTo(mapInstanceRef.current);

          overlaysRef.current.push(labelMarker);
        }
      });

      // ── Evacuate zone pulsing border ─────────────────────────────────
      computedZones
        .filter((z) => z.computedRiskLevel === "evacuate")
        .forEach((zone) => {
          const polygon = ZONE_POLYGONS.find(
            (p) => p.properties.zoneName === zone.name,
          );
          if (polygon) {
            const pulseLayer = L.geoJSON(polygon as any, {
              style: {
                color: "#ef4444",
                weight: 3,
                opacity: 0.6,
                fillColor: "transparent",
                fillOpacity: 0,
                dashArray: "8 6",
                className: "evacuate-pulse",
              },
            }).addTo(mapInstanceRef.current);
            overlaysRef.current.push(pulseLayer);
          }
        });

      // ── River station markers ────────────────────────────────────────
      stations.forEach((station) => {
        const marker = L.circleMarker(station.location, {
          radius: 8,
          fillColor: riskColors[station.riskLevel],
          fillOpacity: 0.85,
          color: "#fff",
          weight: 2,
        }).addTo(mapInstanceRef.current);

        marker.bindPopup(
          createSimplePopupNode([
            [station.name, true],
            [`Level: ${station.currentLevel}m / ${station.dangerLevel}m danger`],
            [`Trend: ${station.trend}`],
            [`Updated: ${new Date(station.lastUpdated).toLocaleString()}`],
          ]),
        );

        overlaysRef.current.push(marker);
      });

      // ── Citizen report markers ───────────────────────────────────────
      reports.forEach((report) => {
        const dot = L.circleMarker(report.location, {
          radius: 5,
          fillColor: "#38bdf8",
          fillOpacity: 0.75,
          color: "#38bdf8",
          weight: 1,
        }).addTo(mapInstanceRef.current);

        dot.bindPopup(
          createSimplePopupNode([
            [report.locationName, true],
            [report.description],
            [`Trust: ${(report.trustScore * 100).toFixed(0)}%`],
          ]),
        );

        overlaysRef.current.push(dot);
      });

      // ── Satellite footprints (subtle, no longer dominant) ────────────
      satelliteProducts.forEach((product) => {
        if (!product.footprintGeoJson) return;

        const layer = L.geoJSON(product.footprintGeoJson as any, {
          style: {
            color: "#64748b",
            weight: 1,
            fillOpacity: 0,
            opacity: 0.3,
            dashArray: "3 5",
          },
        }).addTo(mapInstanceRef.current);

        layer.bindPopup(
          createSimplePopupNode([
            [product.sourceSlug, true],
            [`Product: ${product.productType}`],
            [`Observed: ${new Date(product.observedAt).toLocaleString()}`],
            [`Flood area: ${product.floodAreaKm2 ?? "n/a"} km²`],
          ]),
        );

        overlaysRef.current.push(layer);
      });

      // ── Map legend ───────────────────────────────────────────────────
      const existingLegend = document.querySelector(".risk-map-legend");
      if (!existingLegend) {
        const legendControl = new L.Control({ position: "bottomright" });
        legendControl.onAdd = () => {
          const div = L.DomUtil.create("div", "risk-map-legend");
          div.style.cssText = `
            background: rgba(15, 23, 42, 0.92);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(100, 116, 139, 0.3);
            border-radius: 8px;
            padding: 10px 14px;
            font-family: inherit;
            color: #e2e8f0;
            font-size: 11px;
            line-height: 1.6;
          `;
          div.innerHTML = `
            <div style="font-weight:700; margin-bottom:6px; font-size:12px;">Risk Levels</div>
            ${(["evacuate", "warning", "watch", "safe"] as RiskLevel[])
              .map(
                (level) => `
              <div style="display:flex; align-items:center; gap:8px; margin:3px 0;">
                <span style="
                  width:14px; height:14px; border-radius:3px;
                  background:${riskColors[level]};
                  opacity:${level === "safe" ? 0.6 : 0.85};
                  display:inline-block; flex-shrink:0;
                "></span>
                <span style="text-transform:capitalize;">${level}</span>
              </div>
            `,
              )
              .join("")}
            <div style="border-top:1px solid rgba(100,116,139,0.3); margin-top:8px; padding-top:6px;">
              <div style="display:flex; align-items:center; gap:8px; margin:2px 0;">
                <span style="width:10px; height:10px; border-radius:50%; background:#fff; border:2px solid #eab308; display:inline-block; flex-shrink:0;"></span>
                <span>River station</span>
              </div>
              <div style="display:flex; align-items:center; gap:8px; margin:2px 0;">
                <span style="width:8px; height:8px; border-radius:50%; background:#38bdf8; display:inline-block; flex-shrink:0;"></span>
                <span>Citizen report</span>
              </div>
            </div>
          `;
          return div;
        };
        legendControl.addTo(mapInstanceRef.current);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [computedZones, reports, satelliteProducts, stations]);

  return (
    <div className={`rounded-xl overflow-hidden border border-border ${className}`}>
      <style>{`
        .zone-label {
          background: transparent !important;
          border: none !important;
        }
        @keyframes evacuatePulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.9; }
        }
        .evacuate-pulse {
          animation: evacuatePulse 2s ease-in-out infinite;
        }
      `}</style>
      <div
        ref={mapRef}
        className="w-full h-full min-h-[300px] sm:min-h-[400px] md:min-h-[500px]"
        style={{ background: "hsl(220, 20%, 7%)" }}
      />
    </div>
  );
}

function createPopupNode(
  zone: {
    name: string;
    district: string;
    computedFloodProb: number;
    floodProb: number;
    landslideProb: number;
    nearestStationName?: string;
    dataQuality: string;
    population: number;
  },
  riskLevel: RiskLevel,
  color: string,
) {
  const container = document.createElement("div");
  container.style.cssText = "font-size:13px; min-width:200px;";
  container.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
      <strong style="font-size:14px;">${zone.name}</strong>
      <span style="
        background:${color}22;
        color:${color};
        font-size:10px;
        font-weight:700;
        text-transform:uppercase;
        padding:2px 8px;
        border-radius:4px;
        letter-spacing:0.5px;
      ">${riskLevel}</span>
    </div>
    <div style="color:#888; margin-bottom:6px;">${zone.district} · Pop ${zone.population.toLocaleString()}</div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px 12px; font-size:12px;">
      <div>
        <div style="color:#888; font-size:10px; text-transform:uppercase;">Flood Risk</div>
        <div style="font-weight:600;">${(zone.computedFloodProb * 100).toFixed(0)}%</div>
        <div style="height:4px; background:#1e293b; border-radius:2px; margin-top:2px;">
          <div style="height:100%; width:${zone.computedFloodProb * 100}%; background:${color}; border-radius:2px;"></div>
        </div>
      </div>
      <div>
        <div style="color:#888; font-size:10px; text-transform:uppercase;">Landslide</div>
        <div style="font-weight:600;">${(zone.landslideProb * 100).toFixed(0)}%</div>
        <div style="height:4px; background:#1e293b; border-radius:2px; margin-top:2px;">
          <div style="height:100%; width:${zone.landslideProb * 100}%; background:#f97316; border-radius:2px;"></div>
        </div>
      </div>
      <div>
        <div style="color:#888; font-size:10px; text-transform:uppercase;">Station</div>
        <div>${zone.nearestStationName ?? "n/a"}</div>
      </div>
      <div>
        <div style="color:#888; font-size:10px; text-transform:uppercase;">Data Quality</div>
        <div style="text-transform:capitalize;">${zone.dataQuality}</div>
      </div>
    </div>
  `;
  return container;
}

function createSimplePopupNode(rows: Array<[string, boolean?]>) {
  const container = document.createElement("div");
  container.style.fontSize = "13px";

  rows.forEach(([text, strong], index) => {
    const element = document.createElement(strong ? "strong" : "span");
    element.textContent = text;
    if (!strong && index === 1) element.style.color = "#888";
    container.appendChild(element);
    if (index < rows.length - 1) container.appendChild(document.createElement("br"));
  });

  return container;
}
