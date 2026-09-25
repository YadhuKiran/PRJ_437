import { useState } from 'react';
import { ShieldCheck, Bell, Menu, X, LogOut } from 'lucide-react';
import type { PublicView, StaffView } from '../types';

type View = PublicView | StaffView;

export default function TopNavigation({
  mode, view, goPublic, goStaff, logged, urgentCount, onLogout,
}: {
  mode: 'public' | 'staff';
  view: View;
  goPublic: (v: PublicView) => void;
  goStaff: (v: StaffView) => void;
  logged: boolean;
  urgentCount: number;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const username = localStorage.getItem('username') || '';
  const role = (localStorage.getItem('role') || '').replace('_', ' ');

  function nav(v: View) {
    setOpen(false);
    if (mode === 'public') goPublic(v as PublicView);
    else goStaff(v as StaffView);
  }

  const staffLinks: StaffView[] = ['dashboard', 'cases', 'audit', 'security', 'resources'];
  const labels: Record<View, string> = {
    home: 'Home', report: 'Report', track: 'Track report', resources: 'Resources',
    dashboard: 'Dashboard', cases: 'Cases', audit: 'Audit logs', security: 'Security & AI',
  };

  return (
    <header className="topbar">
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="topbar-inner">
        <button className="brand" onClick={() => nav(mode === 'public' ? 'home' : 'dashboard')} aria-label="SafeReport home">
          <span className="brand-mark"><ShieldCheck size={20} aria-hidden="true" /></span>
          SafeReport
        </button>

        {mode === 'public' ? (
          <nav className={`nav-links ${open ? 'open' : ''}`} aria-label="Primary">
            {(['home', 'report', 'track', 'resources'] as PublicView[]).map((v) => (
              <button key={v} onClick={() => nav(v)} aria-current={view === v ? 'page' : undefined}>
                {labels[v]}
              </button>
            ))}
          </nav>
        ) : logged ? (
          <nav className={`nav-links ${open ? 'open' : ''}`} aria-label="Staff">
            {staffLinks.map((v) => (
              <button key={v} onClick={() => nav(v)} aria-current={view === v ? 'page' : undefined}>
                {labels[v]}
              </button>
            ))}
          </nav>
        ) : <span />}

        <div className="topbar-right">
          {mode === 'staff' && logged && (
            <button
              className="notif" aria-label={`${urgentCount} high-risk cases need review`}
              onClick={() => nav('cases')} title="High-risk cases needing review"
            >
              <Bell size={17} aria-hidden="true" />
              {urgentCount > 0 && <span className="notif-badge">{urgentCount}</span>}
            </button>
          )}
          {mode === 'staff' && logged && (
            <span className="profile-chip" title={role}>
              <span className="profile-dot" aria-hidden="true">{username.slice(0, 1).toUpperCase()}</span>
              <span className="uname">{username} · {role}</span>
              <button className="btn ghost" style={{ padding: '6px 10px' }} onClick={onLogout} aria-label="Log out">
                <LogOut size={15} aria-hidden="true" />
              </button>
            </span>
          )}
          <button
            className="btn ghost menu-btn" style={{ padding: '8px 10px' }}
            onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Toggle menu"
          >
            {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}
