import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { within } from '@testing-library/react';
import ReportWizard from '../pages/ReportWizard';

/**
 * Wizard validation must never be "a silently disabled button". Covered:
 * empty/too-short input announces an accessible error, valid input advances,
 * history-across-steps works without ever writing report content into
 * history state, and the popstate restore keeps the typed narrative.
 */

const VALID_TEXT = 'Synthetic test narrative, long enough to pass validation.';

function renderWizard(onDone: (caseId: string) => void = vi.fn()) {
  render(<ReportWizard onDone={onDone} />);
  return {
    description: screen.getByRole('textbox', { name: 'Incident description' }),
    continueBtn: screen.getByRole('button', { name: /Continue/ }),
    backBtn: screen.queryByRole('button', { name: /Back/ }),
  };
}

const wizardSteps = () => screen.getByRole('list', { name: 'Reporting progress' });

beforeEach(() => {
  cleanup();
});

describe('ReportWizard validation', () => {
  it('keeps Continue clickable on the empty first step and announces an accessible error', async () => {
    const user = userEvent.setup();
    const { continueBtn, description } = renderWizard();

    expect(continueBtn).toBeEnabled();
    await user.click(continueBtn);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/at least 10 characters/i);
    expect(description).toHaveAttribute('aria-invalid', 'true');
    expect(description).toHaveAttribute('aria-describedby', expect.stringContaining('rw-desc-error'));
  });

  it('rejects too-short input but accepts valid input and advances to Details', async () => {
    const user = userEvent.setup();
    const { continueBtn, description } = renderWizard();

    await user.type(description, 'short');
    await user.click(continueBtn);
    expect(screen.getByRole('alert')).toHaveTextContent(/Add a few more words/i);
    // The typed narrative must not appear in any URL: the app stays on '/'.
    expect(window.location.pathname + window.location.search).toBe('/');

    await user.type(description, ' more words to reach the minimum');
    await user.click(continueBtn);

    // The <li> textContent starts with the numeric prefix ("02Details");
    // assert on the step that is actually marked as current.
    const currentItem = within(wizardSteps()).getAllByRole('listitem').find(
      (li) => li.getAttribute('aria-current') === 'step',
    );
    expect(currentItem?.textContent?.includes('Details')).toBe(true);
    expect(screen.getByRole('heading', { name: 'A few details' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(description).not.toBeInTheDocument(); // step 1 has no description field
  });

  it('clears the validation error as soon as the user edits the field', async () => {
    const user = userEvent.setup();
    const { continueBtn, description } = renderWizard();
    await user.click(continueBtn);
    expect(screen.getByRole('alert')).toBeTruthy();
    await user.type(description, 'a');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(description).not.toHaveAttribute('aria-invalid');
  });

  it('never writes report content into history state', async () => {
    const user = userEvent.setup();
    const pushSpy = vi.spyOn(window.history, 'pushState');
    const { continueBtn, description } = renderWizard();
    await user.type(description, `${VALID_TEXT} secret-words`);
    await user.click(continueBtn);

    expect(pushSpy).toHaveBeenCalled();
    for (const call of pushSpy.mock.calls) {
      const state = String(JSON.stringify(call[0]));
      expect(state).not.toMatch(/secret-words|Synthetic test narrative/);
      expect(state).toMatch(/safeReportStep/);
    }
  });

  it('browser Back moves to the previous step and keeps the typed narrative', async () => {
    const user = userEvent.setup();
    const { continueBtn, description } = renderWizard();
    await user.type(description, VALID_TEXT);
    await user.click(continueBtn);
    expect(screen.getByRole('heading', { name: 'A few details' })).toBeTruthy();

    act(() => { window.dispatchEvent(new PopStateEvent('popstate', { state: { safeReportStep: 0 } })); });

    expect(screen.getByRole('heading', { name: 'What happened?' })).toBeTruthy();
    const restored = screen.getByRole('textbox', { name: 'Incident description' }) as HTMLTextAreaElement;
    expect(restored.value).toBe(VALID_TEXT);
  });

  it('browser Forward re-enters the pushed step', async () => {
    const user = userEvent.setup();
    const { continueBtn, description } = renderWizard();
    await user.type(description, VALID_TEXT);
    await user.click(continueBtn);
    act(() => { window.dispatchEvent(new PopStateEvent('popstate', { state: { safeReportStep: 0 } })); });
    expect(screen.getByRole('heading', { name: 'What happened?' })).toBeTruthy();

    act(() => { window.dispatchEvent(new PopStateEvent('popstate', { state: { safeReportStep: 1 } })); });
    expect(screen.getByRole('heading', { name: 'A few details' })).toBeTruthy();
    void continueBtn;
  });

  it('ignores out-of-range or malformed popstate payloads', () => {
    const { continueBtn } = renderWizard();
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: { safeReportStep: 99 } }));
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
      window.dispatchEvent(new PopStateEvent('popstate', { state: { safeReportStep: -1 } }));
      window.dispatchEvent(new PopStateEvent('popstate', { state: { safeReportStep: '1' } as unknown as number }));
    });
    // Still on the first step, nothing crashed, Continue is intact.
    expect(screen.getByRole('heading', { name: 'What happened?' })).toBeTruthy();
    expect(continueBtn).toBeInTheDocument();
  });

  it('review step shows the narrative without announcing it in history', async () => {
    const user = userEvent.setup();
    renderWizard();
    const description = screen.getByRole('textbox', { name: 'Incident description' });
    const continueBtn = screen.getByRole('button', { name: /Continue/ });
    await user.type(description, VALID_TEXT);
    await user.click(continueBtn);
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    await user.click(screen.getByRole('button', { name: /Continue/ }));

    expect(screen.getByRole('heading', { name: 'Review before submitting' })).toBeTruthy();
    expect(screen.getByText(VALID_TEXT)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Submit securely/ })).toBeTruthy();
    // Advance-only interactions were used; submission is not part of this suite.
  });
});
