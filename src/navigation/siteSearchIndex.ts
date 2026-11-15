import type { SiteSearchDocument } from '../content/siteSearch';
import { moduleLoader } from './moduleLoader';

/** Fetch plain text on search intent, keeping article and map code out of search. */
export const loadSiteSearchIndex: () => Promise<SiteSearchDocument[]> = moduleLoader(
    () => import('virtual:site-search').then(module => module.documents),
);
