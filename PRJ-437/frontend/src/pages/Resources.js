import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { PhoneCall, HeartHandshake, Scale, Users, LifeBuoy } from 'lucide-react';
import { api } from '../api';
import { BentoGrid, BentoCard, Eyebrow } from '../components/ui';
const CARDS = [
    { icon: PhoneCall, title: 'Emergency Help', body: 'In immediate danger? Call your local emergency number now (e.g. 911 / 112).', action: { label: 'Call 911', href: 'tel:911' } },
    { icon: LifeBuoy, title: 'Helplines', body: 'National DV Hotline (US): 1-800-799-7233 — confidential, 24/7.', action: null },
    { icon: Users, title: 'NGO Support', body: 'Local shelters and advocacy groups can help with safety planning and housing.', action: null },
    { icon: Scale, title: 'Legal Support', body: 'Free legal aid clinics can explain protection orders and your rights.', action: null },
    { icon: HeartHandshake, title: 'Counselling', body: 'Trauma-informed counsellors provide confidential emotional support.', action: null },
];
export default function Resources() {
    const [server, setServer] = useState([]);
    useEffect(() => {
        api('/api/resources').then(setServer).catch(() => setServer([]));
    }, []);
    return (_jsxs("div", { className: "fade-in", children: [_jsx("h2", { style: { fontSize: 'var(--fs-section)', color: 'var(--navy-900)' }, children: "Support resources" }), _jsx("p", { className: "card-sub", children: "Trusted places to turn \u2014 no report required." }), _jsxs(BentoGrid, { children: [CARDS.map((c) => (_jsxs(BentoCard, { span: "span-4", label: c.title, children: [_jsx(c.icon, { size: 24, color: "var(--navy-800)", "aria-hidden": "true" }), _jsx("h3", { className: "card-title", style: { marginTop: 8 }, children: c.title }), _jsx("p", { className: "card-sub", children: c.body }), c.action && _jsx("a", { className: "btn secondary", href: c.action.href, children: c.action.label })] }, c.title))), server.length > 0 && (_jsxs(BentoCard, { span: "span-12", label: "More from our support directory", children: [_jsx(Eyebrow, { children: "More from our support directory" }), _jsx("ul", { style: { margin: 0, paddingLeft: 18 }, children: server.map((r) => (_jsxs("li", { style: { marginBottom: 8 }, children: [_jsx("strong", { children: r.name }), " ", _jsxs("span", { className: "card-sub", children: ["\u2014 ", r.detail] })] }, r.name))) })] }))] })] }));
}
