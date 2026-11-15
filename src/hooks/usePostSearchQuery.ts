import { useId, useState } from 'react';
import { useLocation, useNavigationType, useSearchParams } from 'react-router-dom';
import { withPostSearchQuery } from '../content/postFilters';

const OWNER_STATE_KEY = '__rsmbPostSearchOwner';

function navigationState(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
}

/** Keep typing urgent while the router commits shareable URL changes in a transition. */
export function usePostSearchQuery() {
    const location = useLocation();
    const navigation = useNavigationType();
    const [searchParams, setSearchParams] = useSearchParams();
    const owner = useId();
    const [draft, setDraft] = useState({ query: searchParams.get('q') ?? '', locationKey: location.key });
    let query = draft.query;
    if (draft.locationKey !== location.key) {
        // A delayed commit from this input must not replace newer typed text.
        // Back, Forward, and other links always restore their own query.
        const ownWrite = navigation !== 'POP' && navigationState(location.state)[OWNER_STATE_KEY] === owner;
        query = ownWrite ? draft.query : searchParams.get('q') ?? '';
        setDraft({ query, locationKey: location.key });
    }

    function writeParams(params: URLSearchParams, replace: boolean) {
        const state = navigationState(location.state);
        // Editing starts a new list view. Preserve context, but end return-scroll correction.
        delete state.restoreScroll;
        delete state[OWNER_STATE_KEY];
        if (replace) state[OWNER_STATE_KEY] = owner;
        setSearchParams(params, { replace, preventScrollReset: true, state });
    }

    function updateQuery(value: string) {
        setDraft({ query: value, locationKey: location.key });
        writeParams(withPostSearchQuery(searchParams, value), true);
    }

    function clearFilters() {
        setDraft({ query: '', locationKey: location.key });
        writeParams(new URLSearchParams(), false);
    }

    const search = withPostSearchQuery(searchParams, query).toString();
    const returnUrl = `${location.pathname}${search ? `?${search}` : ''}`;
    return { query, updateQuery, clearFilters, searchParams, returnUrl };
}
