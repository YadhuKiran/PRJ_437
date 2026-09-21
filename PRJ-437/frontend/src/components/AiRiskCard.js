import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { CheckCircle2, Sparkles, ShieldAlert } from 'lucide-react';
import { api } from '../api';
import { BentoCard, Eyebrow, ScoreBar } from './ui';
function yn(v) {
    if (v === true)
        return 'Detected';
    if (v === false)
        return 'Not mentioned';
    return '—';
}
/* Distinctive analytical AI card: score, indicators, explanation, human override.
   Generating shows honest progress steps for the single backend AI call. */
export default function AiRiskCard({ reportId }) {
    const [a, setA] = useState(null);
    const [missing, setMissing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [step, setStep] = useState(0);
    const [msg, setMsg] = useState('');
    const [override, setOverride] = useState('MEDIUM');
    const [reason, setReason] = useState('');
    const role = localStorage.getItem('role');
    const canAct = role === 'admin' || role === 'case_handler';
    const GEN_STEPS = ['Reading incident', 'Identifying indicators', 'Calculating risk', 'Preparing explanation'];
    useEffect(() => {
        let alive = true;
        api(`/api/reports/${reportId}/ai-analysis`)
            .then((r) => { if (alive) {
            setA(r);
            setMissing(false);
        } })
            .catch(() => { if (alive)
            setMissing(true); });
        return () => { alive = false; };
    }, [reportId]);
    async function generate() {
        setMsg('');
        setBusy(true);
        setStep(0);
        const tick = window.setInterval(() => setStep((s) => Math.min(s + 1, GEN_STEPS.length - 1)), 700);
        try {
            const r = await api(`/api/reports/${reportId}/ai-analysis`, { method: 'POST' });
            setA(r);
            setMissing(false);
        }
        catch (e) {
            setMsg(e instanceof Error ? e.message : 'Analysis could not be generated. Please try again.');
        }
        finally {
            window.clearInterval(tick);
            setBusy(false);
        }
    }
    async function sendOverride() {
        setMsg('');
        try {
            const r = await api(`/api/reports/${reportId}/override-risk`, {
                method: 'POST', body: JSON.stringify({ human_override: override, reason }),
            });
            setA(r);
            setReason('');
        }
        catch (e) {
            setMsg(e instanceof Error ? e.message : 'Override could not be saved. Please try again.');
        }
    }
    if (missing && !busy) {
        return (_jsxs(BentoCard, { span: "span-5", label: "AI risk assessment", children: [_jsx(Eyebrow, { children: "AI Risk Assessment" }), _jsx("p", { className: "card-sub", children: "No analysis generated for this case yet." }), canAct
                    ? _jsxs("button", { className: "btn", onClick: generate, children: [_jsx(Sparkles, { size: 16, "aria-hidden": "true" }), " Generate AI Analysis"] })
                    : _jsx("p", { className: "card-sub", children: "Ask a case handler to generate it." }), msg && _jsx("p", { className: "error-text", role: "alert", children: msg })] }));
    }
    if (busy || !a) {
        return (_jsxs(BentoCard, { span: "span-5", className: "ai-risk", label: "Analyzing incident", children: [_jsx(Eyebrow, { children: "AI Risk Assessment" }), _jsx("h3", { children: "Analyzing incident\u2026" }), _jsx("ol", { className: "ai-steps", "aria-live": "polite", children: GEN_STEPS.map((s, i) => (_jsxs("li", { children: [i <= step
                                ? _jsx("span", { className: "spinner", "aria-hidden": "true" })
                                : _jsx("span", { style: { width: 16 }, "aria-hidden": "true" }), s, i < step ? ' ✓' : ''] }, s))) })] }));
    }
    return (_jsxs(BentoCard, { span: "span-5", className: "ai-risk", label: "AI risk assessment", children: [_jsx(Eyebrow, { children: "AI Risk Assessment" }), !a.ai_available && (_jsxs("p", { role: "alert", style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsx(ShieldAlert, { size: 16, "aria-hidden": "true" }), " AI unavailable \u2014 manual review required."] })), _jsx("div", { className: "risk-word", children: a.risk_level }), _jsxs("div", { style: { display: 'flex', alignItems: 'baseline', gap: 8, margin: '8px 0' }, children: [_jsx("span", { className: "score-big", children: a.risk_score ?? '—' }), _jsx("span", { className: "score-max", children: "/ 100" })] }), _jsx(ScoreBar, { score: a.risk_score, level: a.risk_level }), _jsx("div", { style: { marginTop: 16, fontWeight: 700, fontSize: 14 }, children: "Detected indicators" }), _jsxs("ul", { className: "indicator-list", children: [(a.reasons || []).map((r) => (_jsxs("li", { children: [_jsx(CheckCircle2, { size: 16, "aria-hidden": "true" }), " ", r] }, r))), (a.reasons || []).length === 0 && _jsx("li", { children: "No strong risk indicators detected." })] }), _jsx("p", { className: "card-sub", style: { color: '#b9c6dc' }, children: "Decision-support tool \u00B7 Human review required. The AI never makes the final decision." }), a.human_override && (_jsxs("p", { style: { background: 'rgba(255,255,255,.1)', borderRadius: 12, padding: '10px 14px' }, children: ["Staff override: ", _jsx("strong", { children: a.human_override }), " \u2014 ", a.override_reason] })), canAct && (_jsxs("div", { className: "field", style: { marginTop: 12 }, children: [_jsx("label", { htmlFor: "ai-ovr", style: { color: '#fff' }, children: "Human override" }), _jsxs("select", { id: "ai-ovr", value: override, onChange: (e) => setOverride(e.target.value), children: [_jsx("option", { children: "LOW" }), _jsx("option", { children: "MEDIUM" }), _jsx("option", { children: "HIGH" })] }), _jsx("label", { htmlFor: "ai-rsn", className: "sr-only", children: "Override reason" }), _jsx("input", { id: "ai-rsn", value: reason, onChange: (e) => setReason(e.target.value), placeholder: "Reason \u2014 required", style: { marginTop: 8 } }), _jsx("div", { style: { marginTop: 10 }, children: _jsx("button", { className: "btn secondary", onClick: sendOverride, disabled: reason.trim().length < 5, children: "Save override" }) })] })), msg && _jsx("p", { className: "error-text", role: "alert", style: { color: '#f2b8b8' }, children: msg })] }));
}
export { yn };
