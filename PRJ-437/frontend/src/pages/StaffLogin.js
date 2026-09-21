import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { LogIn, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import { BentoGrid, BentoCard, Eyebrow } from '../components/ui';
export default function StaffLogin({ onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [msg, setMsg] = useState('');
    const [busy, setBusy] = useState(false);
    async function login(e) {
        e.preventDefault();
        setMsg('');
        setBusy(true);
        try {
            const r = await api('/api/auth/login', {
                method: 'POST', body: JSON.stringify({ username, password }),
            });
            localStorage.setItem('token', r.access_token);
            localStorage.setItem('role', r.role);
            localStorage.setItem('username', r.username);
            onLogin();
        }
        catch {
            // Single calm message — never reveal whether the username exists.
            setMsg('Invalid credentials. Please try again.');
        }
        finally {
            setBusy(false);
        }
    }
    return (_jsx("div", { className: "fade-in", style: { maxWidth: 560, margin: '0 auto' }, children: _jsx(BentoGrid, { children: _jsxs(BentoCard, { span: "span-12", label: "Staff sign in", children: [_jsx(Eyebrow, { children: "Staff access" }), _jsxs("div", { style: { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }, children: [_jsx(ShieldCheck, { size: 26, color: "var(--navy-800)", "aria-hidden": "true" }), _jsx("h2", { style: { margin: 0 }, children: "Case workspace sign in" })] }), _jsx("p", { className: "card-sub", children: "Authorized personnel only. All access is audit-logged." }), _jsxs("form", { onSubmit: login, className: "field", children: [_jsx("label", { htmlFor: "sl-user", children: "Username" }), _jsx("input", { id: "sl-user", value: username, onChange: (e) => setUsername(e.target.value), autoComplete: "username" }), _jsx("label", { htmlFor: "sl-pass", children: "Password" }), _jsx("input", { id: "sl-pass", type: "password", value: password, onChange: (e) => setPassword(e.target.value), autoComplete: "current-password" }), msg && _jsx("p", { className: "error-text", role: "alert", children: msg }), _jsx("div", { style: { marginTop: 14 }, children: _jsxs("button", { className: "btn", type: "submit", disabled: busy || !username || !password, children: [_jsx(LogIn, { size: 16, "aria-hidden": "true" }), " ", busy ? 'Signing in…' : 'Sign in securely'] }) })] })] }) }) }));
}
