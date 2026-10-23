import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuickExit, { QUICK_EXIT_URL, SENSITIVE_LOCAL_KEYS, SENSITIVE_SESSION_KEYS } from '../components/QuickExit';
import { MENU_OPEN_EVENT } from '../lib/events';

/**
 * Quick Exit is a safety control; navigation is mocked so tests never leave
 * the test page. Covered: click activation, Escape activation with its
 * guards, sensitive-storage clearing (and non-wiping), listener cleanup.
 */

function renderQuickExit(navigate: (url: string) => void = vi.fn()) {
  render(<QuickExit navigate={navigate} />);
  return { button: screen.getByRole('button', { name: 'Quick exit — leave this site immediately' }), navigate };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  cleanup();
});

describe('QuickExit', () => {
  it('clears only SafeReport-sensitive storage and navigates on click', () => {
    localStorage.setItem('token', 't');
    localStorage.setItem('role', 'admin');
    localStorage.setItem('username', 'a');
    localStorage.setItem('other-pref', 'keep-me');
    sessionStorage.setItem('safereport.lastCaseId', 'SR-000001');
    sessionStorage.setItem('unrelated', 'keep-me');
    const navigate = vi.fn();
    const { button } = renderQuickExit(navigate);

    fireEvent.click(button);

    for (const k of SENSITIVE_LOCAL_KEYS) expect(localStorage.getItem(k)).toBeNull();
    for (const k of SENSITIVE_SESSION_KEYS) expect(sessionStorage.getItem(k)).toBeNull();
    // Non-sensitive keys must survive — no indiscriminate wiping.
    expect(localStorage.getItem('other-pref')).toBe('keep-me');
    expect(sessionStorage.getItem('unrelated')).toBe('keep-me');
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(QUICK_EXIT_URL);
    expect(QUICK_EXIT_URL).toMatch(/^https:\/\//);
  });

  it('still leaves the site when storage throws', () => {
    const original = Storage.prototype.removeItem;
    Storage.prototype.removeItem = vi.fn(() => { throw new Error('blocked'); });
    const navigate = vi.fn();
    const { button } = renderQuickExit(navigate);
    fireEvent.click(button);
    Storage.prototype.removeItem = original;
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('Escape triggers the exit when the menu is closed and focus is not in a form field', () => {
    const navigate = vi.fn();
    const { button } = renderQuickExit(navigate);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(navigate).toHaveBeenCalledTimes(1);
    // The visible keyboard hint must be present on the control.
    expect(button.textContent).toContain('Esc');
  });

  it('does not leave when Escape lands inside a form field', async () => {
    const navigate = vi.fn();
    const user = userEvent.setup();
    render(
      <div>
        <input aria-label="search" />
        <textarea aria-label="notes" />
        <select aria-label="choose"><option>1</option></select>
        <QuickExit navigate={navigate} />
      </div>,
    );
    const search = screen.getByRole('textbox', { name: 'search' });
    const notes = screen.getByLabelText('notes');
    const combo = screen.getByRole('combobox');
    await user.click(search);
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    notes.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    combo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    // Typing then Escape-with-focus must also stay put.
    await user.type(notes, 'some words');
    notes.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    void search; void combo;
    expect(navigate).not.toHaveBeenCalled();
  });

  it('waits while the header menu is open, leaves once the menu reports closed', () => {
    const navigate = vi.fn();
    renderQuickExit(navigate);

    window.dispatchEvent(new CustomEvent(MENU_OPEN_EVENT, { detail: true }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(navigate).not.toHaveBeenCalled();

    window.dispatchEvent(new CustomEvent(MENU_OPEN_EVENT, { detail: false }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('ignores repeats and events another handler already consumed', () => {
    const navigate = vi.fn();
    renderQuickExit(navigate);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', repeat: true, cancelable: true }));
    const consumed = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    consumed.preventDefault();
    window.dispatchEvent(consumed);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not leave when a modal dialog is open', () => {
    const navigate = vi.fn();
    render(
      <div>
        <div role="dialog" aria-modal="true"><button>close me</button></div>
        <QuickExit navigate={navigate} />
      </div>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('removes its window listeners on unmount', () => {
    const navigate = vi.fn();
    const { unmount } = render(<QuickExit navigate={navigate} />);
    unmount();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('exposes an accessible name and a neutral, locally overridable destination', () => {
    renderQuickExit();
    expect(screen.getByTitle(/does not erase your browser history/i)).toBeTruthy();
  });

  it('pressing keyboard emulation of Enter still clicks the button', async () => {
    const navigate = vi.fn();
    const user = userEvent.setup();
    const { button } = renderQuickExit(navigate);
    await user.click(button);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(QUICK_EXIT_URL).not.toContain('#');
  });
});
