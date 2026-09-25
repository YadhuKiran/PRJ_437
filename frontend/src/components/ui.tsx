import type { ReactNode, MouseEventHandler } from 'react';
import { AlertTriangle, Inbox } from 'lucide-react';
import type { RiskLevel } from '../types';

/* ---------- layout primitives ---------- */
export function BentoGrid({ children }: { children: ReactNode }) {
  return <div className="bento">{children}</div>;
}

export function BentoCard({
  span = 'span-6', className = '', clickable = false, onClick, children, label,
}: {
  span?: string; className?: string; clickable?: boolean;
  onClick?: MouseEventHandler; children: ReactNode; label?: string;
}) {
  return (
    <section
      className={`card ${span} ${className} ${clickable ? 'clickable' : ''}`}
      onClick={onClick}
      aria-label={label}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(e as never); } : undefined}
    >
      {children}
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow">{children}</div>;
}

/* ---------- stats ---------- */
export function StatCard({ span = 'span-3', label, value, sub }: {
  span?: string; label: string; value: ReactNode; sub?: ReactNode;
}) {
  return (
    <BentoCard span={span} label={label}>
      <Eyebrow>{label}</Eyebrow>
      <div className="stat-num">{value}</div>
      {sub && <div className="stat-delta">{sub}</div>}
    </BentoCard>
  );
}

/* ---------- badges ---------- */
export function RiskBadge({ level, score }: { level?: string | null; score?: number | null }) {
  if (!level) return <span className="badge NA">Not assessed</span>;
  return (
    <span className={`badge ${level}`}>
      <span className="dot" aria-hidden="true" />
      {level}{score != null && score >= 0 ? ` · ${score}` : ''}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, ' ').toUpperCase();
  return <span className="badge NA">{label}</span>;
}

export function SecurityLine({ text }: { text: string }) {
  return (
    <span className="status-line">
      <span className="ok" aria-hidden="true" />{text}
    </span>
  );
}

/* ---------- score bar ---------- */
export function ScoreBar({ score, level }: { score?: number | null; level?: string | null }) {
  const v = score ?? 0;
  const cls = level === 'HIGH' ? 'high' : level === 'MEDIUM' ? 'medium' : level === 'LOW' ? 'low' : '';
  return (
    <div className={`score-bar ${cls}`} role="img" aria-label={`Risk score ${v} out of 100`}>
      <span style={{ width: `${Math.max(0, Math.min(100, v))}%` }} />
    </div>
  );
}

/* ---------- states ---------- */
export function EmptyState({ title, body, action }: {
  title: string; body: string; action?: ReactNode;
}) {
  return (
    <div style={{ textAlign: 'center', padding: '28px 12px' }}>
      <Inbox size={30} color="var(--ink-faint)" aria-hidden="true" />
      <h3 style={{ marginTop: 12 }}>{title}</h3>
      <p className="card-sub">{body}</p>
      {action}
    </div>
  );
}

export function SkeletonGrid({ spans = ['span-3', 'span-3', 'span-3', 'span-3', 'span-7', 'span-5'] }: {
  spans?: string[];
}) {
  return (
    <div className="bento" aria-busy="true" aria-label="Loading">
      {spans.map((s, i) => <div key={i} className={`skeleton ${s}`} />)}
    </div>
  );
}

export function ErrorCard({ title, body, onRetry }: {
  title: string; body: string; onRetry?: () => void;
}) {
  return (
    <BentoCard span="span-12" label={title}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <AlertTriangle color="var(--risk-high-ink)" aria-hidden="true" />
        <div>
          <h3>{title}</h3>
          <p className="card-sub">{body}</p>
          {onRetry && <button className="btn secondary" onClick={onRetry}>Retry</button>}
        </div>
      </div>
    </BentoCard>
  );
}

export function levelClass(level?: string | null): string {
  return level === 'HIGH' || level === 'MEDIUM' || level === 'LOW' ? level : 'NA';
}

export type { RiskLevel };
