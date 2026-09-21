import { Check } from 'lucide-react';

/* Progressive-disclosure step indicator for the reporting wizard. */
export default function StepIndicator({ steps, current }: {
  steps: string[]; current: number;
}) {
  return (
    <ol className="steps" aria-label="Reporting progress">
      {steps.map((s, i) => (
        <li key={s} className={`step ${i === current ? 'active' : ''} ${i < current ? 'done' : ''}`}
          aria-current={i === current ? 'step' : undefined}>
          <span className="n" aria-hidden="true">{i < current ? <Check size={14} /> : `0${i + 1}`}</span>
          {s}
        </li>
      ))}
    </ol>
  );
}
