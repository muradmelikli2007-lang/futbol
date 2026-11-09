import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Icon } from './ui';
import { useApp } from '../state/app';

const NAV = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/players', label: 'Players', icon: 'players' },
  { to: '/matches', label: 'Matches', icon: 'matches' },
  { to: '/rankings', label: 'Rankings', icon: 'rankings' },
  { to: '/statistics', label: 'Statistics', icon: 'statistics' },
  { to: '/seasons', label: 'Seasons', icon: 'seasons' },
  { to: '/compare', label: 'Player comparison', icon: 'compare' },
];

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="9" y="14" width="46" height="36" rx="4" fill="none" stroke="var(--accent)" strokeWidth="3.5" />
      <line x1="32" y1="14" x2="32" y2="50" stroke="var(--accent)" strokeWidth="3.5" />
      <circle cx="32" cy="32" r="7" fill="none" stroke="var(--accent)" strokeWidth="3.5" />
    </svg>
  );
}

function ScopePicker({ id }: { id: string }) {
  const { seasons, seasonKey, setSeasonKey } = useApp();
  return (
    <div className="scope-picker">
      <label htmlFor={id}>Showing statistics for</label>
      <select id={id} className="select" value={seasonKey} onChange={(e) => setSeasonKey(e.target.value)} aria-label="Season">
        <option value="all">All time</option>
        {seasons.map((s) => (
          <option key={s.id} value={String(s.id)}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="app">
      <header className="topbar">
        <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}>
          <Icon name="menu" size={24} />
        </button>
        <div className="brand">
          <BrandMark />
          Sixes
        </div>
        <ScopePicker id="scope-mobile" />
      </header>

      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Main navigation">
        <div className="brand">
          <BrandMark />
          <span>
            Sixes
            <small>6 vs 6 football stats</small>
          </span>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : undefined)}>
              <Icon name={n.icon} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <ScopePicker id="scope-desktop" />
        </div>
      </aside>

      <main className="main">
        <div className="main-inner">{children}</div>
      </main>
    </div>
  );
}
