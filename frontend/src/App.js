import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
import { BentoGrid, BentoCard } from './components/ui';
export default function App() {
    const [mode, setMode] = useState('public');
    const [publicView, setPublicView] = useState('home');
    const [staffView, setStaffView] = useState('dashboard');
    const [submittedCase, setSubmittedCase] = useState('');
    const [openId, setOpenId] = useState(null);
    const [logged, setLogged] = useState(!!localStorage.getItem('token'));
    const [urgent, setUrgent] = useState(0);
    function goPublic(v) {
        setMode('public');
        setPublicView(v);
        window.scrollTo({ top: 0 });
    }
    function goStaff(v) {
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
    return (_jsxs(_Fragment, { children: [_jsx(TopNavigation, { mode: mode, view: mode === 'public' ? publicView : openId != null ? 'cases' : staffView, goPublic: goPublic, goStaff: goStaff, logged: logged, urgentCount: urgent, onLogout: logout }), mode === 'public' && (_jsx("div", { style: { maxWidth: 'var(--max)', margin: '0 auto', padding: '12px 20px 0', textAlign: 'right' }, children: _jsx("button", { className: "btn ghost", style: { padding: '7px 14px', fontSize: 14 }, onClick: () => setMode('staff'), children: "Staff sign in" }) })), _jsxs("main", { id: "main", className: "page", children: [mode === 'public' && (_jsxs("div", { className: "fade-in", children: [publicView === 'home' && _jsx(Landing, { go: goPublic }), publicView === 'report' && (submittedCase ? (_jsx(BentoGrid, { children: _jsxs(BentoCard, { span: "span-12", label: "Report submitted", children: [_jsx("h2", { children: "Your report is submitted." }), _jsxs("p", { children: [_jsxs("strong", { children: ["Your Case ID: ", submittedCase] }), " \u2014 keep it somewhere safe to track your report."] }), _jsxs("div", { style: { display: 'flex', gap: 10, flexWrap: 'wrap' }, children: [_jsx("button", { className: "btn", onClick: () => goPublic('track'), children: "Track my report" }), _jsx("button", { className: "btn secondary", onClick: () => { setSubmittedCase(''); }, children: "Submit another" })] })] }) })) : (_jsx(ReportWizard, { onDone: (c) => { setSubmittedCase(c); window.scrollTo({ top: 0 }); } }))), publicView === 'track' && _jsx(TrackReport, { initialCaseId: submittedCase }), publicView === 'resources' && _jsx(Resources, {})] }, publicView)), mode === 'staff' && !logged && (_jsxs("div", { style: { marginTop: 24 }, children: [_jsx(StaffLogin, { onLogin: () => { setLogged(true); setStaffView('dashboard'); } }), _jsx("p", { className: "meta", style: { textAlign: 'center', marginTop: 12 }, children: _jsx("button", { className: "btn ghost", onClick: () => setMode('public'), children: "\u2190 Back to public site" }) })] })), mode === 'staff' && logged && openId != null && (_jsx("div", { style: { marginTop: 16 }, children: _jsx(CaseDetails, { id: openId, onBack: () => setOpenId(null) }) })), mode === 'staff' && logged && openId == null && (_jsxs("div", { className: "fade-in", style: { marginTop: 16 }, children: [staffView === 'dashboard' && (_jsx(Dashboard, { onOpen: setOpenId, onViewAudit: () => setStaffView('audit'), onUrgent: setUrgent })), staffView === 'cases' && _jsx(Cases, { onOpen: setOpenId }), staffView === 'audit' && _jsx(AuditLog, {}), staffView === 'resources' && _jsx(Resources, {})] }, staffView)), _jsx("footer", { className: "foot", children: _jsx("span", { children: "SafeReport \u00B7 Secure reporting & AI-assisted prioritization \u00B7 All staff access is audit-logged" }) })] }), mode === 'public' && _jsx(QuickExit, {})] }));
}
