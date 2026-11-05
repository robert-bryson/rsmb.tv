import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { retryCurrentPage } from '../utils/pageRecovery';

vi.mock('../utils/pageRecovery', () => ({ retryCurrentPage: vi.fn() }));
afterEach(() => vi.restoreAllMocks());
function BrokenPage(): never { throw new Error('Page chunk failed'); }

describe('page error boundary', () => {
    it('renders a healthy page', () => {
        render(<ErrorBoundary><p>Ready</p></ErrorBoundary>);
        expect(screen.getByText('Ready')).toBeVisible();
    });
    it.each([true, false])('offers document recovery and retains an escape link (reload allowed: %s)', allowed => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.mocked(retryCurrentPage).mockReturnValue(allowed);
        render(<MemoryRouter><ErrorBoundary><BrokenPage /></ErrorBoundary></MemoryRouter>);
        expect(screen.getByRole('alert')).toHaveTextContent('This page could not load');
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(retryCurrentPage).toHaveBeenCalled();
        expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/');
        if (!allowed) expect(screen.getByRole('alert')).toHaveTextContent('Wait a minute');
        expect(log).toHaveBeenCalled();
    });
});
