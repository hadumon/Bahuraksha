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
import "leaflet/dist/leaflet.css";

const riskColors: Record<RiskLevel, string> = {
  safe: "#22c55e",
  watch: "#eab308",
  warning: "#f97316",
  evacuate: "#ef4444",
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
  const computedZones = computeCompositeRiskZones({
    zones,
    stations,
    rainfall: normalizeRainfallForecasts(rainfallRows),
    xgboostPrediction,
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

      computedZones.forEach((zone) => {
        const riskLevel = zone.computedRiskLevel;
        let gradientStyle = "";
        
        // Create the heat-map style gradient based on risk level
        // Lowered opacities significantly so the map remains readable
        if (riskLevel === "evacuate") {
            // Intense red core -> orange -> yellow -> fade
            gradientStyle = "background: radial-gradient(circle, rgba(239,68,68,0.7) 0%, rgba(249,115,22,0.4) 35%, rgba(234,179,8,0.15) 70%, transparent 100%);";
        } else if (riskLevel === "warning") {
            // Orange core -> yellow -> fade
            gradientStyle = "background: radial-gradient(circle, rgba(249,115,22,0.6) 0%, rgba(234,179,8,0.3) 50%, transparent 100%);";
        } else if (riskLevel === "watch") {
            // Yellow core -> fade
            gradientStyle = "background: radial-gradient(circle, rgba(234,179,8,0.5) 0%, rgba(234,179,8,0.15) 60%, transparent 100%);";
        } else {
            // Green core -> fade
            gradientStyle = "background: radial-gradient(circle, rgba(34,197,94,0.4) 0%, rgba(34,197,94,0.1) 60%, transparent 100%);";
        }

        // Calculate a much smaller responsive radius based on population
        const radius = Math.max(15, Math.sqrt(zone.population) / 15);

        const customIcon = L.divIcon({
          className: "risk-zone-gradient",
          html: `<div style="
            width: ${radius * 2}px; 
            height: ${radius * 2}px; 
            border-radius: 50%; 
            ${gradientStyle}
            pointer-events: none;
            mix-blend-mode: screen;
          "></div>`,
          iconSize: [radius * 2, radius * 2],
          iconAnchor: [radius, radius],
        });

        const marker = L.marker(zone.coordinates, { icon: customIcon }).addTo(mapInstanceRef.current);

        marker.bindPopup(
          createPopupNode([
            [zone.name, true],
            [zone.district],
            [`Composite flood risk: ${(zone.computedFloodProb * 100).toFixed(0)}%`],
            [`Stored flood prior: ${(zone.floodProb * 100).toFixed(0)}%`],
            [`Nearest station: ${zone.nearestStationName ?? "n/a"}`],
            [`Data quality: ${zone.dataQuality}`],
            [`Landslide: ${(zone.landslideProb * 100).toFixed(0)}%`],
          ]),
        );

        overlaysRef.current.push(marker);
      });

      stations.forEach((station) => {
        const marker = L.circleMarker(station.location, {
          radius: 8,
          fillColor: riskColors[station.riskLevel],
          fillOpacity: 0.85,
          color: "#fff",
          weight: 2,
        }).addTo(mapInstanceRef.current);

        marker.bindPopup(
          createPopupNode([
            [station.name, true],
            [`Level: ${station.currentLevel}m / ${station.dangerLevel}m danger`],
            [`Trend: ${station.trend}`],
            [`Updated: ${new Date(station.lastUpdated).toLocaleString()}`],
          ]),
        );

        overlaysRef.current.push(marker);
      });

      reports.forEach((report) => {
        const dot = L.circleMarker(report.location, {
          radius: 5,
          fillColor: "#38bdf8",
          fillOpacity: 0.75,
          color: "#38bdf8",
          weight: 1,
        }).addTo(mapInstanceRef.current);

        dot.bindPopup(
          createPopupNode([
            [report.locationName, true],
            [report.description],
            [`Trust: ${(report.trustScore * 100).toFixed(0)}%`],
          ]),
        );

        overlaysRef.current.push(dot);
      });

      satelliteProducts.forEach((product) => {
        if (!product.footprintGeoJson) return;

        const layer = L.geoJSON(product.footprintGeoJson as any, {
          style: {
            color: riskColors[product.riskLevel ?? "watch"],
            weight: 1,
            fillOpacity: 0.05,
            dashArray: "4 4"
          },
        }).addTo(mapInstanceRef.current);

        layer.bindPopup(
          createPopupNode([
            [product.sourceSlug, true],
            [`Product: ${product.productType}`],
            [`Observed: ${new Date(product.observedAt).toLocaleString()}`],
            [`Flood area: ${product.floodAreaKm2 ?? "n/a"} km²`],
          ]),
        );

        overlaysRef.current.push(layer);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [computedZones, reports, satelliteProducts, stations]);

  return (
    <div className={`rounded-xl overflow-hidden border border-border ${className}`}>
      <div
        ref={mapRef}
        className="w-full h-full min-h-[300px] sm:min-h-[400px] md:min-h-[500px]"
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
