import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { ShieldCheck, Bell, Menu, X, LogOut } from 'lucide-react';
export default function TopNavigation({ mode, view, goPublic, goStaff, logged, urgentCount, onLogout, }) {
    const [open, setOpen] = useState(false);
    const username = localStorage.getItem('username') || '';
    const role = (localStorage.getItem('role') || '').replace('_', ' ');
    function nav(v) {
        setOpen(false);
        if (mode === 'public')
            goPublic(v);
        else
            goStaff(v);
    }
    const staffLinks = ['dashboard', 'cases', 'audit', 'resources'];
    const labels = {
        home: 'Home', report: 'Report', track: 'Track report', resources: 'Resources',
        dashboard: 'Dashboard', cases: 'Cases', audit: 'Audit logs',
    };
    return (_jsxs("header", { className: "topbar", children: [_jsx("a", { className: "skip-link", href: "#main", children: "Skip to content" }), _jsxs("div", { className: "topbar-inner", children: [_jsxs("button", { className: "brand", onClick: () => nav(mode === 'public' ? 'home' : 'dashboard'), "aria-label": "SafeReport home", children: [_jsx("span", { className: "brand-mark", children: _jsx(ShieldCheck, { size: 20, "aria-hidden": "true" }) }), "SafeReport"] }), mode === 'public' ? (_jsx("nav", { className: `nav-links ${open ? 'open' : ''}`, "aria-label": "Primary", children: ['home', 'report', 'track', 'resources'].map((v) => (_jsx("button", { onClick: () => nav(v), "aria-current": view === v ? 'page' : undefined, children: labels[v] }, v))) })) : logged ? (_jsx("nav", { className: `nav-links ${open ? 'open' : ''}`, "aria-label": "Staff", children: staffLinks.map((v) => (_jsx("button", { onClick: () => nav(v), "aria-current": view === v ? 'page' : undefined, children: labels[v] }, v))) })) : _jsx("span", {}), _jsxs("div", { className: "topbar-right", children: [mode === 'staff' && logged && (_jsxs("button", { className: "notif", "aria-label": `${urgentCount} high-risk cases need review`, onClick: () => nav('cases'), title: "High-risk cases needing review", children: [_jsx(Bell, { size: 17, "aria-hidden": "true" }), urgentCount > 0 && _jsx("span", { className: "notif-badge", children: urgentCount })] })), mode === 'staff' && logged && (_jsxs("span", { className: "profile-chip", title: role, children: [_jsx("span", { className: "profile-dot", "aria-hidden": "true", children: username.slice(0, 1).toUpperCase() }), _jsxs("span", { className: "uname", children: [username, " \u00B7 ", role] }), _jsx("button", { className: "btn ghost", style: { padding: '6px 10px' }, onClick: onLogout, "aria-label": "Log out", children: _jsx(LogOut, { size: 15, "aria-hidden": "true" }) })] })), _jsx("button", { className: "btn ghost menu-btn", style: { padding: '8px 10px' }, onClick: () => setOpen(!open), "aria-expanded": open, "aria-label": "Toggle menu", children: open ? _jsx(X, { size: 18, "aria-hidden": "true" }) : _jsx(Menu, { size: 18, "aria-hidden": "true" }) })] })] })] }));
}
