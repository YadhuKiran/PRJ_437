import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AlertTriangle, Inbox } from 'lucide-react';
/* ---------- layout primitives ---------- */
export function BentoGrid({ children }) {
    return _jsx("div", { className: "bento", children: children });
}
export function BentoCard({ span = 'span-6', className = '', clickable = false, onClick, children, label, }) {
    return (_jsx("section", { className: `card ${span} ${className} ${clickable ? 'clickable' : ''}`, onClick: onClick, "aria-label": label, role: clickable ? 'button' : undefined, tabIndex: clickable ? 0 : undefined, onKeyDown: clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ')
            onClick?.(e); } : undefined, children: children }));
}
export function Eyebrow({ children }) {
    return _jsx("div", { className: "eyebrow", children: children });
}
/* ---------- stats ---------- */
export function StatCard({ span = 'span-3', label, value, sub }) {
    return (_jsxs(BentoCard, { span: span, label: label, children: [_jsx(Eyebrow, { children: label }), _jsx("div", { className: "stat-num", children: value }), sub && _jsx("div", { className: "stat-delta", children: sub })] }));
}
/* ---------- badges ---------- */
export function RiskBadge({ level, score }) {
    if (!level)
        return _jsx("span", { className: "badge NA", children: "Not assessed" });
    return (_jsxs("span", { className: `badge ${level}`, children: [_jsx("span", { className: "dot", "aria-hidden": "true" }), level, score != null && score >= 0 ? ` · ${score}` : ''] }));
}
export function StatusBadge({ status }) {
    const label = status.replace(/_/g, ' ').toUpperCase();
    return _jsx("span", { className: "badge NA", children: label });
}
export function SecurityLine({ text }) {
    return (_jsxs("span", { className: "status-line", children: [_jsx("span", { className: "ok", "aria-hidden": "true" }), text] }));
}
/* ---------- score bar ---------- */
export function ScoreBar({ score, level }) {
    const v = score ?? 0;
    const cls = level === 'HIGH' ? 'high' : level === 'MEDIUM' ? 'medium' : level === 'LOW' ? 'low' : '';
    return (_jsx("div", { className: `score-bar ${cls}`, role: "img", "aria-label": `Risk score ${v} out of 100`, children: _jsx("span", { style: { width: `${Math.max(0, Math.min(100, v))}%` } }) }));
}
/* ---------- states ---------- */
export function EmptyState({ title, body, action }) {
    return (_jsxs("div", { style: { textAlign: 'center', padding: '28px 12px' }, children: [_jsx(Inbox, { size: 30, color: "var(--ink-faint)", "aria-hidden": "true" }), _jsx("h3", { style: { marginTop: 12 }, children: title }), _jsx("p", { className: "card-sub", children: body }), action] }));
}
export function SkeletonGrid({ spans = ['span-3', 'span-3', 'span-3', 'span-3', 'span-7', 'span-5'] }) {
    return (_jsx("div", { className: "bento", "aria-busy": "true", "aria-label": "Loading", children: spans.map((s, i) => _jsx("div", { className: `skeleton ${s}` }, i)) }));
}
export function ErrorCard({ title, body, onRetry }) {
    return (_jsx(BentoCard, { span: "span-12", label: title, children: _jsxs("div", { style: { display: 'flex', gap: 12, alignItems: 'flex-start' }, children: [_jsx(AlertTriangle, { color: "var(--risk-high-ink)", "aria-hidden": "true" }), _jsxs("div", { children: [_jsx("h3", { children: title }), _jsx("p", { className: "card-sub", children: body }), onRetry && _jsx("button", { className: "btn secondary", onClick: onRetry, children: "Retry" })] })] }) }));
}
export function levelClass(level) {
    return level === 'HIGH' || level === 'MEDIUM' || level === 'LOW' ? level : 'NA';
}
