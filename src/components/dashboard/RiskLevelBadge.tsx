import { RiskLevel } from '@/data/mockData';

const riskConfig: Record<RiskLevel, { label: string; className: string }> = {
  safe: { label: 'SAFE', className: 'bg-risk-safe/15 text-risk-safe border-risk-safe/30' },
  watch: { label: 'WATCH', className: 'bg-risk-watch/15 text-risk-watch border-risk-watch/30' },
  warning: { label: 'WARNING', className: 'bg-risk-warning/15 text-risk-warning border-risk-warning/30' },
  evacuate: { label: 'EVACUATE', className: 'bg-risk-evacuate/15 text-risk-evacuate border-risk-evacuate/30 animate-pulse-slow' },
};

export default function RiskLevelBadge({ level, size = 'sm' }: { level: RiskLevel; size?: 'sm' | 'lg' }) {
  const config = riskConfig[level];
  return (
    <span className={`inline-flex items-center font-mono font-semibold border rounded-md
      ${config.className}
      ${size === 'lg' ? 'px-3 py-1.5 text-sm' : 'px-2 py-0.5 text-xs'}
    `}>
      {size === 'lg' && level === 'evacuate' && <span className="w-2 h-2 rounded-full bg-risk-evacuate mr-2 animate-ping" />}
      {config.label}
    </span>
  );
}
