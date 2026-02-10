/**
 * Skip link for keyboard users to bypass the complex globe visualization.
 * Visually hidden until focused.
 */
export function SkipLink() {
    const handleClick = () => {
        // Find the stats panel button and focus it
        const statsButton = document.querySelector('[data-skip-target="stats"]') as HTMLElement;
        if (statsButton) {
            statsButton.focus();
            return;
        }

        // Fallback: find any focusable element after the globe
        const focusable = document.querySelector('.skip-target') as HTMLElement;
        if (focusable) {
            focusable.focus();
        }
    };

    return (
        <a
            href="#main-content"
            onClick={(e) => {
                e.preventDefault();
                handleClick();
            }}
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-purple-600 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
        >
            Skip to controls
        </a>
    );
}
