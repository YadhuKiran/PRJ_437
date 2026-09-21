import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Check } from 'lucide-react';
/* Progressive-disclosure step indicator for the reporting wizard. */
export default function StepIndicator({ steps, current }) {
    return (_jsx("ol", { className: "steps", "aria-label": "Reporting progress", children: steps.map((s, i) => (_jsxs("li", { className: `step ${i === current ? 'active' : ''} ${i < current ? 'done' : ''}`, "aria-current": i === current ? 'step' : undefined, children: [_jsx("span", { className: "n", "aria-hidden": "true", children: i < current ? _jsx(Check, { size: 14 }) : `0${i + 1}` }), s] }, s))) }));
}
