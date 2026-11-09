/** Only the selected view changes the startup data; camera and filter changes do not. */
export function temperatureDataView(search: string) {
    const view = new URLSearchParams(search).get('view');
    return view === 'county' || view === 'state' || view === 'freshness' ? view : 'recent';
}
