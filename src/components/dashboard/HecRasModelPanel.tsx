import { useQuery } from "@tanstack/react-query";
import { Gauge, GitBranch, Waves, MapPin, ArrowUp, ArrowDown } from "lucide-react";
import { hecRasCrossSections, fetchSyntheticRoutingResults } from "@/lib/hecrasModel";
import type { HecRasStationResult } from "@/lib/hecrasModel";

function riskDot(level: string) {
  const colors: Record<string, string> = {
    safe: "bg-green-500",
    watch: "bg-yellow-500",
    warning: "bg-orange-500",
    evacuate: "bg-red-500",
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[level] ?? "bg-gray-500"}`} />;
}

export default function HecRasModelPanel() {
  const { data: routingResults, isLoading } = useQuery({
    queryKey: ["hec-ras-routing", "panel"],
    queryFn: fetchSyntheticRoutingResults,
    staleTime: 1000 * 60 * 15,
    retry: 1,
  });

  return (
    <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-secondary/10 p-5 shadow-card overflow-hidden relative">
      <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/5 blur-3xl" />

      <div className="relative">
        <div className="flex items-start gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
            <Waves className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              HEC-RAS Synthetic Routing
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Simplified Manning's equation — Q = (1/n)·A·R<sup>2/3</sup>·S<sup>1/2</sup>
            </p>
          </div>
        </div>

        {isLoading && (
          <p className="text-sm text-muted-foreground py-4">Computing routing...</p>
        )}

        {routingResults && routingResults.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Gauge className="h-4 w-4 text-primary" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Live Results
              </h4>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border/70">
              <table className="w-full text-xs">
                <thead className="bg-secondary/50 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Station</th>
                    <th className="px-3 py-2 text-right font-medium">Flow</th>
                    <th className="px-3 py-2 text-right font-medium">Depth</th>
                    <th className="px-3 py-2 text-right font-medium">Velocity</th>
                    <th className="px-3 py-2 text-right font-medium">WS Elev</th>
                    <th className="px-3 py-2 text-center font-medium">Risk</th>
                    <th className="px-3 py-2 text-right font-medium">Arrival</th>
                  </tr>
                </thead>
                <tbody>
                  {routingResults.map((result: HecRasStationResult) => (
                    <tr key={result.stationId} className="border-t border-border/60 hover:bg-secondary/30 transition-colors">
                      <td className="px-3 py-2 text-foreground font-medium">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {result.stationName.replace(" Station", "")}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {result.flowCms} m³/s
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {result.depthM.toFixed(2)} m
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {result.velocityMs.toFixed(2)} m/s
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {result.waterSurfaceM.toFixed(2)} m
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {riskDot(result.riskLevel)}
                          <span className="capitalize text-xs font-medium">{result.riskLevel}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {result.arrivalTimeHours > 0
                          ? `${result.arrivalTimeHours.toFixed(1)}h`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center gap-2 mb-3">
            <GitBranch className="h-4 w-4 text-primary" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Cross Sections
            </h4>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border/70">
            <table className="w-full text-xs">
              <thead className="bg-secondary/50 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Section</th>
                  <th className="px-3 py-2 text-right font-medium">km</th>
                  <th className="px-3 py-2 text-right font-medium">Width</th>
                  <th className="px-3 py-2 text-right font-medium">n channel</th>
                </tr>
              </thead>
              <tbody>
                {hecRasCrossSections.map((section) => (
                  <tr key={section.id} className="border-t border-border/60 hover:bg-secondary/30 transition-colors">
                    <td className="px-3 py-2 text-foreground">{section.stationName}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {section.riverKm.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {section.bankfullWidthM} m
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {section.channelN.toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><ArrowUp className="h-3 w-3" /> Rational Q = C·I·A/3.6</span>
            <span className="flex items-center gap-1"><ArrowDown className="h-3 w-3" /> Manning's n from land cover</span>
          </div>
        </div>
      </div>
    </div>
  );
}
