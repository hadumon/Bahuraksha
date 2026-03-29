import { useEffect, useRef, useState } from 'react';
import { zoneRisks, riverStations, citizenReports, RiskLevel } from '@/data/mockData';
import 'leaflet/dist/leaflet.css';

const riskColors: Record<RiskLevel, string> = {
  safe: '#22c55e',
  watch: '#eab308',
  warning: '#f97316',
  evacuate: '#ef4444',
};

export default function RiskMap({ className = '' }: { className?: string }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    let cancelled = false;

    import('leaflet').then((L) => {
      if (cancelled || !mapRef.current) return;

      const map = L.map(mapRef.current, {
        center: [27.7172, 85.324],
        zoom: 12,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      }).addTo(map);

      // Zone risk circles
      zoneRisks.forEach((zone) => {
        const circle = L.circleMarker(zone.coordinates as [number, number], {
          radius: Math.sqrt(zone.population) / 15,
          fillColor: riskColors[zone.riskLevel],
          fillOpacity: 0.25,
          color: riskColors[zone.riskLevel],
          weight: 2,
        }).addTo(map);

        circle.bindPopup(`
          <div style="font-size:13px">
            <strong>${zone.name}</strong><br/>
            <span style="color:#888">${zone.district}</span><br/>
            Flood: ${(zone.floodProb * 100).toFixed(0)}%<br/>
            Landslide: ${(zone.landslideProb * 100).toFixed(0)}%
          </div>
        `);
      });

      // River stations
      riverStations.forEach((station) => {
        const marker = L.circleMarker(station.location as [number, number], {
          radius: 8,
          fillColor: riskColors[station.riskLevel],
          fillOpacity: 0.8,
          color: '#fff',
          weight: 2,
        }).addTo(map);

        marker.bindPopup(`
          <div style="font-size:13px">
            <strong>${station.name}</strong><br/>
            Level: ${station.currentLevel}m / ${station.dangerLevel}m danger<br/>
            Trend: ${station.trend}
          </div>
        `);
      });

      // Citizen reports
      citizenReports.forEach((report) => {
        const dot = L.circleMarker(report.location as [number, number], {
          radius: 5,
          fillColor: '#a855f7',
          fillOpacity: 0.7,
          color: '#a855f7',
          weight: 1,
        }).addTo(map);

        dot.bindPopup(`
          <div style="font-size:13px">
            <strong>${report.locationName}</strong><br/>
            <span>${report.description}</span><br/>
            Trust: ${(report.trustScore * 100).toFixed(0)}%
          </div>
        `);
      });

      mapInstanceRef.current = map;
      setReady(true);

      // Fix map size after render
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

  return (
    <div className={`rounded-xl overflow-hidden border border-border ${className}`}>
      <div
        ref={mapRef}
        className="w-full h-full min-h-[500px]"
        style={{ background: 'hsl(220, 20%, 7%)' }}
      />
    </div>
  );
}
