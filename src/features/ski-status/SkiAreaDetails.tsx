import { columns, formatSkiStat, type SkiUnits } from './browse';
import { passNames, passSeason, type SkiArea } from './catalog';

const linkClass = 'inline-flex min-h-11 items-center text-cyan-300 underline decoration-cyan-700 underline-offset-4 hover:text-cyan-100';

export function SkiAreaDetails({ area, units, onClose }: { area: SkiArea; units: SkiUnits; onClose: () => void }) {
    const stats = columns.slice(2).map(({ key, label }) => ({ label, value: formatSkiStat(area, key, units) }));
    const region = area.region.replace('/', ' / ');
    return <section id="ski-area-details" tabIndex={-1} aria-labelledby="ski-area-name" className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
                <h2 id="ski-area-name" className="text-xl font-semibold text-zinc-100">{area.name}</h2>
                <p className="text-sm text-zinc-300">{area.locality}, {region}</p>
            </div>
            <button type="button" onClick={onClose} className="min-h-11 px-2 text-sm text-zinc-300 underline underline-offset-4 hover:text-white">Close details</button>
        </div>
        <div className="flex flex-wrap gap-x-5 text-sm">
            <a className={linkClass} href={area.website}>Resort website</a>
            {area.reportUrl && <a className={linkClass} href={area.reportUrl}>Official conditions</a>}
            {area.statsUrl && <a className={linkClass} href={area.statsUrl}>Mountain stats source</a>}
            {area.additionalSources?.map((url, index) => <a key={url} className={linkClass} href={url}>Additional source {index + 1}</a>)}
        </div>
        <dl className="grid grid-cols-2 gap-3 border-t border-zinc-800 pt-3 text-sm sm:grid-cols-3 xl:grid-cols-6">
            {stats.map(({ label, value }) => <div key={label}>
                <dt className="text-zinc-400">{label}</dt>
                <dd className="mt-0.5 tabular-nums text-zinc-100">{value ?? 'Unknown'}</dd>
            </div>)}
            <div>
                <dt className="text-zinc-400">Published season window</dt>
                <dd className="mt-0.5 text-zinc-100">{area.seasonWindow ?? 'Unknown'}</dd>
            </div>
        </dl>
        {area.grades && <div className="mt-4 border-t border-zinc-800 pt-3">
            <h3 className="text-sm font-medium text-zinc-200">Published difficulty{area.grades.of ? ` by ${area.grades.of}` : ''}</h3>
            <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">{Object.entries(area.grades.values).map(([label, value]) => <div key={label}>
                <dt className="text-zinc-400">{label}</dt><dd className="tabular-nums text-zinc-100">{value}{area.grades?.unit === 'percent' ? '%' : ''}</dd>
            </div>)}</dl>
        </div>}
        {area.passes.length > 0 && <div className="mt-4 border-t border-zinc-800 pt-3">
            <h3 className="text-sm font-medium text-zinc-200">{passSeason} pass access</h3>
            <ul className="flex flex-wrap gap-x-5 text-sm">{area.passes.map(pass => <li key={pass.family}>
                <a className={linkClass} href={pass.source}>{passNames[pass.family]}{pass.access === 'discount' ? ' (discount only)' : ''}</a>
            </li>)}</ul>
        </div>}
    </section>;
}
