import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '../components/ErrorBoundary';

/**
 * A render-time error must not blank the page silently — and it must not
 * remove the safety controls that let a person in danger leave the site.
 */
describe('ErrorBoundary', () => {
  function Boom(): JSX.Element {
    throw new Error('render failure');
  }

  it('renders a recovery message instead of an empty page', () => {
    // React logs the caught error; keep the test output clean.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    spy.mockRestore();
  });

  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
  });
});
