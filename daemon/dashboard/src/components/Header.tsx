import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';

interface HeaderProps {
  missionId?: string;
  isConnected?: boolean;
}

const NAV_ITEMS = [
  { to: '/', label: 'MISSIONS' },
] as const;

export function Header({ missionId, isConnected }: HeaderProps) {
  const location = useLocation();

  return (
    <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-rust-dark bg-abyss/80 scanlines">
      <div className="flex items-center gap-6">
        <Link to="/" className="no-underline">
          <h1 className="text-xl font-bold tracking-widest text-flicker-cyan glitch-text m-0">
            DAEMON ORCHESTRATOR
          </h1>
        </Link>

        {isConnected !== undefined && (
          <div className={clsx(
            'w-2 h-2 rounded-full',
            isConnected ? 'bg-patina-verdigris pulse-glow' : 'bg-flicker-red'
          )} style={{ color: isConnected ? '#3d6b5a' : '#cc3333' }} />
        )}

        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={clsx(
                  'px-3 py-1.5 text-[10px] uppercase tracking-wider rounded no-underline transition-colors',
                  isActive
                    ? 'text-patina-gold bg-rust-dark border border-rust-mid'
                    : 'text-text-dim hover:text-text-primary hover:bg-rust-dark/50'
                )}
              >
                {item.label}
              </Link>
            );
          })}
          {missionId && (
            <Link
              to={`/mission/${missionId}`}
              className={clsx(
                'px-3 py-1.5 text-[10px] uppercase tracking-wider rounded no-underline transition-colors',
                location.pathname.includes(missionId)
                  ? 'text-patina-gold bg-rust-dark border border-rust-mid'
                  : 'text-text-dim hover:text-text-primary hover:bg-rust-dark/50'
              )}
            >
              ACTIVE
            </Link>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        {missionId && (
          <span className="px-3 py-1 text-xs border rounded border-rust-dark bg-abyss text-text-dim">
            MISSION: <span className="text-neon-fade-cyan">{missionId.slice(0, 16)}</span>
          </span>
        )}
        <span className="text-[10px] text-text-dim">v0.3</span>
      </div>
    </header>
  );
}
