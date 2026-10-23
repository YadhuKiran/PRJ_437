import { SUPPORT } from '../config/support';

/**
 * Compact always-visible urgent-help strip for public pages. Renders only the
 * guidance configured for this deployment's region — no global emergency
 * number is guessed when the region is unset ("generic" shows clear text
 * without a tel: link).
 */
export default function SupportStrip() {
  return (
    <div className="support-strip" role="region" aria-label="Urgent help">
      <span className="support-strip-text">
        <strong>In immediate danger?</strong> {SUPPORT.emergency.body}
      </span>
      {SUPPORT.emergency.action?.tel && (
        <a className="support-strip-link" href={`tel:${SUPPORT.emergency.action.tel}`}>
          {SUPPORT.emergency.action.label}
        </a>
      )}
      {SUPPORT.helpline.action?.tel && (
        <a className="support-strip-link support-strip-link-quiet" href={`tel:${SUPPORT.helpline.action.tel}`}>
          {SUPPORT.helpline.action.label}
        </a>
      )}
      {!SUPPORT.emergency.action && !SUPPORT.helpline.action && (
        <span className="support-strip-hint">
          Contact details are configured per deployment (VITE_SUPPORT_REGION).
        </span>
      )}
    </div>
  );
}
