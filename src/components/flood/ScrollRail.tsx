import { useEffect, useState } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";

const sections = [
  { id: "hero", label: "Intelligence", range: [0, 0.25] as const },
  { id: "fall", label: "The Fall", range: [0.25, 0.6] as const },
  { id: "stories", label: "Stories", range: [0.6, 1] as const },
];

export function ScrollRail() {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  const [active, setActive] = useState(0);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    return scrollYProgress.on("change", (v) => {
      const idx = sections.findIndex((s) => v >= s.range[0] && v < s.range[1]);
      setActive(idx === -1 ? sections.length - 1 : idx);
      setPct(Math.round(v * 100));
    });
  }, [scrollYProgress]);

  return (
    <div className="fixed right-6 top-1/2 z-40 hidden -translate-y-1/2 md:block">
      <div className="flex flex-col items-end gap-5">
        {sections.map((s, i) => (
          <a key={s.id} href={`#${s.id}`} className="group flex items-center gap-3">
            <span
              className={`text-[10px] uppercase tracking-[0.25em] transition-all duration-300 ${
                active === i
                  ? "text-flood-safe"
                  : "text-foreground/55 group-hover:text-foreground/90"
              }`}
            >
              {s.label}
            </span>
            <span
              className={`block h-2 w-2 rounded-full transition-all ${
                active === i
                  ? "scale-150 bg-flood-safe shadow-[0_0_12px_var(--flood-safe)]"
                  : "bg-foreground/40 group-hover:bg-foreground/70"
              }`}
            />
          </a>
        ))}
      </div>
      {/* vertical progress bar */}
      <div className="absolute -right-3 top-0 h-full w-px bg-foreground/10">
        <motion.div
          className="absolute left-0 top-0 w-px origin-top bg-flood-safe"
          style={{ height: "100%", scaleY: progress }}
        />
      </div>
      {/* percentage indicator */}
      <div className="absolute -bottom-8 right-0 flex items-baseline gap-1 font-mono">
        <span className="tabular-nums text-[11px] font-semibold text-flood-safe">
          {String(pct).padStart(2, "0")}
        </span>
        <span className="text-[9px] text-foreground/50">%</span>
      </div>
    </div>
  );
}
