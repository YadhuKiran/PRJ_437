import { useState } from 'react';
import TopNavigation from './components/TopNavigation';
import QuickExit from './components/QuickExit';
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
import type { PublicView, StaffView } from './types';

export default function App() {
  const [mode, setMode] = useState<'public' | 'staff'>('public');
  const [publicView, setPublicView] = useState<PublicView>('home');
  const [staffView, setStaffView] = useState<StaffView>('dashboard');
  const [submittedCase, setSubmittedCase] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [logged, setLogged] = useState(!!localStorage.getItem('token'));
  const [urgent, setUrgent] = useState(0);

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
    localStorage.clear();
    setLogged(false);
    setOpenId(null);
    setMode('public');
    setPublicView('home');
  }

  return (
    <>
      <TopNavigation
        mode={mode}
        view={mode === 'public' ? publicView : openId != null ? 'cases' : staffView}
        goPublic={goPublic}
        goStaff={goStaff}
        logged={logged}
        urgentCount={urgent}
        onLogout={logout}
      />

      {/* Staff entry point — visible from the public side without exposing the workspace */}
      {mode === 'public' && (
        <div style={{ maxWidth: 'var(--max)', margin: '0 auto', padding: '12px 20px 0', textAlign: 'right' }}>
          <button className="btn ghost" style={{ padding: '7px 14px', fontSize: 14 }} onClick={() => setMode('staff')}>
            Staff sign in
          </button>
        </div>
      )}

      <main id="main" className="page">
        {mode === 'public' && (
          <div key={publicView} className="fade-in">
            {publicView === 'home' && <Landing go={goPublic} />}
            {publicView === 'report' && (
              submittedCase ? (
                <BentoGrid>
                  <BentoCard span="span-12" label="Report submitted">
                    <h2>Your report is submitted.</h2>
                    <p><strong>Your Case ID: {submittedCase}</strong> — keep it somewhere safe to track your report.</p>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button className="btn" onClick={() => goPublic('track')}>Track my report</button>
                      <button className="btn secondary" onClick={() => { setSubmittedCase(''); }}>Submit another</button>
                    </div>
                  </BentoCard>
                </BentoGrid>
              ) : (
                <ReportWizard onDone={(c) => { setSubmittedCase(c); window.scrollTo({ top: 0 }); }} />
              )
            )}
            {publicView === 'track' && <TrackReport initialCaseId={submittedCase} />}
            {publicView === 'resources' && <Resources />}
          </div>
        )}

        {mode === 'staff' && !logged && (
          <div style={{ marginTop: 24 }}>
            <StaffLogin onLogin={() => { setLogged(true); setStaffView('dashboard'); }} />
            <p className="meta" style={{ textAlign: 'center', marginTop: 12 }}>
              <button className="btn ghost" onClick={() => setMode('public')}>← Back to public site</button>
            </p>
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

      {mode === 'public' && <QuickExit />}
    </>
  );
}
