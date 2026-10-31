import { Component, type ReactNode } from 'react';

/** Isolate renderer-module failures while the atlas list stays available. */
export class TripAtlasMapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() { return { failed: true }; }

    render() {
        if (this.state.failed) return (
            <div role="alert" className="absolute left-3 right-14 top-20 z-10 max-h-[calc(100%-7rem)] max-w-xs overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-5 text-sm text-zinc-200">
                <p>The map could not load. You can still browse the trips and read their reports.</p>
                <button type="button" onClick={() => window.location.reload()} className="mt-3 min-h-11 text-violet-300 underline">Reload map</button>
            </div>
        );
        return this.props.children;
    }
}
