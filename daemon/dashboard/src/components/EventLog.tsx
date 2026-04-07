import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DaemonEvent } from '../types';
import { EVENT_CATEGORY_COLORS, getEventCategory } from '../types';

interface EventLogProps {
  events: DaemonEvent[];
}

const MAX_VISIBLE = 100;

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '??:??:??';
  }
}

function formatPayload(payload: Record<string, unknown>): string {
  const entries = Object.entries(payload);
  if (entries.length === 0) return '';

  return entries
    .filter(([, v]) => typeof v !== 'object')
    .map(([k, v]) => `${k}=${v}`)
    .slice(0, 4)
    .join(' ');
}

function EventRow({ event }: { event: DaemonEvent }) {
  const category = getEventCategory(event.type);
  const color = EVENT_CATEGORY_COLORS[category] ?? '#5a5248';

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="flex items-start gap-3 py-1 px-2 hover:bg-rust-dark/30 rounded text-[11px] leading-relaxed"
    >
      <span className="text-neon-fade-amber shrink-0 w-16">
        {formatTimestamp(event.timestamp)}
      </span>
      <span
        className="shrink-0 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold w-20 text-center"
        style={{ color, backgroundColor: color + '15', border: `1px solid ${color}30` }}
      >
        {category}
      </span>
      <span className="text-text-dim shrink-0 w-36 truncate" title={event.type}>
        {event.type}
      </span>
      <span className="text-decay-green truncate">
        {formatPayload(event.payload)}
      </span>
    </motion.div>
  );
}

export function EventLog({ events }: EventLogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isAtTopRef = useRef(true);

  useEffect(() => {
    if (isAtTopRef.current && containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [events]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    isAtTopRef.current = containerRef.current.scrollTop < 10;
  };

  const visibleEvents = events.slice(0, MAX_VISIBLE);

  return (
    <div
      className="p-4 border rounded border-rust-dark bg-void/80"
      style={{ boxShadow: 'inset 0 0 30px rgba(0,0,0,0.5)' }}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs text-text-dim uppercase tracking-wider">
          Event Log
        </span>
        <span className="text-xs text-text-dim">{events.length} events</span>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-64 overflow-y-auto font-mono"
      >
        <AnimatePresence initial={false}>
          {visibleEvents.map(event => (
            <EventRow key={event.id} event={event} />
          ))}
        </AnimatePresence>

        {events.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <span className="text-text-dim text-xs">Waiting for events...</span>
          </div>
        )}
      </div>
    </div>
  );
}
