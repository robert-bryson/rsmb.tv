import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/** Compose same-event edits, including a route selection that also opens the panel. */
export function useAtlasUrlState() {
    const location = useLocation();
    const navigate = useNavigate();
    const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const pending = useRef<URLSearchParams | undefined>(undefined);
    useLayoutEffect(() => { pending.current = undefined; }, [params]);
    const getParams = useCallback(() => new URLSearchParams(pending.current ?? params), [params]);
    const updateParams = useCallback((edit: (next: URLSearchParams) => URLSearchParams | void, replace = true) => {
        const next = getParams();
        const result = edit(next) ?? next;
        if (result.toString() === (pending.current ?? params).toString()) return result;
        pending.current = result;
        void navigate({ pathname: location.pathname, search: `?${result}`, hash: location.hash }, {
            replace, state: location.state, preventScrollReset: true,
        });
        return result;
    }, [getParams, params, location.pathname, location.hash, location.state, navigate]);
    return { params, getParams, updateParams };
}
