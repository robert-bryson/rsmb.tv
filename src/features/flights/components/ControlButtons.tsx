interface ControlButtonsProps {
    onResetView: () => void;
    animationEnabled: boolean;
    onToggleAnimation: () => void;
    onShareUrl: () => void;
    copiedUrl: boolean;
}

/**
 * Bottom-right control buttons for the globe visualization.
 */
export function ControlButtons({
    onResetView,
    animationEnabled,
    onToggleAnimation,
    onShareUrl,
    copiedUrl,
}: ControlButtonsProps) {
    return (
        <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-20">
            {/* Reset View */}
            <button
                onClick={onResetView}
                className="bg-gray-900/90 backdrop-blur p-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800/90 transition-colors"
                title="Reset view (R)"
                aria-label="Reset globe view to default position"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v5h5" />
                </svg>
            </button>

            {/* Animation Toggle */}
            <button
                onClick={onToggleAnimation}
                className={`bg-gray-900/90 backdrop-blur p-2 rounded-lg border transition-colors ${animationEnabled
                        ? 'border-purple-500/50 text-purple-400 hover:bg-purple-900/30'
                        : 'border-gray-700 text-gray-500 hover:text-gray-300 hover:bg-gray-800/90'
                    }`}
                title={animationEnabled ? 'Pause animations' : 'Play animations'}
                aria-label={animationEnabled ? 'Pause flight animations' : 'Play flight animations'}
                aria-pressed={animationEnabled}
            >
                {animationEnabled ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                    </svg>
                ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                    </svg>
                )}
            </button>

            {/* Share URL */}
            <button
                onClick={onShareUrl}
                className={`bg-gray-900/90 backdrop-blur p-2 rounded-lg border transition-colors ${copiedUrl
                        ? 'border-green-500/50 text-green-400'
                        : 'border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800/90'
                    }`}
                title={copiedUrl ? 'URL copied!' : 'Copy URL to share'}
                aria-label="Copy current view URL to clipboard"
            >
                {copiedUrl ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                )}
            </button>
        </div>
    );
}
