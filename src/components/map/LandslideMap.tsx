import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { predictBatchLandslideRisk, checkApiHealth, type LandslideZoneInput } from "@/lib/landslideModel";
import type { RiskLevel } from "@/lib/operationalData";
import "leaflet/dist/leaflet.css";

const riskColors: Record<RiskLevel, string> = {
  safe: "#22c55e",
  watch: "#eab308",
  warning: "#f97316",
  evacuate: "#ef4444",
};

const NEPAL_LANDSLIDE_ZONES: LandslideZoneInput[] = [
  { id: "1", name: "Sindhupalchok", district: "Sindhupalchok", coordinates: [27.78, 85.85], slopeAngleDeg: 42, soilMoisturePct: 88, rainfall7DayMm: 320, rainfallTodayMm: 65, seismicActivityMg: 0.015, vegetationCoverPct: 25, elevationM: 1800, distanceToRoadKm: 0.3 },
  { id: "2", name: "Rasuwa", district: "Rasuwa", coordinates: [28.15, 85.35], slopeAngleDeg: 38, soilMoisturePct: 75, rainfall7DayMm: 210, rainfallTodayMm: 35, seismicActivityMg: 0.008, vegetationCoverPct: 45, elevationM: 2200, distanceToRoadKm: 0.8 },
  { id: "3", name: "Dolakha", district: "Dolakha", coordinates: [27.67, 86.18], slopeAngleDeg: 28, soilMoisturePct: 55, rainfall7DayMm: 120, rainfallTodayMm: 15, seismicActivityMg: 0.003, vegetationCoverPct: 65, elevationM: 1400, distanceToRoadKm: 2.5 },
  { id: "4", name: "Gorkha", district: "Gorkha", coordinates: [28.00, 84.63], slopeAngleDeg: 35, soilMoisturePct: 70, rainfall7DayMm: 180, rainfallTodayMm: 25, seismicActivityMg: 0.005, vegetationCoverPct: 50, elevationM: 1600, distanceToRoadKm: 1.2 },
  { id: "5", name: "Kaski", district: "Kaski", coordinates: [28.24, 83.98], slopeAngleDeg: 32, soilMoisturePct: 60, rainfall7DayMm: 150, rainfallTodayMm: 20, seismicActivityMg: 0.002, vegetationCoverPct: 55, elevationM: 1200, distanceToRoadKm: 1.8 },
  { id: "6", name: "Lamjung", district: "Lamjung", coordinates: [28.22, 84.38], slopeAngleDeg: 40, soilMoisturePct: 80, rainfall7DayMm: 250, rainfallTodayMm: 45, seismicActivityMg: 0.01, vegetationCoverPct: 35, elevationM: 1800, distanceToRoadKm: 0.6 },
  { id: "7", name: "Myagdi", district: "Myagdi", coordinates: [28.42, 83.55], slopeAngleDeg: 45, soilMoisturePct: 65, rainfall7DayMm: 160, rainfallTodayMm: 18, seismicActivityMg: 0.004, vegetationCoverPct: 40, elevationM: 2000, distanceToRoadKm: 1.5 },
  { id: "8", name: "Baglung", district: "Baglung", coordinates: [28.27, 83.60], slopeAngleDeg: 38, soilMoisturePct: 72, rainfall7DayMm: 200, rainfallTodayMm: 30, seismicActivityMg: 0.006, vegetationCoverPct: 48, elevationM: 1500, distanceToRoadKm: 0.9 },
];

export type LandslidePredictionResult = {
  id: string;
  name: string;
  district: string;
  coordinates: [number, number];
  probability: number;
  riskLevel: RiskLevel;
  primaryDriver: string;
  confidence: number;
};

export default function LandslideMap({ className = "" }: { className?: string }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const { data: apiAvailable = false } = useQuery({
    queryKey: ["landslide-api-health"],
    queryFn: checkApiHealth,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const { data: predictions = [], isLoading } = useQuery({
    queryKey: ["landslide-predictions", apiAvailable],
    queryFn: async () => {
      const results = await predictBatchLandslideRisk(NEPAL_LANDSLIDE_ZONES);
      return results.map((r, i) => ({
        id: r.id,
        name: r.name,
        district: r.district,
        coordinates: NEPAL_LANDSLIDE_ZONES[i].coordinates,
        probability: r.probability,
        riskLevel: r.riskLevel,
        primaryDriver: r.primaryDriver,
        confidence: r.confidence,
      })) as LandslidePredictionResult[];
    },
    staleTime: 1000 * 60 * 10,
  });

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !mapRef.current) return;

      const map = L.map(mapRef.current, {
        center: [27.8, 84.5],
        zoom: 8,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      }).addTo(map);

      L.control.scale({ imperial: false }).addTo(map);

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
    if (!mapInstanceRef.current || !predictions.length) return;

    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !mapInstanceRef.current) return;

      overlaysRef.current.forEach((layer) => {
        mapInstanceRef.current.removeLayer(layer);
      });
      overlaysRef.current = [];

      predictions.forEach((pred) => {
        const color = riskColors[pred.riskLevel];
        const radius = Math.max(12, pred.probability * 40);

        const circle = L.circleMarker(pred.coordinates, {
          radius,
          fillColor: color,
          fillOpacity: 0.7,
          color: "#fff",
          weight: 2,
        }).addTo(mapInstanceRef.current);

        circle.bindPopup(
          createPopupNode([
            [pred.name, true],
            [pred.district],
            [`Risk: ${pred.riskLevel.toUpperCase()}`],
            [`Probability: ${(pred.probability * 100).toFixed(1)}%`],
            [`Primary driver: ${pred.primaryDriver}`],
            [`Confidence: ${(pred.confidence * 100).toFixed(0)}%`],
            [`Model: ${apiAvailable ? "XGBoost ML" : "Heuristic fallback"}`],
          ]),
        );

        overlaysRef.current.push(circle);
      });

      const legend = (L.control as any)({ position: "bottomright" });
      legend.onAdd = (map: any) => {
        const div = L.DomUtil.create("div", "leaflet-control-legend");
        div.style.background = "rgba(15, 23, 42, 0.9)";
        div.style.padding = "10px";
        div.style.borderRadius = "8px";
        div.style.fontSize = "12px";
        div.style.color = "#f8fafc";
        div.innerHTML = `
          <div style="font-weight: bold; margin-bottom: 6px;">Landslide Risk</div>
          ${(["evacuate", "warning", "watch", "safe"] as RiskLevel[]).map((level) => `
            <div style="display: flex; align-items: center; gap: 6px; margin: 3px 0;">
              <div style="width: 12px; height: 12px; border-radius: 50%; background: ${riskColors[level]};"></div>
              <span>${level.charAt(0).toUpperCase() + level.slice(1)}</span>
            </div>
          `).join("")}
          <div style="margin-top: 6px; font-size: 10px; color: #94a3b8;">
            ${apiAvailable ? "● Live ML model" : "○ Heuristic fallback"}
          </div>
        `;
        return div;
      };
      legend.addTo(mapInstanceRef.current);
      overlaysRef.current.push(legend);
    });

    return () => {
      cancelled = true;
    };
  }, [predictions, apiAvailable]);

  return (
    <div className={`rounded-xl overflow-hidden border border-border ${className}`}>
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Landslide Susceptibility Map</h3>
        <div className="flex items-center gap-2">
          {isLoading && (
            <span className="text-xs text-muted-foreground">Loading predictions...</span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded ${apiAvailable ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
            {apiAvailable ? "ML Model" : "Fallback"}
          </span>
        </div>
      </div>
      <div
        ref={mapRef}
        className="w-full h-full min-h-75 sm:min-h-100 md:min-h-125"
        style={{ background: "hsl(220, 20%, 7%)" }}
      />
    </div>
  );
}

function createPopupNode(rows: Array<[string, boolean?]>) {
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
