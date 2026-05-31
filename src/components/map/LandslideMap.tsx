import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { RiskLevel } from "@/lib/operationalData";
import { fetchLatestLandslidePredictions } from "@/lib/landslidePersistence";
import "leaflet/dist/leaflet.css";

const riskColors: Record<RiskLevel, string> = {
  safe: "#22c55e",
  watch: "#eab308",
  warning: "#f97316",
  evacuate: "#ef4444",
};

export default function LandslideMap({ className = "" }: { className?: string }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const { data: predictions = [], isLoading } = useQuery({
    queryKey: ["landslide-predictions", "supabase", "ml-api"],
    queryFn: async () => {
      const rows = await fetchLatestLandslidePredictions();
      return rows.filter((row) => row.model_source === "ml-api");
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
    if (!mapInstanceRef.current) return;

    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !mapInstanceRef.current) return;

      overlaysRef.current.forEach((layer) => {
        mapInstanceRef.current.removeLayer(layer);
      });
      overlaysRef.current = [];

      predictions.forEach((pred) => {
        const color = riskColors[pred.risk_level];
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
            [pred.zone_name, true],
            [pred.district],
            [`Risk: ${pred.risk_level.toUpperCase()}`],
            [`Probability: ${(pred.probability * 100).toFixed(1)}%`],
            [`Primary driver: ${pred.primary_driver}`],
            [`Confidence: ${(pred.confidence * 100).toFixed(0)}%`],
            [`Observed: ${pred.created_at ? new Date(pred.created_at).toLocaleString() : "n/a"}`],
            ["Source: ML API"],
          ]),
        );

        overlaysRef.current.push(circle);
      });

      const legend = (L.control as any)({ position: "bottomright" });
      legend.onAdd = () => {
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
            ${predictions.length ? "ML API records" : "No live records"}
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
  }, [predictions]);

  return (
    <div className={`rounded-xl overflow-hidden border border-border ${className}`}>
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Landslide Susceptibility Map</h3>
        <div className="flex items-center gap-2">
          {isLoading && (
            <span className="text-xs text-muted-foreground">Loading predictions...</span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded ${predictions.length ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
            {predictions.length ? "ML Records" : "No Live Data"}
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
