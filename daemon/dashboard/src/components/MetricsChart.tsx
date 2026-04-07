import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { TokenDataPoint, SessionSnapshot } from '../types';

interface MetricsChartProps {
  tokenHistory: TokenDataPoint[];
  sessions: SessionSnapshot[];
}

// WHY: 退化霓虹色調，模擬老舊示波器的陰極射線管色彩
const SESSION_COLORS = [
  '#1a6b6b', '#6b2a4a', '#3d6b5a', '#8b6a2a', '#cc3333',
  '#8b5e3c', '#c4956a', '#2a4a35',
];

export function MetricsChart({ tokenHistory, sessions }: MetricsChartProps) {
  const sessionIds = useMemo(() => {
    const ids = new Set<string>();
    tokenHistory.forEach(point => {
      Object.keys(point).forEach(k => {
        if (k !== 'time') ids.add(k);
      });
    });
    return Array.from(ids);
  }, [tokenHistory]);

  const recycleThreshold = useMemo(() => {
    const active = sessions.find(s => s.status === 'running');
    return active?.recycleThreshold ?? 200000;
  }, [sessions]);

  return (
    <div
      className="p-4 border rounded border-rust-dark bg-abyss/40"
      style={{ boxShadow: 'inset 0 0 30px rgba(0,0,0,0.5)' }}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs text-text-dim uppercase tracking-wider">
          Token Consumption
        </span>
        <span className="text-xs text-neon-fade-amber">
          Recycle @ {(recycleThreshold / 1000).toFixed(0)}k
        </span>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={tokenHistory} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <defs>
            {sessionIds.map((id, i) => (
              <linearGradient key={id} id={`gradient-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={SESSION_COLORS[i % SESSION_COLORS.length]} stopOpacity={0.2} />
                <stop offset="95%" stopColor={SESSION_COLORS[i % SESSION_COLORS.length]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>

          <XAxis
            dataKey="time"
            stroke="#5a5248"
            tick={{ fontSize: 10, fill: '#5a5248' }}
            tickLine={false}
            axisLine={{ stroke: '#1a1410' }}
          />
          <YAxis
            stroke="#5a5248"
            tick={{ fontSize: 10, fill: '#5a5248' }}
            tickLine={false}
            axisLine={{ stroke: '#1a1410' }}
            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
          />

          <Tooltip
            contentStyle={{
              background: '#0a0a0a',
              border: '1px solid #1a1410',
              borderRadius: 4,
              fontSize: 11,
              fontFamily: 'JetBrains Mono',
              color: '#b0a898',
            }}
            labelStyle={{ color: '#5a5248' }}
          />

          <ReferenceLine
            y={recycleThreshold}
            stroke="#8b6a2a"
            strokeDasharray="4 4"
            strokeOpacity={0.4}
          />

          {sessionIds.map((id, i) => (
            <Area
              key={id}
              type="monotone"
              dataKey={id}
              stroke={SESSION_COLORS[i % SESSION_COLORS.length]}
              strokeWidth={1.5}
              fill={`url(#gradient-${id})`}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
