import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function PostFilterLink({ to, active, children }: { to: string; active: boolean; children: ReactNode }) {
    return <Link to={to} aria-current={active ? 'page' : undefined}
        className={`max-w-full break-words rounded-full px-2.5 py-0.5 text-xs transition-colors ${active
            ? 'bg-violet-600 text-zinc-100'
            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'}`}>
        {children}
    </Link>;
}
