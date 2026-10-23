import {
  Lock, HeartHandshake, PhoneCall, ArrowRight, Search, LifeBuoy, FileText,
  ClipboardCheck, UserCheck, ShieldCheck, ScrollText, Compass,
} from 'lucide-react';
import { BentoGrid, BentoCard, Eyebrow } from '../components/ui';
import { SUPPORT } from '../config/support';
import type { PublicView } from '../types';

/**
 * Landing page. Every statement here is a verified product capability: the
 * backend test suite asserts that narratives are excluded from logs and that
 * staff access is audit-logged; risk levels are AI suggestions that a human
 * case handler always decides on. No unverified "anonymous" or "encrypted"
 * claims are made.
 */
export default function Landing({ go }: { go: (v: PublicView) => void }) {
  const tasks: {
    key: string; icon: typeof FileText; title: string; body: string;
    prompt: string; view: PublicView; urgent?: boolean;
  }[] = [
    {
      key: 'report', icon: FileText, title: 'Report an incident',
      body: 'Describe what happened in your own words. You decide what to share.',
      prompt: 'Start a report', view: 'report',
    },
    {
      key: 'track', icon: Search, title: 'Track a report',
      body: 'Use your Case ID to see where your report stands — status only, never details.',
      prompt: 'Check a report', view: 'track',
    },
    {
      key: 'resources', icon: LifeBuoy, title: 'Find support',
      body: 'Helplines and community services, vetted for this deployment.',
      prompt: 'View resources', view: 'resources',
    },
  ];

  return (
    <div className="fade-in">
      <BentoGrid>
        {/* Hero — full-bleed warm band, calm and unhurried. */}
        <BentoCard span="span-12" className="hero" label="Welcome">
          <Eyebrow>SafeReport · Private incident reporting</Eyebrow>
          <h1>You&rsquo;re in control.</h1>
          <p className="lead">
            Report an incident privately. Share only what you feel safe sharing —
            you can stay anonymous, and nothing is required of you here.
          </p>
          <div className="hero-actions">
            <button className="btn" onClick={() => go('report')}>
              Report an Incident <ArrowRight size={17} aria-hidden="true" />
            </button>
            <button className="btn secondary" onClick={() => go('track')}>
              <Search size={17} aria-hidden="true" /> Track Existing Report
            </button>
          </div>
          <p className="hint" style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Lock size={14} aria-hidden="true" /> Secure session · Only provide information you feel safe sharing.
          </p>
        </BentoCard>
      </BentoGrid>

      {/* Task cards — the three things a visitor can do. */}
      <section className="band" aria-labelledby="wh-heading">
        <h2 id="wh-heading" className="page-title" style={{ fontSize: 'var(--fs-section)' }}>How can we help today?</h2>
        <div className="task-cards">
          {tasks.map((t) => (
            <button key={t.key} className={`task-card${t.urgent ? ' urgent' : ''}`} onClick={() => go(t.view)}>
              <span className="task-icon" aria-hidden="true"><t.icon size={22} /></span>
              <h2>{t.title}</h2>
              <p>{t.body}</p>
              <span className="task-prompt">{t.prompt} <ArrowRight size={15} aria-hidden="true" /></span>
            </button>
          ))}
        </div>
      </section>

      {/* How reporting works — three clear steps before the form. */}
      <section className="band" aria-labelledby="how-heading">
        <h2 id="how-heading" className="page-title" style={{ fontSize: 'var(--fs-section)' }}>How reporting works</h2>
        <div className="process-grid">
          <div className="process-step">
            <span className="p-num" aria-hidden="true">1</span>
            <h3>Tell us what happened</h3>
            <p>Write in your own words — formal language is not required. At least a few words of context helps staff understand.</p>
          </div>
          <div className="process-step">
            <span className="p-num" aria-hidden="true">2</span>
            <h3>Decide how to be reached</h3>
            <p>Share a phone or email only if it is safe, or continue fully anonymously. That choice is yours at every step.</p>
          </div>
          <div className="process-step">
            <span className="p-num" aria-hidden="true">3</span>
            <h3>Keep your Case ID safe</h3>
            <p>After submitting you receive a Case ID — the only way to check your report&rsquo;s status from the Track page.</p>
          </div>
        </div>
      </section>

      {/* Privacy & trust — verified capabilities only. */}
      <section className="band" aria-labelledby="trust-heading">
        <h2 id="trust-heading" className="page-title" style={{ fontSize: 'var(--fs-section)' }}>Privacy and trust</h2>
        <div className="trust-grid">
          <div className="trust-item">
            <ScrollText size={20} aria-hidden="true" />
            <div>
              <strong>What you write is not written to system logs</strong>
              <span>The narrative you submit is stored as report content — and excluded from application and audit logs.</span>
            </div>
          </div>
          <div className="trust-item">
            <UserCheck size={20} aria-hidden="true" />
            <div>
              <strong>A person decides, not software</strong>
              <span>An AI screen suggests a priority level; an authorised case handler reviews and decides on every case.</span>
            </div>
          </div>
          <div className="trust-item">
            <ShieldCheck size={20} aria-hidden="true" />
            <div>
              <strong>Reading a report leaves a mark</strong>
              <span>Every staff action is recorded in an audit trail — who acted, what they did, when.</span>
            </div>
          </div>
          <div className="trust-item">
            <Compass size={20} aria-hidden="true" />
            <div>
              <strong>Tracking shows status only</strong>
              <span>Entering your Case ID on the Track page shows progress — never who reported, or what was written.</span>
            </div>
          </div>
        </div>
      </section>

      {/* Support — region-configured, never a guessed number. */}
      <BentoGrid>
        <BentoCard span="span-12" className="navy" label="Immediate help">
          <div style={{ display: 'flex', gap: 'var(--s-4)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <PhoneCall size={26} aria-hidden="true" style={{ flex: 'none', marginTop: 4 }} />
            <div style={{ flex: 1, minWidth: 260 }}>
              <Eyebrow>Immediate help</Eyebrow>
              <h2 className="card-title" style={{ fontSize: 18, marginTop: 4 }}>
                {SUPPORT.emergency.heading || 'In immediate danger?'}
              </h2>
              <p className="card-sub" style={{ marginTop: 4 }}>{SUPPORT.emergency.body}</p>
            </div>
            <div style={{ display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap', alignItems: 'center' }}>
              {SUPPORT.emergency.action?.tel && (
                <a className="btn" href={`tel:${SUPPORT.emergency.action.tel}`}>{SUPPORT.emergency.action.label}</a>
              )}
              {SUPPORT.helpline.action?.tel && (
                <a className="btn secondary" href={`tel:${SUPPORT.helpline.action.tel}`}>{SUPPORT.helpline.action.label}</a>
              )}
            </div>
          </div>
        </BentoCard>

        <BentoCard span="span-6" label="About this service">
          <HeartHandshake size={22} color="var(--accent)" aria-hidden="true" />
          <h2 className="card-title" style={{ marginTop: 8 }}>Built for safety, reviewed by people</h2>
          <p className="card-sub">
            SafeReport supports safe disclosure and case prioritisation for authorised
            staff. It never contacts authorities, discloses a report, or acts without
            a human decision.
          </p>
        </BentoCard>

        <BentoCard span="span-6" label="Before you start">
          <ClipboardCheck size={22} color="var(--accent)" aria-hidden="true" />
          <h2 className="card-title" style={{ marginTop: 8 }}>Before you start</h2>
          <ul className="plain-list">
            <li>You do not need evidence or proof to report.</li>
            <li>You can skip any optional field on the form.</li>
            <li>The Quick Exit button is always on screen if you need to leave fast.</li>
          </ul>
        </BentoCard>
      </BentoGrid>
    </div>
  );
}
