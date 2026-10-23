import { useCallback, useEffect, useState } from 'react';
import TopNavigation from './components/TopNavigation';
import QuickExit from './components/QuickExit';
import SupportStrip from './components/SupportStrip';
import Landing from './pages/Landing';
import ReportWizard from './pages/ReportWizard';
import TrackReport from './pages/TrackReport';
import Resources from './pages/Resources';
import StaffLogin from './pages/StaffLogin';
import Dashboard from './pages/Dashboard';
import Cases from './pages/Cases';
import CaseDetails from './pages/CaseDetails';
import AuditLog from './pages/AuditLog';
import Security from './pages/Security';
import { BentoGrid, BentoCard } from './components/ui';
import { api, onUnauthorized } from './api';
import type { PublicView, Session, StaffView } from './types';

const CASE_ID_KEY = 'safereport.lastCaseId';

function readStoredCaseId(): string {
  try { return sessionStorage.getItem(CASE_ID_KEY) || ''; } catch { return ''; }
}
function storeCaseId(id: string) {
  try { id ? sessionStorage.setItem(CASE_ID_KEY, id) : sessionStorage.removeItem(CASE_ID_KEY); } catch { /* ignore */ }
}

export default function App() {
  const [mode, setMode] = useState<'public' | 'staff'>('public');
  const [publicView, setPublicView] = useState<PublicView>('home');
  const [staffView, setStaffView] = useState<StaffView>('dashboard');
  const [submittedCase, setSubmittedCase] = useState(readStoredCaseId);
  const [openId, setOpenId] = useState<number | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [urgent, setUrgent] = useState(0);
  const logged = session !== null;

  const clearSession = useCallback(() => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('username');
    } catch { /* ignore */ }
    setSession(null);
    setOpenId(null);
    setMode('public');
    setPublicView('home');
  }, []);

  // Any 401 from the API invalidates the local session.
  useEffect(() => onUnauthorized(clearSession), [clearSession]);

  // Validate a stored token against the server instead of trusting its
  // presence in localStorage (B3).
  useEffect(() => {
    let alive = true;
    const token = localStorage.getItem('token');
    if (!token) { setSession(null); return; }
    api<Session>('/api/auth/me')
      .then((s) => {
        if (!alive) return;
        setSession(s);
        try {
          localStorage.setItem('role', s.role);
          localStorage.setItem('username', s.username);
        } catch { /* ignore */ }
      })
      .catch(() => { if (alive) clearSession(); });
    return () => { alive = false; };
  }, [clearSession]);

  function goPublic(v: PublicView) {
    setMode('public');
    setPublicView(v);
    window.scrollTo({ top: 0 });
  }
  function goStaff(v: StaffView) {
    setMode('staff');
    setStaffView(v);
    setOpenId(null);
    window.scrollTo({ top: 0 });
  }
  function logout() {
    clearSession();
  }
  function onSubmitted(caseId: string) {
    setSubmittedCase(caseId);
    storeCaseId(caseId);
    window.scrollTo({ top: 0 });
  }

  const currentView = mode === 'public'
    ? publicView
    : (openId != null ? 'cases' : staffView);

  return (
    <>
      <TopNavigation
        mode={mode}
        view={currentView}
        goPublic={goPublic}
        goStaff={goStaff}
        logged={logged}
        urgentCount={urgent}
        onLogout={logout}
      />

      {/* Staff entry point — visible from the public side without exposing the workspace */}
      {mode === 'public' && (
        <div className="staff-entry">
          <button className="btn ghost" onClick={() => setMode('staff')}>
            Staff sign in
          </button>
        </div>
      )}
      {mode === 'public' && <SupportStrip />}

      <main id="main" className="page" tabIndex={-1}>
        {mode === 'public' && (
          <div key={publicView} className="fade-in">
            {publicView === 'home' && <Landing go={goPublic} />}
            {publicView === 'report' && (
              submittedCase ? (
                <BentoGrid>
                  <BentoCard span="span-12">
                    <h1 className="page-title">Report submitted</h1>
                    <p>
                      <strong>Your Case ID: {submittedCase}</strong> — keep it somewhere safe to track your report.
                    </p>
                    <div className="button-row">
                      <button className="btn" onClick={() => goPublic('track')}>Track my report</button>
                      <button className="btn secondary" onClick={() => { setSubmittedCase(''); storeCaseId(''); }}>
                        Submit another
                      </button>
                    </div>
                  </BentoCard>
                </BentoGrid>
              ) : (
                <ReportWizard onDone={onSubmitted} />
              )
            )}
            {publicView === 'track' && <TrackReport initialCaseId={submittedCase} />}
            {publicView === 'resources' && <Resources />}
          </div>
        )}

        {mode === 'staff' && !logged && (
          <div style={{ marginTop: 24 }}>
            <StaffLogin onLogin={(s) => { setSession(s); setStaffView('dashboard'); }} />
            <div className="meta" style={{ textAlign: 'center', marginTop: 12 }}>
              <button className="btn ghost" onClick={() => setMode('public')}>← Back to public site</button>
            </div>
          </div>
        )}

        {mode === 'staff' && logged && openId != null && (
          <div style={{ marginTop: 16 }}><CaseDetails id={openId} onBack={() => setOpenId(null)} /></div>
        )}

        {mode === 'staff' && logged && openId == null && (
          <div key={staffView} className="fade-in" style={{ marginTop: 16 }}>
            {staffView === 'dashboard' && (
              <Dashboard onOpen={setOpenId} onViewAudit={() => setStaffView('audit')} onUrgent={setUrgent} />
            )}
            {staffView === 'cases' && <Cases onOpen={setOpenId} />}
            {staffView === 'audit' && <AuditLog />}
            {staffView === 'security' && <Security />}
            {staffView === 'resources' && <Resources />}
          </div>
        )}

        <footer className="foot">
          <span>SafeReport · Secure reporting &amp; AI-assisted prioritization · All staff access is audit-logged</span>
        </footer>
      </main>

      {/* The quick exit is always available — staff can also be viewing
          survivor disclosures and may need to leave immediately. */}
      <QuickExit />
    </>
  );
}
