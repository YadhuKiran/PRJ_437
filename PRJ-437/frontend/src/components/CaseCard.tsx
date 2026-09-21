import { ArrowRight } from 'lucide-react';
import { BentoCard, RiskBadge, StatusBadge, ScoreBar, levelClass } from './ui';
import type { ReportItem } from '../types';

/* Clickable bento/table-hybrid case card with subtle hover interaction. */
export default function CaseCard({ report, onOpen }: {
  report: ReportItem; onOpen: (id: number) => void;
}) {
  const tags = [report.reporter_type.replace('_', ' '), report.location].filter(Boolean).join(' · ');
  return (
    <BentoCard span="span-12" clickable onClick={() => onOpen(report.id)} label={`Open case ${report.case_id}`}>
      <div className="case-card">
        <div className="case-card-top">
          <span className="case-id">{report.case_id}</span>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <RiskBadge level={report.risk_level} score={report.risk_score} />
            <ArrowRight size={16} color="var(--ink-faint)" aria-hidden="true" />
          </span>
        </div>
        {tags && <div className="case-tags">{tags}</div>}
        <div className="score-row">
          <span className="meta">AI Risk Score</span>
          <strong>{report.risk_score != null && report.risk_score >= 0 ? `${report.risk_score} / 100` : 'Not assessed'}</strong>
        </div>
        <ScoreBar score={report.risk_score} level={report.risk_level} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusBadge status={report.status} />
          <span className="meta">
            {report.risk_level === 'HIGH' ? 'Urgent review' : ''} · {report.created_at?.slice(0, 10)} · {report.reporter_type.replace('_', ' ')}
          </span>
        </div>
      </div>
    </BentoCard>
  );
}

export { levelClass };
