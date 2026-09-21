import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { api } from '../api';
import { BentoGrid, BentoCard, Eyebrow, RiskBadge, StatusBadge, SkeletonGrid, ErrorCard } from '../components/ui';
import AiRiskCard, { yn } from '../components/AiRiskCard';
export default function CaseDetails({ id, onBack }) {
    const [rep, setRep] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [error, setError] = useState('');
    useEffect(() => {
        let alive = true;
        api(`/api/reports/${id}`)
            .then((r) => { if (alive)
            setRep(r); })
            .catch(() => { if (alive)
            setError('Unable to load this case. Please try again.'); });
        api(`/api/reports/${id}/ai-analysis`)
            .then((r) => { if (alive)
            setAnalysis(r); })
            .catch(() => { if (alive)
            setAnalysis(null); });
        return () => { alive = false; };
    }, [id]);
    if (error) {
        return (_jsxs("div", { className: "fade-in", children: [_jsxs("button", { className: "btn ghost", onClick: onBack, style: { marginBottom: 12 }, children: [_jsx(ArrowLeft, { size: 16, "aria-hidden": "true" }), " Cases"] }), _jsx(ErrorCard, { title: "Unable to load this case.", body: error, onRetry: () => window.location.reload() })] }));
    }
    if (!rep)
        return _jsx(SkeletonGrid, { spans: ['span-12', 'span-7', 'span-5'] });
    const a = analysis;
    const groups = a ? [
        {
            title: 'Abuse Types',
            rows: (a.abuse_types || []).map((t) => [t, 'Identified']),
        },
        {
            title: 'Threat Indicators',
            rows: [
                ['Threat', yn(a.threat_detected)], ['Weapon', yn(a.weapon_mentioned)],
                ['Immediate danger', yn(a.immediate_danger)],
            ],
        },
        {
            title: 'Behavioral Indicators',
            rows: [
                ['Repeated pattern', yn(a.recurring_incident)], ['Stalking', yn(a.stalking_detected)],
                ...(a.key_indicators || []).map((k) => [k, 'Flagged']),
            ],
        },
    ] : [];
    return (_jsxs("div", { className: "fade-in", children: [_jsxs("button", { className: "btn ghost", onClick: onBack, style: { marginBottom: 12 }, children: [_jsx(ArrowLeft, { size: 16, "aria-hidden": "true" }), " Cases"] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }, children: [_jsxs("h2", { style: { fontSize: 'var(--fs-section)', color: 'var(--navy-900)', margin: 0 }, children: ["CASE ", rep.case_id] }), a && _jsx(RiskBadge, { level: a.risk_level, score: a.risk_score }), _jsx(StatusBadge, { status: rep.status })] }), _jsxs("p", { className: "card-sub", children: ["Reported ", rep.created_at?.slice(0, 10), " \u00B7 ", rep.reporter_type.replace('_', ' '), rep.location ? ` · ${rep.location}` : ''] }), _jsxs(BentoGrid, { children: [_jsx(AiRiskCard, { reportId: id }), _jsxs(BentoCard, { span: "span-7", label: "Incident overview", children: [_jsx(Eyebrow, { children: "Incident Overview" }), _jsx("p", { style: { whiteSpace: 'pre-wrap' }, children: rep.description }), _jsxs("div", { className: "mini-grid", children: [_jsxs("div", { className: "mini", children: [_jsx(Eyebrow, { children: "Reporter" }), _jsx("strong", { children: rep.reporter_type.replace('_', ' ') })] }), _jsxs("div", { className: "mini", children: [_jsx(Eyebrow, { children: "Location" }), _jsx("strong", { children: rep.location || 'Not provided' })] }), _jsxs("div", { className: "mini", children: [_jsx(Eyebrow, { children: "Incident date" }), _jsx("strong", { children: rep.incident_date || 'Not provided' })] }), _jsxs("div", { className: "mini", children: [_jsx(Eyebrow, { children: "Contact" }), _jsx("strong", { children: rep.contact || 'Not provided' })] })] })] }), a ? (_jsxs(BentoCard, { span: "span-12", label: "AI incident analysis", children: [_jsx(Eyebrow, { children: "AI Incident Analysis" }), _jsx("div", { className: "mini-grid", style: { gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }, children: groups.map((g) => (_jsxs("div", { className: "mini", children: [_jsx(Eyebrow, { children: g.title }), g.rows.length === 0 ? (_jsx("span", { className: "card-sub", children: "Not mentioned" })) : (_jsx("ul", { style: { margin: 0, paddingLeft: 18 }, children: g.rows.map(([k, v]) => (_jsxs("li", { style: { marginBottom: 4 }, children: [_jsx("strong", { style: { textTransform: 'capitalize' }, children: k }), _jsxs("span", { className: "card-sub", children: [" \u2014 ", v] })] }, k))) }))] }, g.title))) }), _jsx("h3", { className: "card-title", style: { marginTop: 16 }, children: "AI Summary" }), _jsxs("p", { style: { marginBottom: 0 }, children: ["\u201C", a.ai_summary, "\u201D"] })] })) : (_jsxs(BentoCard, { span: "span-12", label: "AI incident analysis", children: [_jsx(Eyebrow, { children: "AI Incident Analysis" }), _jsx("p", { className: "card-sub", children: "Generate the AI analysis to see the structured breakdown of this report." })] }))] })] }));
}
