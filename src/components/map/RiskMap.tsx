import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchCitizenReports,
  fetchRiskZones,
  fetchRiverStations,
  fetchSatelliteProducts,
  type RiskLevel,
} from "@/lib/operationalData";
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
      setTimeout(() => map.invalidateSize(), 100);
    });

    return () => {
      cancelled = true;
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

      zones.forEach((zone) => {
        const circle = L.circleMarker(zone.coordinates, {
          radius: Math.max(8, Math.sqrt(zone.population) / 15),
          fillColor: riskColors[zone.riskLevel],
          fillOpacity: 0.25,
          color: riskColors[zone.riskLevel],
          weight: 2,
        }).addTo(mapInstanceRef.current);

        circle.bindPopup(`
          <div style="font-size:13px">
            <strong>${zone.name}</strong><br/>
            <span style="color:#888">${zone.district}</span><br/>
            Flood: ${(zone.floodProb * 100).toFixed(0)}%<br/>
            Landslide: ${(zone.landslideProb * 100).toFixed(0)}%
          </div>
        `);

        overlaysRef.current.push(circle);
      });

      stations.forEach((station) => {
        const marker = L.circleMarker(station.location, {
          radius: 8,
          fillColor: riskColors[station.riskLevel],
          fillOpacity: 0.85,
          color: "#fff",
          weight: 2,
        }).addTo(mapInstanceRef.current);

        marker.bindPopup(`
          <div style="font-size:13px">
            <strong>${station.name}</strong><br/>
            Level: ${station.currentLevel}m / ${station.dangerLevel}m danger<br/>
            Trend: ${station.trend}<br/>
            Updated: ${new Date(station.lastUpdated).toLocaleString()}
          </div>
        `);

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

        dot.bindPopup(`
          <div style="font-size:13px">
            <strong>${report.locationName}</strong><br/>
            <span>${report.description}</span><br/>
            Trust: ${(report.trustScore * 100).toFixed(0)}%
          </div>
        `);

        overlaysRef.current.push(dot);
      });

      satelliteProducts.forEach((product) => {
        if (!product.footprintGeoJson) return;

        const layer = L.geoJSON(product.footprintGeoJson as any, {
          style: {
            color: riskColors[product.riskLevel ?? "watch"],
            weight: 2,
            fillOpacity: 0.15,
          },
        }).addTo(mapInstanceRef.current);

        layer.bindPopup(`
          <div style="font-size:13px">
            <strong>${product.sourceSlug}</strong><br/>
            Product: ${product.productType}<br/>
            Observed: ${new Date(product.observedAt).toLocaleString()}<br/>
            Flood area: ${product.floodAreaKm2 ?? "n/a"} km²
          </div>
        `);

        overlaysRef.current.push(layer);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [reports, satelliteProducts, stations, zones]);

  return (
    <div className={`rounded-xl overflow-hidden border border-border ${className}`}>
      <div
        ref={mapRef}
        className="w-full h-full min-h-[500px]"
        style={{ background: "hsl(220, 20%, 7%)" }}
      />
    </div>
  );
}
