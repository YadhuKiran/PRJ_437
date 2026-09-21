import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { api } from '../api';
import { BentoGrid, BentoCard, Eyebrow, SkeletonGrid, ErrorCard, EmptyState } from '../components/ui';
function prettyAction(a) {
    return a.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
export default function AuditLog() {
    const [events, setEvents] = useState(null);
    const [denied, setDenied] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        let alive = true;
        api('/api/audit')
            .then((r) => { if (alive)
            setEvents(r); })
            .catch((e) => {
            if (!alive)
                return;
            if (e instanceof Error && /403|Forbidden/i.test(e.message))
                setDenied(true);
            else
                setError('Unable to load audit logs. Please try again.');
        });
        return () => { alive = false; };
    }, []);
    if (denied) {
        return (_jsxs("div", { className: "fade-in", children: [_jsx("h2", { style: { fontSize: 'var(--fs-section)', color: 'var(--navy-900)' }, children: "Audit logs" }), _jsx(BentoGrid, { children: _jsx(BentoCard, { span: "span-12", label: "Access restricted", children: _jsxs("div", { style: { display: 'flex', gap: 12, alignItems: 'flex-start' }, children: [_jsx(ShieldAlert, { color: "var(--risk-med-ink)", "aria-hidden": "true" }), _jsxs("div", { children: [_jsx("h3", { children: "Restricted to administrators" }), _jsx("p", { className: "card-sub", children: "Your role does not include audit-log access. Contact an administrator if you need it." })] })] }) }) })] }));
    }
    if (error)
        return _jsx(ErrorCard, { title: "Unable to load audit logs.", body: error, onRetry: () => window.location.reload() });
    if (!events)
        return _jsx(SkeletonGrid, { spans: ['span-12'] });
    // Group by day for a clean timeline.
    const days = new Map();
    for (const e of events) {
        const day = (e.timestamp || '').slice(0, 10) || 'Unknown date';
        if (!days.has(day))
            days.set(day, []);
        days.get(day).push(e);
    }
    return (_jsxs("div", { className: "fade-in", children: [_jsx("h2", { style: { fontSize: 'var(--fs-section)', color: 'var(--navy-900)' }, children: "Audit logs" }), _jsx("p", { className: "card-sub", children: "Sensitive victim information is never shown here \u2014 actions and metadata only." }), _jsx(BentoGrid, { children: events.length === 0 ? (_jsx(BentoCard, { span: "span-12", label: "No activity", children: _jsx(EmptyState, { title: "No audit events yet", body: "Actions taken by staff will appear here." }) })) : ([...days.entries()].map(([day, list]) => (_jsxs(BentoCard, { span: "span-12", label: `Activity on ${day}`, children: [_jsx(Eyebrow, { children: day }), _jsx("ol", { className: "timeline", children: list.map((e) => (_jsxs("li", { className: "done", children: [_jsx("span", { className: "t-dot", "aria-hidden": "true" }), _jsx("div", { className: "t-time", children: (e.timestamp || '').slice(11, 16) }), _jsx("div", { className: "t-action", children: prettyAction(e.action) }), _jsxs("div", { className: "t-sub", children: [e.actor_role || 'system', e.report_id ? ` · report #${e.report_id}` : '', detailSummary(e)] })] }, e.id))) })] }, day)))) })] }));
}
function detailSummary(e) {
    const d = e.details || {};
    const parts = [];
    if (typeof d.case_id === 'string')
        parts.push(String(d.case_id));
    if (typeof d.risk_level === 'string')
        parts.push(`risk ${d.risk_level}`);
    if (typeof d.human_override === 'string')
        parts.push(`override → ${d.human_override}`);
    return parts.length ? ` · ${parts.join(' · ')}` : '';
}
