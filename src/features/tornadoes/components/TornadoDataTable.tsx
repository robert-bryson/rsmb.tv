export function TornadoDataTable({ caption, columns, rows }: {
    caption: string;
    columns: string[];
    rows: Array<Array<string | number>>;
}) {
    if (!rows.length) return null;
    return (
        <details className="mt-3 text-xs text-zinc-300">
            <summary className="min-h-11 cursor-pointer py-3 text-sky-300">View {caption.toLowerCase()}</summary>
            <div role="region" aria-label={caption} tabIndex={0} className="overflow-x-auto rounded border border-zinc-700">
                <table className="w-full whitespace-nowrap text-left tabular-nums">
                    <caption className="px-2 py-2 text-left font-medium text-zinc-100">{caption}</caption>
                    <thead><tr>{columns.map(column => <th key={column} scope="col" className="px-2 py-2 text-zinc-200">{column}</th>)}</tr></thead>
                    <tbody>{rows.map(row => <tr key={row[0]} className="border-t border-zinc-800">
                        <th scope="row" className="px-2 py-2 font-medium">{row[0]}</th>
                        {row.slice(1).map((value, index) => <td key={columns[index + 1]} className="px-2 py-2">{value}</td>)}
                    </tr>)}</tbody>
                </table>
            </div>
        </details>
    );
}
