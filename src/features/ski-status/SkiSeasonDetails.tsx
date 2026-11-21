import { formatArea, formatSnowDepth, type SkiUnits } from './browse';
import type { SkiArea } from './catalog';
import type { Conditions } from './conditions';
import { seasonCalendar, seasonViewDate } from './seasons';
import { SkiSeasonChart } from './SkiSeasonChart';

const sourceClass = 'ski-season-source';

function DateValue({ date }: { date?: string }) {
    return date ? <time dateTime={date}>{date}</time> : <>Unknown</>;
}

export function SkiSeasonDetails({ area, units, conditions }: { area: SkiArea; units: SkiUnits; conditions?: Conditions }) {
    const actual = seasonCalendar.byArea.get(area.id)?.actual ?? [];

    return <section aria-label="Season dates" className="border-t border-zinc-800 py-2 text-sm">
        <SkiSeasonChart area={area} date={seasonViewDate(area, conditions?.now)} units={units} conditions={conditions} />
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
