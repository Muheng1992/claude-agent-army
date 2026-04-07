import { useState, useEffect } from 'react';

export function formatElapsed(startIso: string, endIso?: string | null): string {
  const startMs = new Date(startIso).getTime();
  const endMs = endIso ? new Date(endIso).getTime() : Date.now();
  const totalSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}

// WHY: running missions need live ticking; completed/failed ones show a fixed value
export function useElapsedTime(startIso: string, endIso?: string | null): string {
  const [elapsed, setElapsed] = useState(() => formatElapsed(startIso, endIso));

  useEffect(() => {
    // No ticking needed once the mission has ended
    if (endIso) {
      setElapsed(formatElapsed(startIso, endIso));
      return;
    }

    const id = setInterval(() => {
      setElapsed(formatElapsed(startIso, null));
    }, 1000);

    return () => clearInterval(id);
  }, [startIso, endIso]);

  return elapsed;
}
