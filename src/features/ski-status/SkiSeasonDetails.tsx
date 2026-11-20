import { formatArea, formatSnowDepth, type SkiUnits } from './browse';
import type { SkiArea } from './catalog';
import { seasonCalendar, seasonViewDate, upcomingSeasonPlan } from './seasons';

const sourceClass = 'text-cyan-300 underline decoration-cyan-700 underline-offset-4 hover:text-cyan-100';

function DateValue({ date }: { date?: string }) {
    return date ? <time dateTime={date}>{date}</time> : <>Unknown</>;
}

export function SkiSeasonDetails({ area, units, now }: { area: SkiArea; units: SkiUnits; now?: number }) {
    const entry = seasonCalendar.byArea.get(area.id);
    if (!entry) return null;
    const { typical, actual } = entry;
    const latestPlan = upcomingSeasonPlan(entry, seasonViewDate(area, now));
    if (!typical && !latestPlan && !actual.length) return null;

    return <section aria-label="Season dates" className="border-t border-zinc-800 py-2 text-sm">
        {typical && <p>
            <strong>Typical season</strong>{' · '}
            {'count' in typical.evidence ? <>
                {typical.opening} to {typical.closing}{' · '}
                Median of {typical.evidence.count} seasons through {typical.evidence.latest}
            </> : <>
                {typical.evidence.note ?? `${typical.opening} to ${typical.closing}`}{' · '}
                <a className={sourceClass} href={seasonCalendar.sources[typical.evidence.source]}>Season source</a>
            </>}
        </p>}
        {latestPlan && <p className="mt-1">
            <strong>Planned {latestPlan.season}</strong>
            {latestPlan.opensOn && <> · Opens <DateValue date={latestPlan.opensOn} /></>}
            {latestPlan.closesOn && <> · Closes <DateValue date={latestPlan.closesOn} /></>}
            {(latestPlan.opensOn || !latestPlan.closingSource) && <>
                {' · '}<a className={sourceClass} href={seasonCalendar.sources[latestPlan.source]}>Schedule</a>
            </>}
            {latestPlan.closesOn && latestPlan.closingSource && <>
                {' · '}<a className={sourceClass} href={seasonCalendar.sources[latestPlan.closingSource]}>Closing schedule</a>
            </>}
            {latestPlan.note && <span className="block text-zinc-300">{latestPlan.note}</span>}
        </p>}
        {actual.length > 0 && <details className="py-1">
            <summary className="min-h-10 cursor-pointer py-2.5 text-zinc-200 hover:text-cyan-300">Opening and closing history</summary>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                    <caption className="sr-only">Recorded ski seasons</caption>
                    <thead className="text-zinc-400"><tr>
                        {['Season', 'Opened', 'Closed', 'Opening-day terrain', 'Source'].map(label => <th key={label}
                            scope="col" className="p-1 font-medium">{label}</th>)}
                    </tr></thead>
                    <tbody>{actual.map(row => {
                        const terrain = row.openingTerrain;
                        const measures = terrain && [
                            terrain.lifts === undefined ? undefined : `${terrain.lifts} ${terrain.lifts === 1 ? 'lift' : 'lifts'}`,
                            terrain.trails === undefined ? undefined : `${terrain.trails} ${terrain.trails === 1 ? 'trail' : 'trails'}`,
                            terrain.acres === undefined ? undefined : formatArea(terrain.acres, units),
                            terrain.baseCm === undefined ? undefined : `${formatSnowDepth(terrain.baseCm, units)} base`,
                        ].filter(Boolean).join(' · ');
                        return <tr key={row.season} className="border-t border-zinc-800 align-top">
                            <th scope="row" className="p-1 font-medium">{row.season}</th>
                            <td className="whitespace-nowrap p-1 tabular-nums"><DateValue date={row.opensOn} /></td>
                            <td className="whitespace-nowrap p-1 tabular-nums"><DateValue date={row.closesOn} /></td>
                            <td className="p-1">{measures ?? 'Unknown'}</td>
                            <td className="p-1">
                                <a className={sourceClass} href={seasonCalendar.sources[row.source]}>{row.closingSource ? 'Opening' : 'Record'}</a>
                                {row.closingSource && <> · <a className={sourceClass} href={seasonCalendar.sources[row.closingSource]}>Closing</a></>}
                                {row.note && <p className="text-zinc-300">{row.note}</p>}
                            </td>
                        </tr>;
                    })}</tbody>
                </table>
            </div>
        </details>}
    </section>;
}
