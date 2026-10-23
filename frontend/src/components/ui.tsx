import type { ReactNode, MouseEventHandler, KeyboardEvent } from 'react';
import { AlertTriangle, Inbox } from 'lucide-react';
import type { RiskLevel, RiskLevelOrUnavailable, ReportStatus } from '../types';

/* ---------- layout primitives ---------- */
export function BentoGrid({ children }: { children: ReactNode }) {
  return <div className="bento">{children}</div>;
}

/** Keyboard activation for card-like buttons (Enter and Space, WCAG 2.1.1). */
function cardKeyHandler(onClick?: MouseEventHandler) {
  return (e: KeyboardEvent<HTMLElement>) => {
    if (!onClick) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      // Space would otherwise scroll the page.
      e.preventDefault();
      onClick(e as unknown as React.MouseEvent<HTMLElement>);
    }
  };
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
      onKeyDown={clickable ? cardKeyHandler(onClick) : undefined}
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
export function RiskBadge({ level, score }: { level?: RiskLevelOrUnavailable | string | null; score?: number | null }) {
  if (!level) return <span className="badge NA">Not assessed</span>;
  const cls = level === 'HIGH' || level === 'MEDIUM' || level === 'LOW' || level === 'UNAVAILABLE'
    ? level : 'NA';
  return (
    <span className={`badge ${cls}`}>
      <span className="dot" aria-hidden="true" />
      {level}{score != null && score >= 0 ? ` · ${score}` : ''}
    </span>
  );
}

const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  under_review: 'Under review',
  closed: 'Closed',
};

export function StatusBadge({ status }: { status: ReportStatus | string }) {
  const label = STATUS_LABEL[status] ?? status.replace(/_/g, ' ');
  const cls = status === 'new' || status === 'under_review' || status === 'closed' ? status : 'NA';
  return (
    <span className={`badge status-${cls}`}>
      <span className="dot" aria-hidden="true" />
      {label}
    </span>
  );
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
  const known = score != null && score >= 0;
  const v = known ? score : 0;
  const cls = level === 'HIGH' ? 'high' : level === 'MEDIUM' ? 'medium' : level === 'LOW' ? 'low' : '';
  const accessible = known
    ? `Risk ${level ?? 'unknown'}, score ${v} out of 100`
    : 'Risk not assessed yet';
  return (
    <div className={`score-bar ${cls}`} role="img" aria-label={accessible}>
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
    <div className="bento" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {spans.map((s, i) => <div key={i} className={`skeleton ${s}`} aria-hidden="true" />)}
    </div>
  );
}

export function ErrorCard({ title, body, onRetry }: {
  title: string; body: string; onRetry?: () => void;
}) {
  return (
    <BentoCard span="span-12">
      <div className="error-body" role="alert">
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
