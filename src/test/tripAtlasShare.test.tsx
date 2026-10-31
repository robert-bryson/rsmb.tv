import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TripAtlasShare } from '../features/trips/atlas/TripAtlasShare';

const url = 'https://rsmb.tv/projects/adv-atlas/map?trip=coast&panel=collapsed&camera=-123,48,7,0,0';
function navigatorApis(share?: ReturnType<typeof vi.fn>, writeText?: ReturnType<typeof vi.fn>) {
    vi.stubGlobal('navigator', Object.defineProperties(Object.create(navigator), {
        share: { value: share }, clipboard: { value: writeText ? { writeText } : undefined },
    }));
}
afterEach(() => { vi.unstubAllGlobals(); });

describe('atlas share control', () => {
    it('opens native sharing with the current view and ignores a second click while sharing', async () => {
        let finish!: () => void;
        const native = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
        navigatorApis(native);
        const getUrl = vi.fn(() => url);
        render(<TripAtlasShare getUrl={getUrl} />);
        const button = screen.getByRole('button', { name: 'Share map' });
        fireEvent.click(button);
        fireEvent.click(button);
        expect(native).toHaveBeenCalledExactlyOnceWith({ title: 'ADV Atlas', url });
        expect(getUrl).toHaveBeenCalledOnce();
        finish();
        await waitFor(() => expect(button).not.toHaveAttribute('aria-disabled'));
    });

    it('treats native cancellation as cancellation without copying or opening a fallback', async () => {
        const copy = vi.fn();
        navigatorApis(vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError')), copy);
        render(<TripAtlasShare getUrl={() => url} />);
        fireEvent.click(screen.getByRole('button', { name: 'Share map' }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Share map' })).not.toHaveAttribute('aria-disabled'));
        expect(copy).not.toHaveBeenCalled();
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it.each([false, true])('copies the link when native sharing is unavailable or fails (failure: %s)', async failed => {
        const copy = vi.fn().mockResolvedValue(undefined);
        navigatorApis(failed ? vi.fn().mockRejectedValue(new Error('Unavailable')) : undefined, copy);
        render(<TripAtlasShare getUrl={() => url} />);
        fireEvent.click(screen.getByRole('button', { name: 'Share map' }));
        await waitFor(() => expect(copy).toHaveBeenCalledExactlyOnceWith(url));
        expect(await screen.findByRole('status')).toHaveTextContent('Link copied');
    });

    it.each([false, true])('offers a selected manual link if clipboard access is absent or rejected (rejected: %s)', async rejected => {
        navigatorApis(undefined, rejected ? vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError')) : undefined);
        render(<TripAtlasShare getUrl={() => url} />);
        const button = screen.getByRole('button', { name: 'Share map' });
        fireEvent.click(button);
        const field = await screen.findByRole('textbox', { name: 'Copy this map link' });
        expect(field).toHaveValue(url);
        expect(field).toHaveFocus();
        expect((field as HTMLInputElement).selectionEnd).toBe(url.length);
        expect(button).toHaveAttribute('aria-expanded', 'true');
        fireEvent.keyDown(field, { key: 'Escape' });
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(button).toHaveFocus();
    });
});
