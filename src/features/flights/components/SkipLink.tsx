/**
 * Skip link for keyboard users to bypass the complex globe visualization.
 * Visually hidden until focused.
 */
export function SkipLink() {
    return (
        <a
            href="#flight-stats-toggle"
            onClick={(e) => {
                const target = document.getElementById('flight-stats-toggle');
                if (target) {
                    e.preventDefault();
                    target.focus({ preventScroll: true });
                }
            }}
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-purple-600 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
        >
            Skip to controls
        </a>
    );
}
