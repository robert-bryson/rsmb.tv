import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GlobeErrorBoundary } from '../features/flights/components/GlobeErrorBoundary';

function ThrowingChild({ error }: { error: Error }): never {
    throw error;
}

describe('GlobeErrorBoundary', () => {
    // Suppress console.error for expected errors in tests
    const originalError = console.error;
    beforeEach(() => {
        console.error = () => { };
    });
    afterEach(() => {
        console.error = originalError;
    });

    it('renders children when no error', () => {
        render(
            <GlobeErrorBoundary>
                <div>Globe content</div>
            </GlobeErrorBoundary>
        );
        expect(screen.getByText('Globe content')).toBeInTheDocument();
    });

    it('renders error UI when child throws', () => {
        render(
            <GlobeErrorBoundary>
                <ThrowingChild error={new Error('WebGL failed')} />
            </GlobeErrorBoundary>
        );
        expect(screen.getByText('Unable to load the globe')).toBeInTheDocument();
        expect(screen.getByText('Try Again')).toBeInTheDocument();
        expect(screen.getByText('Reload Page')).toBeInTheDocument();
    });

    it('shows error details in expandable section', () => {
        render(
            <GlobeErrorBoundary>
                <ThrowingChild error={new Error('Context lost')} />
            </GlobeErrorBoundary>
        );
        expect(screen.getByText('Technical details')).toBeInTheDocument();
        expect(screen.getByText('Context lost')).toBeInTheDocument();
    });

    it('renders custom fallback when provided', () => {
        render(
            <GlobeErrorBoundary fallback={<div>Custom error</div>}>
                <ThrowingChild error={new Error('fail')} />
            </GlobeErrorBoundary>
        );
        expect(screen.getByText('Custom error')).toBeInTheDocument();
    });
});
