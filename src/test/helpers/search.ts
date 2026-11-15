import { act } from '@testing-library/react';
import { vi } from 'vitest';

/** Publish the documented 400ms query debounce in tests with a controlled clock. */
export function advanceSearchCommit() {
    act(() => { vi.advanceTimersByTime(400); });
}
