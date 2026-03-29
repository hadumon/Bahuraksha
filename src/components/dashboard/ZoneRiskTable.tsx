import { useQuery } from "@tanstack/react-query";
import RiskLevelBadge from "./RiskLevelBadge";
import { fetchRiskZones } from "@/lib/operationalData";

export default function ZoneRiskTable() {
  const { data: zones = [] } = useQuery({
    queryKey: ["risk-zones"],
    queryFn: fetchRiskZones,
  });

  const sorted = [...zones].sort((a, b) => {
    const order = { evacuate: 0, warning: 1, watch: 2, safe: 3 } as const;
    return order[a.riskLevel] - order[b.riskLevel];
  });

  return (
    <div className="gradient-card rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Zone Risk Assessment</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
              <th className="text-left py-2 px-2">Zone</th>
              <th className="text-left py-2 px-2">Risk</th>
              <th className="text-right py-2 px-2">Flood %</th>
              <th className="text-right py-2 px-2">Landslide %</th>
              <th className="text-right py-2 px-2">Population</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((zone) => (
              <tr key={zone.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="py-2.5 px-2">
                  <p className="font-medium text-foreground">{zone.name}</p>
                  <p className="text-xs text-muted-foreground">{zone.district}</p>
                </td>
                <td className="py-2.5 px-2"><RiskLevelBadge level={zone.riskLevel} /></td>
                <td className="py-2.5 px-2 text-right font-mono text-xs">{(zone.floodProb * 100).toFixed(0)}%</td>
                <td className="py-2.5 px-2 text-right font-mono text-xs">{(zone.landslideProb * 100).toFixed(0)}%</td>
                <td className="py-2.5 px-2 text-right font-mono text-xs">{zone.population.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
