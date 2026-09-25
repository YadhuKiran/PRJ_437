import { Lock, HeartHandshake, PhoneCall, ArrowRight, Search } from 'lucide-react';
import { BentoGrid, BentoCard, Eyebrow } from '../components/ui';
import type { PublicView } from '../types';

export default function Landing({ go }: { go: (v: PublicView) => void }) {
  return (
    <div className="fade-in">
      <BentoGrid>
        <BentoCard span="span-12" className="hero" label="Welcome">
          <Eyebrow>SafeReport · Private incident reporting</Eyebrow>
          <h1>You&rsquo;re in control.</h1>
          <p className="lead">
            Report an incident privately and securely. Share only what you feel safe sharing —
            you can report anonymously.
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

        <BentoCard span="span-4" label="Privacy">
          <Lock size={22} color="var(--navy-800)" aria-hidden="true" />
          <h3 className="card-title" style={{ marginTop: 8 }}>Privacy first</h3>
          <p className="card-sub">Anonymous reporting is supported. Your narrative is never written to system logs.</p>
        </BentoCard>

        <BentoCard span="span-4" label="Support">
          <HeartHandshake size={22} color="var(--navy-800)" aria-hidden="true" />
          <h3 className="card-title" style={{ marginTop: 8 }}>Support nearby</h3>
          <p className="card-sub">Helplines, counselling and legal support resources are one tap away.</p>
          <button className="btn ghost" onClick={() => go('resources')}>View resources</button>
        </BentoCard>

        <BentoCard span="span-4" className="navy" label="Emergency help">
          <PhoneCall size={22} aria-hidden="true" />
          <h3 className="card-title" style={{ marginTop: 8 }}>In immediate danger?</h3>
          <p className="card-sub">Call your local emergency number now (e.g. 911 / 112).</p>
          <a className="btn secondary" href="tel:911">Call 911</a>
        </BentoCard>
      </BentoGrid>
    </div>
  );
}
