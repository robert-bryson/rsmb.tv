import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TripAnimation } from '../../../src/features/trips/components/TripAnimation';
import { TripStoryProvider } from '../../../src/features/trips/TripStoryProvider';
import kalaloch from '../../../src/content/trips/kalaloch-2024.json';
import '../../../src/index.css';

export function TripAnimationFixture() {
    return <main className="mx-auto max-w-3xl px-6">
        <h1 className="min-h-screen">Trip animation</h1>
        <TripStoryProvider manifest={kalaloch}>
            {kalaloch.animations.map(animation => <TripAnimation key={animation.id} animationId={animation.id} />)}
        </TripStoryProvider>
        <p className="min-h-screen" data-after-animation>End of animation fixture.</p>
    </main>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><TripAnimationFixture /></StrictMode>);
