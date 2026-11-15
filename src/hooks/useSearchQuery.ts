import { useId, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useLocation, useNavigationType, useSearchParams } from 'react-router-dom';
import { withSearchQuery } from '../utils/search';
import { withoutSiteSearchQuery } from '../navigation/siteSearchMatch';

const OWNER_STATE_KEY = '__rsmbSearchOwner';
const QUERY_COMMIT_DELAY_MS = 400;

interface PendingQuery {
    params: URLSearchParams;
    timer: number;
}

function cancelPendingQuery(pending: RefObject<PendingQuery | null>) {
    if (!pending.current) return;
    window.clearTimeout(pending.current.timer);
    pending.current = null;
}

interface SearchDraft {
    search: string;
    locationKey: string;
    pendingRevisions: readonly number[];
}

function navigationState(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
}

/** Keep typing urgent while the router commits shareable URL changes in a transition. */
export function useSearchQuery() {
    const location = useLocation();
    const navigation = useNavigationType();
    const [urlParams, setSearchParams] = useSearchParams();
    const owner = useId();
    const writeRevision = useRef(0);
    const pendingQuery = useRef<PendingQuery | null>(null);
    const [draft, setDraft] = useState<SearchDraft>({
        search: urlParams.toString(), locationKey: location.key,
        pendingRevisions: [],
    });
    const urlSearch = urlParams.toString();
    useLayoutEffect(() => {
        if (draft.locationKey === location.key) return;
        const write = navigationState(navigationState(location.state)[OWNER_STATE_KEY]);
        const revision = write.revision;
        const ownWrite = navigation !== 'POP' && write.navigation === navigation && write.owner === owner
            && write.search === urlSearch && typeof revision === 'number'
            && draft.pendingRevisions.includes(revision);
        if (!ownWrite) cancelPendingQuery(pendingQuery);
        // Router renders can be abandoned. Reconcile only committed locations, before paint.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDraft(current => ({
            search: ownWrite ? current.search : urlSearch,
            locationKey: location.key,
            pendingRevisions: ownWrite ? current.pendingRevisions.filter(pending => pending !== revision) : [],
        }));
    }, [draft.locationKey, draft.pendingRevisions, location.key, location.state, navigation, owner, urlSearch]);
    useLayoutEffect(() => {
        const cancel = () => cancelPendingQuery(pendingQuery);
        window.addEventListener('popstate', cancel);
        return () => { window.removeEventListener('popstate', cancel); cancel(); };
    }, []);
    const searchParams = new URLSearchParams(draft.search);
    const query = searchParams.get('q') ?? '';

    function writeParams(params: URLSearchParams, replace: boolean) {
        const revision = ++writeRevision.current;
        const nextSearch = params.toString();
        setDraft(previous => ({ ...previous, search: nextSearch, pendingRevisions: [...previous.pendingRevisions, revision] }));
        const state = navigationState(withoutSiteSearchQuery(location.state));
        // Editing starts a new list view. Preserve context, but end return-scroll correction.
        delete state.restoreScroll;
        state[OWNER_STATE_KEY] = { owner, revision, search: nextSearch, navigation: replace ? 'REPLACE' : 'PUSH' };
        setSearchParams(params, { replace, preventScrollReset: true, state });
    }

    function updateQuery(value: string) {
        const params = withSearchQuery(searchParams, value);
        cancelPendingQuery(pendingQuery);
        setDraft(current => ({ ...current, search: params.toString() }));
        pendingQuery.current = { params, timer: window.setTimeout(commitQuery, QUERY_COMMIT_DELAY_MS) };
    }

    function commitQuery() {
        const pending = pendingQuery.current;
        if (!pending) return;
        cancelPendingQuery(pendingQuery);
        writeParams(pending.params, true);
    }

    function clearFilters() {
        commitQuery();
        writeParams(new URLSearchParams(), false);
    }

    const returnSearch = withSearchQuery(searchParams, query).toString();
    const returnUrl = `${location.pathname}${returnSearch ? `?${returnSearch}` : ''}`;
    return { query, updateQuery, commitQuery, clearFilters, searchParams, returnUrl };
}
