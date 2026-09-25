import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { ArrowRight, ArrowLeft, CheckCircle2, Lock } from 'lucide-react';
import { api } from '../api';
import { BentoGrid, BentoCard, Eyebrow } from '../components/ui';
import StepIndicator from '../components/StepIndicator';
const STEPS = ['Incident', 'Details', 'Contact', 'Review'];
export default function ReportWizard({ onDone }) {
    const [step, setStep] = useState(0);
    const [description, setDescription] = useState('');
    const [reporterType, setReporterType] = useState('victim');
    const [location, setLocation] = useState('');
    const [incidentDate, setIncidentDate] = useState('');
    const [contact, setContact] = useState('');
    const [msg, setMsg] = useState('');
    const [sending, setSending] = useState(false);
    const canNext = step === 0 ? description.trim().length >= 10 : true;
    async function submit() {
        setMsg('');
        setSending(true);
        try {
            const r = await api('/api/reports', {
                method: 'POST',
                body: JSON.stringify({
                    reporter_type: reporterType,
                    description: description.trim(),
                    location,
                    incident_date: incidentDate,
                    contact: reporterType === 'anonymous' ? '' : contact,
                }),
            });
            onDone(r.case_id);
        }
        catch (e) {
            setMsg(e instanceof Error ? e.message : 'Submission failed. Please try again.');
        }
        finally {
            setSending(false);
        }
    }
    return (_jsxs("div", { className: "fade-in", children: [_jsx("h2", { style: { fontSize: 'var(--fs-section)', color: 'var(--navy-900)' }, children: "Report an incident" }), _jsx("p", { className: "card-sub", children: "Only provide information you feel safe sharing. You can stay anonymous." }), _jsx(StepIndicator, { steps: STEPS, current: step }), _jsx(BentoGrid, { children: _jsxs(BentoCard, { span: "span-12", label: `Step ${step + 1}: ${STEPS[step]}`, children: [_jsx(Eyebrow, { children: `0${step + 1} / 0${STEPS.length} · ${STEPS[step]}` }), step === 0 && (_jsxs("div", { className: "field", children: [_jsx("h3", { children: "What happened?" }), _jsx("p", { className: "card-sub", children: "Describe the incident in your own words." }), _jsx("label", { htmlFor: "rw-desc", className: "sr-only", children: "Incident description" }), _jsx("textarea", { id: "rw-desc", value: description, onChange: (e) => setDescription(e.target.value), placeholder: "You don't need to use formal language\u2026" }), _jsx("p", { className: "hint", children: "Minimum 10 characters so staff can understand and help." })] })), step === 1 && (_jsxs("div", { className: "field", children: [_jsx("h3", { children: "A few details" }), _jsx("label", { htmlFor: "rw-type", children: "I am reporting as" }), _jsxs("select", { id: "rw-type", value: reporterType, onChange: (e) => setReporterType(e.target.value), children: [_jsx("option", { value: "victim", children: "The person affected" }), _jsx("option", { value: "anonymous", children: "Anonymously" }), _jsx("option", { value: "third_party", children: "On behalf of someone else" })] }), _jsxs("label", { htmlFor: "rw-loc", children: ["Location ", _jsx("span", { className: "hint", children: "(optional)" })] }), _jsx("input", { id: "rw-loc", value: location, onChange: (e) => setLocation(e.target.value), placeholder: "City or area" }), _jsxs("label", { htmlFor: "rw-date", children: ["Approximate date ", _jsx("span", { className: "hint", children: "(optional)" })] }), _jsx("input", { id: "rw-date", value: incidentDate, onChange: (e) => setIncidentDate(e.target.value), placeholder: "e.g. Yesterday evening" })] })), step === 2 && (_jsxs("div", { className: "field", children: [_jsx("h3", { children: "How can staff reach you?" }), _jsx("p", { className: "card-sub", children: reporterType === 'anonymous'
                                        ? 'You chose anonymous reporting — no contact needed. You can still continue.'
                                        : 'Optional. Leave blank if it is safer not to share contact details.' }), _jsxs("label", { htmlFor: "rw-contact", children: ["Contact ", _jsx("span", { className: "hint", children: "(optional)" })] }), _jsx("input", { id: "rw-contact", value: contact, onChange: (e) => setContact(e.target.value), placeholder: "Phone or email \u2014 only if safe", disabled: reporterType === 'anonymous' }), _jsxs("p", { className: "hint", style: { display: 'flex', alignItems: 'center', gap: 6 }, children: [_jsx(Lock, { size: 13, "aria-hidden": "true" }), " Contact details are visible only to authorized case handlers."] })] })), step === 3 && (_jsxs("div", { children: [_jsx("h3", { children: "Review before submitting" }), _jsxs("p", { className: "card-sub", children: ["Reporting as: ", _jsx("strong", { children: reporterType.replace('_', ' ') })] }), _jsx("p", { style: { whiteSpace: 'pre-wrap', background: 'var(--card-warm)', border: '1px solid var(--line)', borderRadius: 'var(--r-inner)', padding: 14 }, children: description }), (location || incidentDate) && (_jsx("p", { className: "card-sub", children: [location, incidentDate].filter(Boolean).join(' · ') })), msg && _jsx("p", { className: "error-text", role: "alert", children: msg })] })), step === 0 && msg && _jsx("p", { className: "error-text", role: "alert", children: msg }), _jsxs("div", { style: { display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }, children: [step > 0 && (_jsxs("button", { className: "btn ghost", onClick: () => { setStep(step - 1); setMsg(''); }, children: [_jsx(ArrowLeft, { size: 16, "aria-hidden": "true" }), " Back"] })), step < STEPS.length - 1 && (_jsxs("button", { className: "btn", onClick: () => setStep(step + 1), disabled: !canNext, children: ["Continue ", _jsx(ArrowRight, { size: 16, "aria-hidden": "true" })] })), step === STEPS.length - 1 && (_jsx("button", { className: "btn", onClick: submit, disabled: sending || !canNext, children: sending ? 'Submitting…' : (_jsxs(_Fragment, { children: [_jsx(CheckCircle2, { size: 16, "aria-hidden": "true" }), " Submit securely"] })) }))] })] }) })] }));
}
