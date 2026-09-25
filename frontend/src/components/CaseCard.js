import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowRight } from 'lucide-react';
import { BentoCard, RiskBadge, StatusBadge, ScoreBar, levelClass } from './ui';
/* Clickable bento/table-hybrid case card with subtle hover interaction. */
export default function CaseCard({ report, onOpen }) {
    const tags = [report.reporter_type.replace('_', ' '), report.location].filter(Boolean).join(' · ');
    return (_jsx(BentoCard, { span: "span-12", clickable: true, onClick: () => onOpen(report.id), label: `Open case ${report.case_id}`, children: _jsxs("div", { className: "case-card", children: [_jsxs("div", { className: "case-card-top", children: [_jsx("span", { className: "case-id", children: report.case_id }), _jsxs("span", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsx(RiskBadge, { level: report.risk_level, score: report.risk_score }), _jsx(ArrowRight, { size: 16, color: "var(--ink-faint)", "aria-hidden": "true" })] })] }), tags && _jsx("div", { className: "case-tags", children: tags }), _jsxs("div", { className: "score-row", children: [_jsx("span", { className: "meta", children: "AI Risk Score" }), _jsx("strong", { children: report.risk_score != null && report.risk_score >= 0 ? `${report.risk_score} / 100` : 'Not assessed' })] }), _jsx(ScoreBar, { score: report.risk_score, level: report.risk_level }), _jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }, children: [_jsx(StatusBadge, { status: report.status }), _jsxs("span", { className: "meta", children: [report.risk_level === 'HIGH' ? 'Urgent review' : '', " \u00B7 ", report.created_at?.slice(0, 10), " \u00B7 ", report.reporter_type.replace('_', ' ')] })] })] }) }));
}
export { levelClass };
