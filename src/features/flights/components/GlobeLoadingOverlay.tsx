interface GlobeLoadingOverlayProps {
    progress: number;
    error: Error | null;
    onRetry?: () => void;
}

/**
 * Loading overlay shown while globe textures are loading.
 */
export function GlobeLoadingOverlay({ progress, error, onRetry }: GlobeLoadingOverlayProps) {
    if (error) {
        return (
            <div className="absolute inset-0 flex items-center justify-center z-20 bg-[#000011]">
                <div className="text-center">
                    <div className="text-4xl mb-4">⚠️</div>
                    <div className="text-white/70 text-sm mb-2">Failed to load globe textures</div>
                    <div className="text-red-400/70 text-xs mb-4">{error.message}</div>
                    {onRetry && (
                        <button
                            onClick={onRetry}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors"
                        >
                            Try Again
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-[#000011]">
            <div className="text-center">
                <div className="relative w-24 h-24 mx-auto mb-4">
                    {/* Spinning globe icon */}
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-900 to-gray-900 border border-blue-500/30 animate-spin-slow" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-3xl">🌍</span>
                    </div>
                </div>
                <div className="text-white/70 text-sm mb-2">Loading globe...</div>
                <div className="w-48 h-1 bg-gray-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-purple-500 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <div className="text-gray-500 text-xs mt-2">{Math.round(progress)}%</div>
            </div>
        </div>
    );
}
