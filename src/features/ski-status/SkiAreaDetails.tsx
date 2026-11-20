import { columns, formatSkiLocation, formatSkiStat, type SkiUnits } from './browse';
import { passNames, passSeason, type SkiArea } from './catalog';
import { SkiPassIcon } from './SkiPassIcon';

const linkClass = 'inline-flex min-h-11 items-center text-cyan-300 underline decoration-cyan-700 underline-offset-4 hover:text-cyan-100';
const passAccessNotes = { included: '', discount: ' (discount only)', listed: ' (lift access unconfirmed)' };
const detailColumns = columns.slice(2);
const seasonLabel = 'Published season window';
const difficultyLabel = 'Published difficulty';
const statisticLabels = new Map<string, string>([
    ...detailColumns.map(({ key, label }) => [key, label] as const),
    ['seasonWindow', seasonLabel], ['grades', difficultyLabel],
    ['acresQualifier', 'Skiable area lower bound'], ['trailCountQualifier', 'Trail count lower bound'],
    ['nightAcresQualifier', 'Night area lower bound'],
]);

function detailSourceLinks(area: SkiArea) {
    const seen = new Set<string>();
    const links: { url: string; label: string }[] = [];
    const addLink = (url: string | undefined, label: string) => {
        if (!url || seen.has(url)) return;
        seen.add(url);
        links.push({ url, label });
    };
    addLink(area.website, area.website === area.reportUrl ? 'Resort website and conditions' : 'Resort website');
    addLink(area.reportUrl, 'Official conditions');
    for (const pass of area.passes) seen.add(pass.source);
    for (const group of area.statSources ?? []) seen.add(group.source);
    addLink(area.statsUrl, 'Mountain stats source');
    addLink(area.location.mappedTerrain?.source, 'OpenSkiMap terrain');
    let extra = 0;
    for (const url of area.additionalSources ?? []) {
        if (seen.has(url)) continue;
        addLink(url, `Additional source ${++extra}`);
    }
    return links;
}

export function SkiAreaDetails({ area, units, onClose }: { area: SkiArea; units: SkiUnits; onClose: () => void }) {
    const stats = detailColumns.flatMap(({ key, label }) => {
        const value = formatSkiStat(area, key, units);
        return value === undefined && key.startsWith('mapped') ? [] : [{ key, label, value }];
    });
    return <section id="ski-area-details" tabIndex={-1} aria-labelledby="ski-area-name" className="bg-zinc-950 px-3 py-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
                <h2 id="ski-area-name" className="text-xl font-semibold text-zinc-100">{area.name}</h2>
                <p className="text-sm text-zinc-300">{formatSkiLocation(area)}</p>
            </div>
            <button type="button" onClick={onClose} className="min-h-11 px-2 text-sm text-zinc-300 underline underline-offset-4 hover:text-white">Close details</button>
        </div>
        <div className="flex flex-wrap gap-x-5 text-sm">
            {detailSourceLinks(area).map(({ url, label }) => <a key={url} className={linkClass} href={url}>{label}</a>)}
        </div>
        {area.statSources && area.statSources.length > 0 && <details className="border-t border-zinc-800 text-sm">
            <summary className="min-h-11 cursor-pointer py-3 text-zinc-200 hover:text-cyan-300 focus-visible:outline-2 focus-visible:outline-cyan-300">
                Published statistic sources
            </summary>
            <ul className="space-y-2 pb-3">{area.statSources.map(({ fields, source, checkedOn, note }) => <li key={fields[0]}>
                <a className={linkClass} href={source}>{fields.map(field => statisticLabels.get(field) ?? field).join(', ')}</a>
                <p className="text-zinc-400">Checked <time dateTime={checkedOn}>{checkedOn}</time></p>
                {note && <p className="text-zinc-300">{note}</p>}
            </li>)}</ul>
        </details>}
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))] gap-3 border-t border-zinc-800 pt-3 text-sm">
            {stats.map(({ key, label, value }) => <div key={key}>
                <dt className="text-zinc-400">{label}</dt>
                <dd className="mt-0.5 tabular-nums text-zinc-100">{value ?? 'Unknown'}</dd>
            </div>)}
            <div>
                <dt className="text-zinc-400">{seasonLabel}</dt>
                <dd className="mt-0.5 text-zinc-100">{area.seasonWindow ?? 'Unknown'}</dd>
            </div>
        </dl>
        {area.grades && <div className="mt-4 border-t border-zinc-800 pt-3">
            <h3 className="text-sm font-medium text-zinc-200">{difficultyLabel}{area.grades.of ? ` by ${area.grades.of}` : ''}</h3>
            <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">{Object.entries(area.grades.values).map(([label, value]) => <div key={label}>
                <dt className="text-zinc-400">{label}</dt><dd className="tabular-nums text-zinc-100">{value}{area.grades?.unit === 'percent' ? '%' : ''}</dd>
            </div>)}</dl>
        </div>}
        {area.passes.length > 0 && <div className="mt-4 border-t border-zinc-800 pt-3">
            <h3 className="text-sm font-medium text-zinc-200">{passSeason} pass access</h3>
            <ul className="flex flex-wrap gap-x-5 text-sm">{area.passes.map(pass => <li key={pass.family}>
                <a className={`${linkClass} gap-2`} href={pass.source}>
                    <SkiPassIcon family={pass.family} />{passNames[pass.family]}{passAccessNotes[pass.access]}
                </a>
            </li>)}</ul>
        </div>}
    </section>;
}
