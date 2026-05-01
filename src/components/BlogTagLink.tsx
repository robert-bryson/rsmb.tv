import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { createBlogTagSearch } from '../content/blogTags';

const baseClasses = 'max-w-full break-words text-xs rounded-full px-2.5 py-0.5 transition-colors';
const activeClasses = 'bg-violet-600 text-zinc-100';
const inactiveClasses = 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200';

interface BlogTagLinkProps {
  tag: string;
  active?: boolean;
  current?: boolean;
  children?: ReactNode;
}

export function BlogTagLink({ tag, active = false, current = false, children = tag }: BlogTagLinkProps) {
  return (
    <Link
      to={{ pathname: '/blog', search: createBlogTagSearch(tag) }}
      aria-current={current ? 'page' : undefined}
      className={`${baseClasses} ${active ? activeClasses : inactiveClasses}`}
    >
      {children}
    </Link>
  );
}

export function BlogAllTagsLink({ active = false }: { active?: boolean }) {
  return (
    <Link
      to="/blog"
      aria-current={active ? 'page' : undefined}
      className={`${baseClasses} ${active ? activeClasses : inactiveClasses}`}
    >
      All
    </Link>
  );
}