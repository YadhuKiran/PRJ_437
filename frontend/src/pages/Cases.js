import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { BentoGrid, EmptyState, SkeletonGrid, ErrorCard } from '../components/ui';
import CaseCard from '../components/CaseCard';
export default function Cases({ onOpen }) {
    const [items, setItems] = useState(null);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('ALL');
    useEffect(() => {
        let alive = true;
        api('/api/reports')
            .then((r) => { if (alive)
            setItems(r); })
            .catch(() => { if (alive)
            setError('Unable to load cases. Please try again.'); });
        return () => { alive = false; };
    }, []);
    const shown = useMemo(() => {
        if (!items)
            return [];
        if (filter === 'ALL')
            return items;
        if (filter === 'UNASSESSED')
            return items.filter((r) => !r.risk_level);
        return items.filter((r) => r.risk_level === filter);
    }, [items, filter]);
    if (error)
        return _jsx(ErrorCard, { title: "Unable to load cases.", body: error, onRetry: () => window.location.reload() });
    if (!items)
        return _jsx(SkeletonGrid, { spans: ['span-12', 'span-12', 'span-12'] });
    const counts = {
        ALL: items.length,
        HIGH: items.filter((r) => r.risk_level === 'HIGH').length,
        MEDIUM: items.filter((r) => r.risk_level === 'MEDIUM').length,
        LOW: items.filter((r) => r.risk_level === 'LOW').length,
        UNASSESSED: items.filter((r) => !r.risk_level).length,
    };
    return (_jsxs("div", { className: "fade-in", children: [_jsx("h2", { style: { fontSize: 'var(--fs-section)', color: 'var(--navy-900)' }, children: "Cases" }), _jsxs("p", { className: "card-sub", children: [items.length, " case", items.length === 1 ? '' : 's', " \u00B7 sorted by AI risk, highest first."] }), _jsx("div", { className: "filter-row", role: "group", "aria-label": "Filter cases by risk", children: Object.keys(counts).map((f) => (_jsxs("button", { className: "chip", "aria-pressed": filter === f, onClick: () => setFilter(f), children: [f === 'UNASSESSED' ? 'Not assessed' : f.charAt(0) + f.slice(1).toLowerCase(), " \u00B7 ", counts[f]] }, f))) }), _jsx(BentoGrid, { children: shown.length === 0 ? (_jsx("div", { className: "card span-12", children: _jsx(EmptyState, { title: "No cases here", body: "No cases match this filter right now." }) })) : (shown.map((r) => _jsx(CaseCard, { report: r, onOpen: onOpen }, r.id))) })] }));
}
