import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowLeft, CheckCircle2, Lock } from 'lucide-react';
import { publicApi } from '../api';
import { BentoGrid, BentoCard, Eyebrow } from '../components/ui';
import StepIndicator from '../components/StepIndicator';

const STEPS = ['Incident', 'Details', 'Contact', 'Review'];
const MIN_DESC_LENGTH = 10;

export default function ReportWizard({ onDone }: { onDone: (caseId: string) => void }) {
  const [step, setStep] = useState(0);
  const [description, setDescription] = useState('');
  const [reporterType, setReporterType] = useState('victim');
  const [location, setLocation] = useState('');
  const [incidentDate, setIncidentDate] = useState('');
  const [contact, setContact] = useState('');
  const [msg, setMsg] = useState('');
  const [descError, setDescError] = useState('');
  const [sending, setSending] = useState(false);
  const headingRef = useRef<HTMLParagraphElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  // How many step entries we pushed onto the browser history stack so the
  // wizard can clean up when it unmounts inside the app.
  const pushedSteps = useRef(0);

  const canNext = step === 0 ? description.trim().length >= MIN_DESC_LENGTH : true;

  // Browser Back/Forward walk through the pushed step entries (state carries
  // only the step number — never report content), so the narrative stays
  // intact while moving between steps and a page refresh never re-exposes
  // prior steps from the URL. The narrative itself is memory-only.
  useEffect(() => {
    function onPop(e: PopStateEvent) {
      const s = (e.state as { safeReportStep?: number } | null)?.safeReportStep;
      if (typeof s === 'number' && s >= 0 && s < STEPS.length) {
        setStep(s);
        setMsg('');
        setDescError('');
      }
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // When the wizard unmounts inside the app, remove its step entries so Back
  // does not need to re-walk empty wizard states.
  useEffect(() => () => {
    const n = pushedSteps.current;
    if (n > 0) {
      pushedSteps.current = 0;
      try { window.history.go(-n); } catch { /* best effort */ }
    }
  }, []);

  function goTo(next: number) {
    if (next === step + 1) {
      try {
        window.history.pushState({ safeReportStep: next }, '');
        pushedSteps.current += 1;
      } catch { /* history unavailable — step change still works */ }
    } else if (next === step - 1 && pushedSteps.current > 0) {
      // Let the browser move back through our own pushed step; popstate syncs.
      window.history.back();
      return;
    }
    applyStep(next);
  }

  function applyStep(next: number) {
    setStep(next);
    setMsg('');
    setDescError('');
    // Move focus to the step heading so the change is announced.
    window.setTimeout(() => headingRef.current?.focus(), 0);
  }

  function tryContinue() {
    if (step === 0 && description.trim().length < MIN_DESC_LENGTH) {
      setDescError(
        `Please describe the incident in at least ${MIN_DESC_LENGTH} characters so staff can understand and help. ${description.trim().length ? 'Add a few more words.' : 'The box is empty — write what happened in your own words.'}`,
      );
      descRef.current?.focus();
      return;
    }
    goTo(step + 1);
  }

  async function submit() {
    setMsg('');
    setSending(true);
    try {
      const r = await publicApi<{ case_id: string }>('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          reporter_type: reporterType,
          description: description.trim(),
          location,
          incident_date: incidentDate,
          contact: reporterType === 'anonymous' ? '' : contact,
        }),
      });
      onDone(r.case_id);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Submission failed. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fade-in">
      <h1 className="page-title">Report an incident</h1>
      <p className="card-sub">Only provide information you feel safe sharing. You can stay anonymous.</p>
      <StepIndicator steps={STEPS} current={step} />

      <BentoGrid>
        <BentoCard span="span-12">
          <Eyebrow>{`0${step + 1} / 0${STEPS.length} · ${STEPS[step]}`}</Eyebrow>
          <p ref={headingRef} tabIndex={-1} className="sr-only" role="status" aria-live="polite">
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </p>

          {step === 0 && (
            <div className="field">
              <h2>What happened?</h2>
              <p className="card-sub">Describe the incident in your own words.</p>
              <label htmlFor="rw-desc" className="sr-only">Incident description</label>
              <textarea
                id="rw-desc" ref={descRef} value={description}
                onChange={(e) => { setDescription(e.target.value); setDescError(''); }}
                placeholder="You don't need to use formal language…"
                aria-required="true"
                aria-invalid={descError ? true : undefined}
                aria-describedby={`rw-desc-hint${descError ? ' rw-desc-error' : ''}`}
              />
              <p id="rw-desc-hint" className="hint">Minimum 10 characters so staff can understand and help.</p>
              {descError && (
                <p id="rw-desc-error" className="error-text" role="alert">{descError}</p>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="field">
              <h2>A few details</h2>
              <label htmlFor="rw-type">I am reporting as</label>
              <select id="rw-type" value={reporterType} onChange={(e) => setReporterType(e.target.value)}>
                <option value="victim">The person affected</option>
                <option value="anonymous">Anonymously</option>
                <option value="third_party">On behalf of someone else</option>
              </select>
              <label htmlFor="rw-loc">Location <span className="hint">(optional)</span></label>
              <input id="rw-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City or area" />
              <label htmlFor="rw-date">Approximate date <span className="hint">(optional)</span></label>
              <input id="rw-date" value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)} placeholder="e.g. Yesterday evening" />
            </div>
          )}

          {step === 2 && (
            <div className="field">
              <h2>How can staff reach you?</h2>
              <p className="card-sub">
                {reporterType === 'anonymous'
                  ? 'You chose anonymous reporting — no contact needed. You can still continue.'
                  : 'Optional. Leave blank if it is safer not to share contact details.'}
              </p>
              <label htmlFor="rw-contact">Contact <span className="hint">(optional)</span></label>
              <input
                id="rw-contact" value={contact} onChange={(e) => setContact(e.target.value)}
                placeholder="Phone or email — only if safe" disabled={reporterType === 'anonymous'}
              />
              <p className="hint hint-lock">
                <Lock size={13} aria-hidden="true" /> Contact details are visible only to case handlers and administrators.
              </p>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2>Review before submitting</h2>
              <p className="card-sub">Reporting as: <strong>{reporterType.replace(/_/g, ' ')}</strong></p>
              <p className="review-box">{description}</p>
              {(location || incidentDate) && (
                <p className="card-sub">{[location, incidentDate].filter(Boolean).join(' · ')}</p>
              )}
            </div>
          )}

          {msg && <p className="error-text" role="alert">{msg}</p>}

          <div className="button-row" style={{ marginTop: 20 }}>
            {step > 0 && (
              <button className="btn ghost" onClick={() => goTo(step - 1)}>
                <ArrowLeft size={16} aria-hidden="true" /> Back
              </button>
            )}
            {step < STEPS.length - 1 && (
              <button className="btn" onClick={tryContinue}>
                Continue <ArrowRight size={16} aria-hidden="true" />
              </button>
            )}
            {step === STEPS.length - 1 && (
              <button className="btn" onClick={submit} disabled={sending || !canNext}>
                {sending ? 'Submitting…' : (<><CheckCircle2 size={16} aria-hidden="true" /> Submit securely</>)}
              </button>
            )}
          </div>
        </BentoCard>
      </BentoGrid>
    </div>
  );
}
