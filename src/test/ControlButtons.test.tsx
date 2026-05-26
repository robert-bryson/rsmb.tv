import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { ControlButtons } from '../features/flights/components/ControlButtons';

function renderControlButtons(overrides: Partial<ComponentProps<typeof ControlButtons>> = {}) {
    const props: ComponentProps<typeof ControlButtons> = {
        onResetView: vi.fn(),
        animationEnabled: true,
        onToggleAnimation: vi.fn(),
        globeRotationEnabled: false,
        onToggleGlobeRotation: vi.fn(),
        onShareUrl: vi.fn(),
        copiedUrl: false,
        ...overrides,
    };

    return render(<ControlButtons {...props} />);
}

describe('ControlButtons', () => {
    it('renders an explicit globe rotation toggle', () => {
        renderControlButtons();

        expect(screen.getByRole('button', { name: 'Rotate globe' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('calls onToggleGlobeRotation when the rotation button is clicked', () => {
        const onToggleGlobeRotation = vi.fn();
        renderControlButtons({ onToggleGlobeRotation });

        fireEvent.click(screen.getByRole('button', { name: 'Rotate globe' }));

        expect(onToggleGlobeRotation).toHaveBeenCalledOnce();
    });

    it('shows active rotation state', () => {
        renderControlButtons({ globeRotationEnabled: true });

        expect(screen.getByRole('button', { name: 'Stop globe rotation' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('disables rotation when reduced motion is active', () => {
        const onToggleGlobeRotation = vi.fn();
        renderControlButtons({ globeRotationDisabled: true, onToggleGlobeRotation });
        const button = screen.getByRole('button', { name: 'Globe rotation disabled by reduced motion preference' });

        expect(button).toBeDisabled();
        fireEvent.click(button);
        expect(onToggleGlobeRotation).not.toHaveBeenCalled();
    });
});
