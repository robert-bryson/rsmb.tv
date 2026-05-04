export function jsonFetchResponse<T>(data: T, overrides: Partial<Response> = {}): Response {
    return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(data),
        ...overrides,
    } as Response;
}
