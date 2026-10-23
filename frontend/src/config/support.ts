/**
 * Region-dependent public support contacts.
 *
 * SafeReport does NOT infer a deployment region from the browser, the
 * developer's machine, or a reference website. Deployment sets one build-time
 * variable: VITE_SUPPORT_REGION=us | uk | in (optional; default "generic").
 *
 * The "generic" default deliberately shows no emergency number: no single
 * number is correct worldwide, and a wrong number is worse than a clear
 * instruction. Only region-appropriate numbers are displayed. Availability
 * wording stays conservative (helplines differ by State/UT in India).
 */

export type SupportRegionId = 'generic' | 'us' | 'uk' | 'in';

export interface SupportLink {
  label: string;
  tel?: string;
}

export interface SupportRegion {
  /** Emergency-services guidance; a tel: link only when it is region-correct. */
  emergency: { heading: string; body: string; action: SupportLink | null };
  /** Domestic-abuse helpline guidance, kept distinct from emergency services. */
  helpline: { heading: string; body: string; action: SupportLink | null };
}

const US: SupportRegion = {
  emergency: {
    heading: 'In immediate danger?',
    body: 'Call 911 now.',
    action: { label: 'Call 911', tel: '911' },
  },
  helpline: {
    heading: 'Domestic violence hotline',
    body: 'National Domestic Violence Hotline (US) — confidential, 24/7.',
    action: { label: 'Call 1-800-799-7233', tel: '18007997233' },
  },
};

const UK: SupportRegion = {
  emergency: {
    heading: 'In immediate danger?',
    body: 'Call 999 now (112 also reaches emergency services in the UK).',
    action: { label: 'Call 999', tel: '999' },
  },
  helpline: {
    heading: 'Domestic abuse helpline',
    body: 'National Domestic Abuse Helpline (UK) — free, 24/7.',
    action: { label: 'Call 0808 2000 247', tel: '08082000247' },
  },
};

const IN: SupportRegion = {
  emergency: {
    heading: 'In immediate danger?',
    body: 'Dial 112 — India\'s single national emergency number (ERSS: police, fire, ambulance).',
    action: { label: 'Call 112', tel: '112' },
  },
  helpline: {
    heading: 'Women Helpline 181',
    body: 'Toll-free, 24×7 in most States/UTs; connects to One Stop Centres and emergency services.',
    action: { label: 'Call 181', tel: '181' },
  },
};

const GENERIC: SupportRegion = {
  emergency: {
    heading: 'In immediate danger?',
    body: 'Call your local emergency-services number now.',
    action: null,
  },
  helpline: {
    heading: 'Find confidential support',
    body: 'Region-specific helpline details are not configured for this deployment. Contact a trusted national domestic-abuse service in your area.',
    action: null,
  },
};

/** Pure resolver so region selection is testable without rebuilding. */
export function resolveRegion(id: string | undefined): SupportRegion {
  switch (id) {
    case 'us':
      return US;
    case 'uk':
      return UK;
    case 'in':
      return IN;
    default:
      // Unknown or unset — never guess a number; fall back to generic guidance.
      return GENERIC;
  }
}

const ENV_REGION = (import.meta as any).env?.VITE_SUPPORT_REGION as string | undefined;

export const SUPPORT_REGION: SupportRegionId =
  ENV_REGION && ['generic', 'us', 'uk', 'in'].includes(ENV_REGION)
    ? (ENV_REGION as SupportRegionId)
    : 'generic';

export const SUPPORT: SupportRegion = resolveRegion(SUPPORT_REGION);
