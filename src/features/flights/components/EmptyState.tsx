interface EmptyStateProps {
  selectedYear: number | null;
  selectedAirline: string | null;
  selectedAirport: string | null;
  onClearFilters: () => void;
}

export function EmptyState({
  selectedYear,
  selectedAirline,
  selectedAirport,
  onClearFilters,
}: EmptyStateProps) {
  const hasFilters = selectedYear !== null || selectedAirline !== null || selectedAirport !== null;

  if (!hasFilters) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
      <div className="bg-gray-900/95 backdrop-blur rounded-xl border border-gray-700 p-6 max-w-sm mx-4 text-center pointer-events-auto">
        <div className="text-4xl mb-3">🔍</div>
        <h3 className="text-white font-semibold mb-2">No flights found</h3>
        <p className="text-gray-400 text-sm mb-4">
          {selectedYear && selectedAirline && (
            <>
              No flights in <span className="text-purple-400">{selectedYear}</span> with{' '}
              <span className="text-orange-400">{selectedAirline}</span>
            </>
          )}
          {selectedYear && !selectedAirline && (
            <>
              No flights found in <span className="text-purple-400">{selectedYear}</span>
            </>
          )}
          {!selectedYear && selectedAirline && (
            <>
              No flights found with <span className="text-orange-400">{selectedAirline}</span>
            </>
          )}
          {selectedAirport && (
            <>
              {' '}
              through <span className="text-cyan-400">{selectedAirport}</span>
            </>
          )}
        </p>
        <button
          onClick={onClearFilters}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors"
        >
          Clear Filters
        </button>
      </div>
    </div>
  );
}
