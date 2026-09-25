import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api } from '../api';
import { BentoGrid, BentoCard, Eyebrow, StatCard, RiskBadge, SecurityLine, SkeletonGrid, ErrorCard, EmptyState, ScoreBar, } from '../components/ui';
function greeting() {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}
export default function Dashboard({ onOpen, onViewAudit, onUrgent }) {
    const [items, setItems] = useState(null);
    const [events, setEvents] = useState(null);
    const [error, setError] = useState('');
    const role = localStorage.getItem('role') || '';
    const username = localStorage.getItem('username') || '';
    useEffect(() => {
        let alive = true;
        api('/api/reports')
            .then((r) => { if (alive)
            setItems(r); })
            .catch(() => { if (alive)
            setError('Unable to load cases. Please try again.'); });
        if (role === 'admin') {
            api('/api/audit').then((r) => { if (alive)
                setEvents(r.slice(0, 6)); }).catch(() => { if (alive)
                setEvents([]); });
        }
        return () => { alive = false; };
    }, [role]);
    useEffect(() => {
        if (items)
            onUrgent(items.filter((r) => r.risk_level === 'HIGH' && r.status !== 'closed').length);
    }, [items, onUrgent]);
    if (error)
        return _jsx(ErrorCard, { title: "Unable to load the dashboard.", body: error, onRetry: () => window.location.reload() });
    if (!items)
        return _jsx(SkeletonGrid, {});
    const total = items.length;
    const fresh = items.filter((r) => r.status === 'new').length;
    const high = items.filter((r) => r.risk_level === 'HIGH').length;
    const urgent = items.filter((r) => r.risk_level === 'HIGH' && r.status !== 'closed');
    const dist = ['HIGH', 'MEDIUM', 'LOW'].map((l) => ({
        level: l, n: items.filter((r) => r.risk_level === l).length,
    }));
    const unassessed = items.filter((r) => !r.risk_level).length;
    const priority = [...items].slice(0, 4);
    return (_jsxs("div", { className: "fade-in", children: [_jsxs("h2", { style: { fontSize: 'var(--fs-section)', color: 'var(--navy-900)' }, children: [greeting(), ", ", username || 'Case Handler'] }), _jsx("p", { className: "card-sub", children: "Here\u2019s what needs your attention today." }), _jsxs(BentoGrid, { children: [_jsx(StatCard, { label: "Total cases", value: total, sub: `${fresh} new` }), _jsx(StatCard, { label: "New cases", value: fresh, sub: "Awaiting triage" }), _jsx(StatCard, { label: "High risk", value: high, sub: "AI-assessed HIGH" }), _jsx(StatCard, { label: "Urgent review", value: urgent.length, sub: "High risk, still open" }), _jsxs(BentoCard, { span: "span-7", label: "Priority cases", children: [_jsx(Eyebrow, { children: "Priority Cases" }), priority.length === 0 ? (_jsx(EmptyState, { title: "No priority cases", body: "Everything requiring immediate attention has been reviewed." })) : (_jsx("div", { style: { display: 'grid', gap: 12 }, children: priority.map((r) => (_jsxs("div", { role: "button", tabIndex: 0, className: "card clickable", style: { padding: '14px 16px', margin: 0 }, onClick: () => onOpen(r.id), onKeyDown: (e) => { if (e.key === 'Enter')
                                        onOpen(r.id); }, "aria-label": `Open case ${r.case_id}`, children: [_jsxs("div", { className: "case-card-top", children: [_jsx("span", { className: "case-id", children: r.case_id }), _jsx(RiskBadge, { level: r.risk_level, score: r.risk_score })] }), _jsx("div", { className: "score-row", children: _jsx(ScoreBar, { score: r.risk_score, level: r.risk_level }) }), _jsxs("div", { className: "meta", style: { marginTop: 6 }, children: [r.status.replace(/_/g, ' '), " \u00B7 ", r.created_at?.slice(0, 10)] })] }, r.id))) }))] }), _jsxs(BentoCard, { span: "span-5", label: "AI risk distribution", children: [_jsx(Eyebrow, { children: "AI Risk Distribution" }), dist.map((d) => {
                                const pct = total ? Math.round((d.n / total) * 100) : 0;
                                return (_jsxs("div", { className: "dist-row", children: [_jsx("span", { children: _jsx(RiskBadge, { level: d.level }) }), _jsx(ScoreBar, { score: pct, level: d.level }), _jsx("strong", { children: d.n })] }, d.level));
                            }), _jsxs("p", { className: "meta", children: [unassessed, " case", unassessed === 1 ? '' : 's', " awaiting AI assessment."] })] }), _jsxs(BentoCard, { span: "span-6", label: "Recent activity", children: [_jsx(Eyebrow, { children: "Recent Activity" }), role !== 'admin' ? (_jsx("p", { className: "card-sub", children: "Full activity history is available to administrators. Latest cases appear in Priority Cases." })) : !events ? (_jsx("p", { className: "card-sub", children: "Loading activity\u2026" })) : events.length === 0 ? (_jsx("p", { className: "card-sub", children: "No recent activity." })) : (_jsx("ol", { className: "timeline", children: events.map((e) => (_jsxs("li", { className: "done", children: [_jsx("span", { className: "t-dot", "aria-hidden": "true" }), _jsxs("div", { className: "t-time", children: [e.timestamp?.slice(11, 16), " \u00B7 ", e.timestamp?.slice(0, 10)] }), _jsx("div", { className: "t-action", children: prettyAction(e.action) }), _jsxs("div", { className: "t-sub", children: [e.actor_role || 'system', e.report_id ? ` · report #${e.report_id}` : ''] })] }, e.id))) })), role === 'admin' && (_jsx("button", { className: "btn ghost", onClick: onViewAudit, style: { marginTop: 8 }, children: "View all audit logs" }))] }), _jsxs(BentoCard, { span: "span-6", label: "System security", children: [_jsx(Eyebrow, { children: "System Security" }), _jsxs("div", { style: { display: 'grid', gap: 10 }, children: [_jsx(SecurityLine, { text: "Encrypted communication (JWT-secured API)" }), _jsx(SecurityLine, { text: "Role-based access control active" }), _jsx(SecurityLine, { text: "Audit logging enabled" }), _jsx(SecurityLine, { text: "Victim narratives excluded from logs" })] })] })] })] }));
}
function prettyAction(a) {
    return a.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
