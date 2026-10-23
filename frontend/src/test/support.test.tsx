import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import SupportStrip from '../components/SupportStrip';
import { resolveRegion } from '../config/support';

/**
 * Emergency contacts are region-configured, never guessed. Covered: the
 * resolver returns region data for each supported region, unknown/unset
 * regions fall back to "generic" (clear text, NO tel: link), and the visible
 * strip renders only region-appropriate links.
 */

describe('support region resolution', () => {
  it('returns 911 guidance for the US region', () => {
    const r = resolveRegion('us');
    expect(r.emergency.action?.tel).toBe('911');
    expect(r.emergency.body).toContain('911');
  });

  it('returns 999 guidance for the UK region', () => {
    const r = resolveRegion('uk');
    expect(r.emergency.action?.tel).toBe('999');
  });

  it('returns 112 guidance for the India region', () => {
    const r = resolveRegion('in');
    expect(r.emergency.action?.tel).toBe('112');
  });

  it('falls back to generic for unset or unknown regions — no number is guessed', () => {
    for (const id of [undefined, '', 'au', 'de', 'US' /* case-sensitive */]) {
      const r = resolveRegion(id);
      expect(r.emergency.action).toBeNull();
      expect(r.helpline.action).toBeNull();
      // The guidance must still clearly direct to local emergency services.
      expect(r.emergency.body.toLowerCase()).toContain('emergency');
    }
  });
});

describe('SupportStrip rendering', () => {
  beforeEach(() => {
    cleanup();
  });

  it('shows clear text without a tel: link when no region is configured', () => {
    // In the test environment VITE_SUPPORT_REGION is undefined, so the strip
    // must render generic guidance and no emergency/helpline tel: link.
    render(<SupportStrip />);
    expect(screen.getByText(/immediate danger/i)).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText(/configured per deployment/i)).toBeTruthy();
  });
});

