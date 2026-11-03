import { useState } from 'react';
import { useClimateTrends } from '../hooks/useClimateTrends';
import { RecordAgeChart } from './RecordAgeChart';
import { RecordsBrokenTimeSeries } from './RecordsBrokenTimeSeries';
import { HighLowRatioChart } from './HighLowRatioChart';
import type { HighlightRange } from '../types';

export default function TemperatureTrendsDrawer({ isMobile, closeTrends, setHighlightRange, selectedDecade, handleSelectDecade }: {
    isMobile: boolean;
    closeTrends: () => void;
    setHighlightRange: (range: HighlightRange | null) => void;
    selectedDecade: number | null;
    handleSelectDecade: (decade: number | null) => void;
}) {
    const { trends, loading: trendsLoading, error: trendsError } = useClimateTrends();
    return (
        <div
            className="absolute bottom-0 left-0 right-0 z-30 bg-zinc-900/95 backdrop-blur-sm border-t border-zinc-700/50 flex flex-col"
            style={{ height: isMobile ? '50%' : '35%', minHeight: 220 }}
        >
            {/* Drawer header */}
            <div className="shrink-0 flex items-center justify-between px-4 py-1.5 border-b border-zinc-800">
                <h2 className="text-sm font-semibold text-zinc-200">Standing Record Ages</h2>
                <button
                    onClick={closeTrends}
                    className="text-zinc-400 hover:text-zinc-200 w-11 h-11 flex items-center justify-center rounded hover:bg-zinc-800 transition-colors text-sm"
                    aria-label="Close trends panel"
                >
                    ✕
                </button>
            </div>

            {trendsError ? (
                <div className="flex-1 flex items-center justify-center px-4 text-center">
                    <div>
                        <p className="text-sm font-medium text-zinc-200">Failed to load trends</p>
                        <p className="mt-1 text-xs text-zinc-500">{trendsError}</p>
                    </div>
                </div>
            ) : trendsLoading || !trends ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex items-center gap-2.5">
                        <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
                        <span className="text-zinc-400 text-sm">Loading trends…</span>
                    </div>
                </div>
            ) : isMobile ? (
                <MobileTrendsDrawer
                    trends={trends}
                    setHighlightRange={setHighlightRange}
                    selectedDecade={selectedDecade}
                    handleSelectDecade={handleSelectDecade}
                />
            ) : (
                <div className="flex-1 min-h-0 flex gap-1 px-2 py-1.5">
                    <div className="flex-1 min-w-0 flex flex-col">
                        <span className="text-xs text-zinc-400 px-1 mb-0.5 shrink-0">Record Age</span>
                        <div className="flex-1 min-h-0">
                            <RecordAgeChart data={trends.byDecade} onHoverPeriod={setHighlightRange} selectedDecade={selectedDecade} onSelectDecade={handleSelectDecade} compact />
                        </div>
                    </div>
                    <div className="w-px bg-zinc-800 shrink-0" />
                    <div className="flex-1 min-w-0 flex flex-col">
                        <span className="text-xs text-zinc-400 px-1 mb-0.5 shrink-0">Survivors by Year Set</span>
                        <div className="flex-1 min-h-0">
                            <RecordsBrokenTimeSeries data={trends.byYear} onHoverPeriod={setHighlightRange} selectedDecade={selectedDecade} onSelectDecade={handleSelectDecade} compact />
                        </div>
                    </div>
                    <div className="w-px bg-zinc-800 shrink-0" />
                    <div className="flex-1 min-w-0 flex flex-col">
                        <span className="text-xs text-zinc-400 px-1 mb-0.5 shrink-0">H:L Ratio</span>
                        <div className="flex-1 min-h-0">
                            <HighLowRatioChart decadeData={trends.byDecade} rollingData={trends.rollingRatio} onHoverPeriod={setHighlightRange} selectedDecade={selectedDecade} onSelectDecade={handleSelectDecade} compact />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/** Mobile trends drawer — swipeable tabs instead of side-by-side charts */
function MobileTrendsDrawer({ trends, setHighlightRange, selectedDecade, handleSelectDecade }: {
    trends: { byDecade: import('../types').DecadeData[]; byYear: import('../types').YearData[]; rollingRatio: import('../types').RollingRatioData[] };
    setHighlightRange: (range: HighlightRange | null) => void;
    selectedDecade: number | null;
    handleSelectDecade: (decade: number | null) => void;
}) {
    const [activeTab, setActiveTab] = useState<'age' | 'freq' | 'ratio'>('age');

    return (
        <>
            <div className="flex border-b border-zinc-800 shrink-0">
                {([['age', 'Record Age'], ['freq', 'Survivors/Year'], ['ratio', 'Surviving H:L']] as const).map(([id, label]) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`flex-1 px-2 py-1.5 text-[11px] transition-colors ${activeTab === id
                            ? 'text-violet-400 border-b-2 border-violet-400'
                            : 'text-zinc-400 hover:text-zinc-300'
                            }`}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <div className="flex-1 min-h-0 px-2 py-1.5">
                {activeTab === 'age' && (
                    <RecordAgeChart data={trends.byDecade} onHoverPeriod={setHighlightRange} selectedDecade={selectedDecade} onSelectDecade={handleSelectDecade} compact />
                )}
                {activeTab === 'freq' && (
                    <RecordsBrokenTimeSeries data={trends.byYear} onHoverPeriod={setHighlightRange} selectedDecade={selectedDecade} onSelectDecade={handleSelectDecade} compact />
                )}
                {activeTab === 'ratio' && (
                    <HighLowRatioChart decadeData={trends.byDecade} rollingData={trends.rollingRatio} onHoverPeriod={setHighlightRange} selectedDecade={selectedDecade} onSelectDecade={handleSelectDecade} compact />
                )}
            </div>
        </>
    );
}
