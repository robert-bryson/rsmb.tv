export function MapSkipLink({ targetId, label = 'Skip to controls' }: { targetId: string; label?: string }) {
  return <a href={`#${targetId}`}
    onClick={event => {
      const target = document.getElementById(targetId);
      if (target) { event.preventDefault(); target.focus({ preventScroll: true }); }
    }}
    className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-violet-600 focus:px-4 focus:py-2 focus:text-white">
    {label}
  </a>;
}
