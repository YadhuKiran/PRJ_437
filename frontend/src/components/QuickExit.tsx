import { useEffect, useRef } from 'react';
import { LogOut } from 'lucide-react';
import { MENU_OPEN_EVENT } from '../lib/events';

const ENV_EXIT_URL = (import.meta as any).env?.VITE_QUICK_EXIT_URL as string | undefined;

/**
 * Neutral destination for the Quick Exit. Deployment can override it with
 * VITE_QUICK_EXIT_URL. Selecting the destination is a deployment decision:
 * SafeReport deliberately promises nothing about the site a person lands on —
 * only that leaving happens without passing through SafeReport again.
 */
export const QUICK_EXIT_URL = ENV_EXIT_URL || 'https://www.google.com';

/**
 * The only storage keys SafeReport uses for sensitive state. Quick Exit
 * removes exactly these (plus the in-progress report draft, which lives in
 * React memory and is dropped automatically). It deliberately does NOT wipe
 * all storage, cannot erase browser history, server logs, or third-party
 * evidence of a visit.
 *
 * Keep this list in sync with App.tsx / auth handling.
 */
export const SENSITIVE_LOCAL_KEYS: readonly string[] = ['token', 'role', 'username'];
export const SENSITIVE_SESSION_KEYS: readonly string[] = ['safereport.lastCaseId'];

function clearSensitiveStorage() {
  try {
    for (const key of SENSITIVE_LOCAL_KEYS) localStorage.removeItem(key);
    for (const key of SENSITIVE_SESSION_KEYS) sessionStorage.removeItem(key);
  } catch {
    // Storage may be unavailable (privacy mode / denied); leaving is more
    // important than cleaning up — never block the escape on storage.
  }
}

function navigateAway() {
  try {
    window.location.replace(QUICK_EXIT_URL);
  } catch {
    window.location.href = QUICK_EXIT_URL;
  }
}

export default function QuickExit({ navigate = navigateAway }: { navigate?: (url: string) => void } = {}) {
  const menuOpen = useRef(false);

  // The header menu owns Escape: pressing Escape while the menu is open must
  // close the menu, not trigger the exit. TopNavigation announces its state
  // through MENU_OPEN_EVENT and this component tracks it — no DOM sniffing.
  useEffect(() => {
    function onMenuOpen(e: Event) {
      menuOpen.current = (e as CustomEvent<boolean>).detail === true;
    }
    window.addEventListener(MENU_OPEN_EVENT, onMenuOpen);
    return () => window.removeEventListener(MENU_OPEN_EVENT, onMenuOpen);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape' || e.repeat || e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) {
        // Inside a form field, Escape must restore the field, not navigate.
        return;
      }
      if (menuOpen.current) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      leave();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function leave() {
    clearSensitiveStorage();
    navigate(QUICK_EXIT_URL);
  }

  return (
    <button
      className="quick-exit"
      onClick={leave}
      aria-label="Quick exit — leave this site immediately"
      title="Leaves this site immediately (Esc). Quick Exit does not erase your browser history or any server records."
    >
      <LogOut size={16} aria-hidden="true" /> Quick Exit
      <span className="quick-exit-kbd" aria-hidden="true">Esc</span>
    </button>
  );
}
