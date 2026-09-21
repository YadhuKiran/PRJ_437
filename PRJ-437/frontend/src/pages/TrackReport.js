import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../api';
import { BentoGrid, BentoCard, Eyebrow, StatusBadge } from '../components/ui';
const STAGE_ORDER = ['new', 'under_review', 'closed'];
const STAGE_LABEL = {
    new: 'Submitted', under_review: 'Under Review', closed: 'Resolved',
};
export default function TrackReport({ initialCaseId = '' }) {
    const [caseId, setCaseId] = useState(initialCaseId);
    const [result, setResult] = useState(null);
    const [msg, setMsg] = useState('');
    const [loading, setLoading] = useState(false);
    async function lookup(e) {
        e?.preventDefault();
        setMsg('');
        setResult(null);
        const id = caseId.trim().toUpperCase();
        if (!id) {
            setMsg('Enter the Case ID you received after submitting.');
            return;
        }
        setLoading(true);
        try {
            const r = await api(`/api/reports/by-case/${encodeURIComponent(id)}`);
            setResult(r);
        }
        catch {
            // Never expose whether an ID exists vs. server trouble — single calm message.
            setMsg('We could not find that Case ID. Check it and try again.');
        }
        finally {
            setLoading(false);
        }
    }
    const stageIdx = result ? Math.max(0, STAGE_ORDER.indexOf(result.status)) : -1;
    return (_jsxs("div", { className: "fade-in", children: [_jsx("h2", { style: { fontSize: 'var(--fs-section)', color: 'var(--navy-900)' }, children: "Track your report" }), _jsx("p", { className: "card-sub", children: "Only status information is shown here \u2014 never case details." }), _jsxs(BentoGrid, { children: [_jsxs(BentoCard, { span: "span-7", label: "Track your report", children: [_jsx(Eyebrow, { children: "Track your report" }), _jsxs("form", { onSubmit: lookup, className: "field", children: [_jsx("label", { htmlFor: "tr-id", children: "Case ID" }), _jsx("input", { id: "tr-id", value: caseId, onChange: (e) => setCaseId(e.target.value), placeholder: "SR-_____", autoComplete: "off", style: { textTransform: 'uppercase' } }), msg && _jsx("p", { className: "error-text", role: "alert", children: msg }), _jsx("div", { style: { marginTop: 12 }, children: _jsxs("button", { className: "btn", type: "submit", disabled: loading, children: [_jsx(Search, { size: 16, "aria-hidden": "true" }), " ", loading ? 'Checking…' : 'View Status'] }) })] })] }), _jsxs(BentoCard, { span: "span-5", label: "Case status", children: [_jsx(Eyebrow, { children: "Case status" }), !result ? (_jsx("p", { className: "card-sub", children: "Enter your Case ID to see where your report stands." })) : (_jsxs("div", { children: [_jsxs("h3", { children: ["CASE ", result.case_id] }), _jsx(StatusBadge, { status: result.status }), _jsx("ol", { className: "timeline", style: { marginTop: 16 }, children: STAGE_ORDER.map((s, i) => (_jsxs("li", { className: i <= stageIdx ? 'done' : '', children: [_jsx("span", { className: "t-dot", "aria-hidden": "true" }), _jsx("div", { className: "t-action", children: STAGE_LABEL[s] }), _jsx("div", { className: "t-sub", children: i < stageIdx ? 'Completed' : i === stageIdx ? 'Current stage' : 'Pending' })] }, s))) })] }))] })] })] }));
}
