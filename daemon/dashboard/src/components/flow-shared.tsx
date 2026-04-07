// WHY: Shared theme constants and micro-components for flow visualization panels

export const THEME = {
  rust: '#c8603c', amber: '#c8a050', decayGreen: '#5a8a50',
  fadedRed: '#a03030', dim: '#6a6a5a', bg: '#1a1810',
  panelBg: '#12110e', border: '#2a2820',
} as const;

export const STATUS_THEME: Record<string, { color: string; label: string }> = {
  pending: { color: THEME.dim, label: 'PENDING' },
  assigned: { color: THEME.amber, label: 'ASSIGNED' },
  running: { color: THEME.amber, label: 'RUNNING' },
  verifying: { color: THEME.amber, label: 'VERIFYING' },
  completed: { color: THEME.decayGreen, label: 'COMPLETED' },
  failed: { color: THEME.fadedRed, label: 'FAILED' },
  retrying: { color: THEME.amber, label: 'RETRYING' },
  abandoned: { color: THEME.fadedRed, label: 'ABANDONED' },
};

export function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span style={{ color: THEME.dim }}>{label}</span>
      <span className="text-right truncate" style={{ color: color ?? THEME.amber }}>{value}</span>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pt-2 border-t" style={{ borderColor: THEME.border }}>
      <p className="text-[9px] uppercase tracking-wider mb-1.5" style={{ color: THEME.dim }}>{title}</p>
      {children}
    </div>
  );
}

export function FlowArrow({ color }: { color: string }) {
  return (
    <svg width="2" height="32" className="mx-auto block">
      <line x1="1" y1="0" x2="1" y2="32" stroke={color} strokeWidth={1.5}
        strokeOpacity={0.4} strokeDasharray="4 3" className="dash-flow" />
    </svg>
  );
}
