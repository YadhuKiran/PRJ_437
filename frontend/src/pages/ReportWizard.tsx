import { useState } from 'react';
import { ArrowRight, ArrowLeft, CheckCircle2, Lock } from 'lucide-react';
import { api } from '../api';
import { BentoGrid, BentoCard, Eyebrow } from '../components/ui';
import StepIndicator from '../components/StepIndicator';

const STEPS = ['Incident', 'Details', 'Contact', 'Review'];

export default function ReportWizard({ onDone }: { onDone: (caseId: string) => void }) {
  const [step, setStep] = useState(0);
  const [description, setDescription] = useState('');
  const [reporterType, setReporterType] = useState('victim');
  const [location, setLocation] = useState('');
  const [incidentDate, setIncidentDate] = useState('');
  const [contact, setContact] = useState('');
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);

  const canNext = step === 0 ? description.trim().length >= 10 : true;

  async function submit() {
    setMsg('');
    setSending(true);
    try {
      const r = await api('/api/reports', {
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
      <h2 style={{ fontSize: 'var(--fs-section)', color: 'var(--navy-900)' }}>Report an incident</h2>
      <p className="card-sub">Only provide information you feel safe sharing. You can stay anonymous.</p>
      <StepIndicator steps={STEPS} current={step} />

      <BentoGrid>
        <BentoCard span="span-12" label={`Step ${step + 1}: ${STEPS[step]}`}>
          <Eyebrow>{`0${step + 1} / 0${STEPS.length} · ${STEPS[step]}`}</Eyebrow>

          {step === 0 && (
            <div className="field">
              <h3>What happened?</h3>
              <p className="card-sub">Describe the incident in your own words.</p>
              <label htmlFor="rw-desc" className="sr-only">Incident description</label>
              <textarea
                id="rw-desc" value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="You don't need to use formal language…"
              />
              <p className="hint">Minimum 10 characters so staff can understand and help.</p>
            </div>
          )}

          {step === 1 && (
            <div className="field">
              <h3>A few details</h3>
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
              <h3>How can staff reach you?</h3>
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
              <p className="hint" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Lock size={13} aria-hidden="true" /> Contact details are visible only to authorized case handlers.
              </p>
            </div>
          )}

          {step === 3 && (
            <div>
              <h3>Review before submitting</h3>
              <p className="card-sub">Reporting as: <strong>{reporterType.replace('_', ' ')}</strong></p>
              <p style={{ whiteSpace: 'pre-wrap', background: 'var(--card-warm)', border: '1px solid var(--line)', borderRadius: 'var(--r-inner)', padding: 14 }}>
                {description}
              </p>
              {(location || incidentDate) && (
                <p className="card-sub">{[location, incidentDate].filter(Boolean).join(' · ')}</p>
              )}
              {msg && <p className="error-text" role="alert">{msg}</p>}
            </div>
          )}

          {step === 0 && msg && <p className="error-text" role="alert">{msg}</p>}

          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            {step > 0 && (
              <button className="btn ghost" onClick={() => { setStep(step - 1); setMsg(''); }}>
                <ArrowLeft size={16} aria-hidden="true" /> Back
              </button>
            )}
            {step < STEPS.length - 1 && (
              <button className="btn" onClick={() => setStep(step + 1)} disabled={!canNext}>
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
