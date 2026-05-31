import { Gauge, GitBranch, Waves } from "lucide-react";
import { hecRasCrossSections } from "@/lib/hecrasModel";

export default function HecRasModelPanel() {
  return (
    <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-secondary/10 p-5 shadow-card overflow-hidden relative">
      <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/5 blur-3xl" />

      <div className="relative">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
              <Waves className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                HEC-RAS Model Unavailable
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Calibrated hydraulic results have not been ingested for this workspace.
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-500 max-w-xl">
            <div className="flex items-start gap-2">
              <Gauge className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                This panel no longer computes synthetic routing in production. Load surveyed,
                calibrated HEC-RAS outputs before displaying operational water-surface results.
              </span>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <GitBranch className="h-4 w-4 text-primary" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Design Cross Sections Reference
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
          <p className="text-xs text-muted-foreground mt-3">
            These cross sections are retained as design metadata. They are not used to produce
            operational alerts or risk scores without calibrated model output.
          </p>
        </div>
      </div>
    </div>
  );
}
