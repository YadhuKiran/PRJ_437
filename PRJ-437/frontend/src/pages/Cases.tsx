import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { BentoGrid, EmptyState, SkeletonGrid, ErrorCard } from '../components/ui';
import CaseCard from '../components/CaseCard';
import type { ReportItem } from '../types';

type Filter = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNASSESSED';

export default function Cases({ onOpen }: { onOpen: (id: number) => void }) {
  const [items, setItems] = useState<ReportItem[] | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');

  useEffect(() => {
    let alive = true;
    api('/api/reports')
      .then((r) => { if (alive) setItems(r); })
      .catch(() => { if (alive) setError('Unable to load cases. Please try again.'); });
    return () => { alive = false; };
  }, []);

  const shown = useMemo(() => {
    if (!items) return [];
    if (filter === 'ALL') return items;
    if (filter === 'UNASSESSED') return items.filter((r) => !r.risk_level);
    return items.filter((r) => r.risk_level === filter);
  }, [items, filter]);

  if (error) return <ErrorCard title="Unable to load cases." body={error} onRetry={() => window.location.reload()} />;
  if (!items) return <SkeletonGrid spans={['span-12', 'span-12', 'span-12']} />;

  const counts: Record<Filter, number> = {
    ALL: items.length,
    HIGH: items.filter((r) => r.risk_level === 'HIGH').length,
    MEDIUM: items.filter((r) => r.risk_level === 'MEDIUM').length,
    LOW: items.filter((r) => r.risk_level === 'LOW').length,
    UNASSESSED: items.filter((r) => !r.risk_level).length,
  };

  return (
    <div className="fade-in">
      <h2 style={{ fontSize: 'var(--fs-section)', color: 'var(--navy-900)' }}>Cases</h2>
      <p className="card-sub">{items.length} case{items.length === 1 ? '' : 's'} · sorted by AI risk, highest first.</p>
      <div className="filter-row" role="group" aria-label="Filter cases by risk">
        {(Object.keys(counts) as Filter[]).map((f) => (
          <button
            key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}
          >
            {f === 'UNASSESSED' ? 'Not assessed' : f.charAt(0) + f.slice(1).toLowerCase()} · {counts[f]}
          </button>
        ))}
      </div>
      <BentoGrid>
        {shown.length === 0 ? (
          <div className="card span-12">
            <EmptyState title="No cases here" body="No cases match this filter right now." />
          </div>
        ) : (
          shown.map((r) => <CaseCard key={r.id} report={r} onOpen={onOpen} />)
        )}
      </BentoGrid>
    </div>
  );
}
