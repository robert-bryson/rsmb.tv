import { memo } from 'react';

/**
 * Skeleton loading state for the globe visualization.
 */
export const LoadingSkeleton = memo(function LoadingSkeleton() {
    return (
        <div className="absolute inset-0 flex items-center justify-center z-10">
            {/* Skeleton globe */}
            <div className="relative">
                <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 animate-pulse border border-gray-700/50 shadow-2xl shadow-blue-500/10" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-3xl mb-2">🌍</div>
                        <div className="text-white/70 text-sm">Loading flights...</div>
                    </div>
                </div>
                {/* Fake route lines */}
                <div className="absolute top-1/4 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent animate-pulse" />
                <div className="absolute top-1/2 left-1/3 w-1/3 h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent animate-pulse" style={{ transform: 'rotate(-30deg)' }} />
            </div>
        </div>
    );
});
