import { afterEach, describe, expect, it, vi } from 'vitest'
import { captureAnalyticsException, initializeUmamiAnalytics, sanitizeAnalyticsPayload, trackAnalyticsEvent } from '../utils/analytics'

describe('initializeUmamiAnalytics', () => {
    afterEach(() => {
        document.getElementById('umami-analytics')?.dispatchEvent(new Event('error'))
        document.getElementById('umami-analytics')?.remove()
        localStorage.removeItem('umami.disabled')
        vi.unstubAllGlobals()
    })

    it('adds the configured deferred tracker to the document head in production', () => {
        initializeUmamiAnalytics({ hostname: 'www.rsmb.tv' })

        const script = document.querySelector<HTMLScriptElement>('#umami-analytics')
        expect(script).not.toBeNull()
        expect(script?.parentElement).toBe(document.head)
        expect(script?.defer).toBe(true)
        expect(script?.src).toBe('https://cloud.umami.is/script.js')
        expect(script?.dataset).toMatchObject({
            websiteId: 'a7ba7f9f-4aa2-4264-aa0e-602ffd2ac4e2',
            domains: 'www.rsmb.tv',
            excludeSearch: 'true',
            doNotTrack: 'true',
            performance: 'true',
            tag: 'rsmb-tv',
            excludeHash: 'true',
            errors: 'true',
            beforeSend: 'rsmbAnalyticsBeforeSend',
            environment: 'production',
        })
    })

    it('does not track development hosts or an unconfigured site', () => {
        initializeUmamiAnalytics({ websiteId: 'website-id', hostname: 'localhost' })
        initializeUmamiAnalytics({ websiteId: '', hostname: 'www.rsmb.tv' })

        expect(document.getElementById('umami-analytics')).toBeNull()
    })

    it('does not add the tracker more than once', () => {
        initializeUmamiAnalytics({ websiteId: 'website-id', hostname: 'www.rsmb.tv' })
        initializeUmamiAnalytics({ websiteId: 'website-id', hostname: 'www.rsmb.tv' })

        expect(document.querySelectorAll('#umami-analytics')).toHaveLength(1)
    })

    it('queues bounded events until the tracker loads and retains the original route', () => {
        initializeUmamiAnalytics({ hostname: 'www.rsmb.tv' })
        const location = { hostname: 'www.rsmb.tv', pathname: '/projects/flights/map' }
        const target = { location, umami: undefined as undefined | { track: ReturnType<typeof vi.fn> } }
        vi.stubGlobal('window', target)
        for (let index = 0; index < 10; index++) trackAnalyticsEvent('map-ready', { durationMs: index })
        location.pathname = '/about'
        target.umami = { track: vi.fn() }
        document.getElementById('umami-analytics')!.dispatchEvent(new Event('load'))
        expect(target.umami.track).toHaveBeenCalledTimes(8)
        const payload = target.umami.track.mock.calls[0][0]({ url: '/about?private=value' })
        expect(payload).toMatchObject({ name: 'map-ready', url: '/projects/flights/map', data: { durationMs: 2 } })
    })

    it('respects Do Not Track and isolates tracker failures', () => {
        initializeUmamiAnalytics({ hostname: 'www.rsmb.tv' })
        const track = vi.fn(() => { throw new Error('Tracker unavailable') })
        vi.stubGlobal('window', { location: { hostname: 'www.rsmb.tv', pathname: '/' }, umami: { track } })
        vi.stubGlobal('navigator', { doNotTrack: '1' })
        trackAnalyticsEvent('map-ready', {})
        expect(track).not.toHaveBeenCalled()
        vi.stubGlobal('navigator', { doNotTrack: '0' })
        expect(() => trackAnalyticsEvent('map-ready', {})).not.toThrow()
    })

    it('avoids loading the tracker for browser privacy signals and local exclusion', () => {
        for (const preference of [{ doNotTrack: 'yes' }, { doNotTrack: '1' }, { globalPrivacyControl: true }]) {
            vi.stubGlobal('navigator', preference)
            initializeUmamiAnalytics({ hostname: 'www.rsmb.tv' })
            expect(document.getElementById('umami-analytics')).toBeNull()
        }
        vi.stubGlobal('navigator', { doNotTrack: '0' })
        localStorage.setItem('umami.disabled', '1')
        initializeUmamiAnalytics({ hostname: 'www.rsmb.tv' })
        expect(document.getElementById('umami-analytics')).toBeNull()
    })

    it('filters arbitrary data and strips query, hash, identity, and private referrer paths', () => {
        const result = sanitizeAnalyticsPayload('event', {
            url: 'https://www.rsmb.tv/projects/flights/map?airport=private#secret',
            referrer: 'https://example.org/private/path?token=secret#details', id: 'user@example.org',
            name: 'map-interacted',
            data: { feature: 'flights', action: 'selection', coordinates: '38.1,-90.2', email: 'user@example.org' },
        })
        expect(result).toMatchObject({
            url: '/projects/flights/map', referrer: 'https://example.org', tag: 'rsmb-tv',
            name: 'map-interacted', data: { feature: 'flights', action: 'selection' },
        })
        expect(sanitizeAnalyticsPayload('event', { name: 'free-text', data: { query: 'private' } })).toBeNull()
        expect(sanitizeAnalyticsPayload('identify', { id: 'private' })).toBeNull()
    })

    it('preserves Web Vitals while discarding unknown fields and arbitrary URL paths', () => {
        const performance = sanitizeAnalyticsPayload('performance', {
            url: '/users/private-name?token=secret', title: 'Private name', lcp: 1200, inp: 80,
            arbitrary: 'sensitive', device: 'private', id: 'private-id',
        })
        expect(performance).toMatchObject({ url: '/404', title: 'Not Found | rsmb.tv', lcp: 1200, inp: 80 })
        expect(JSON.stringify(performance)).not.toMatch(/private|sensitive|secret/i)
    })

    it('accepts the pins map feature without recording its selected geography', () => {
        expect(sanitizeAnalyticsPayload('event', {
            name: 'map-ready', url: '/projects/pins-of-inaccessibility/map?pin=county-51610',
            data: { feature: 'pins-of-inaccessibility', state: 'ready', pin: 'county-51610' },
        })).toMatchObject({
            url: '/projects/pins-of-inaccessibility/map',
            data: { feature: 'pins-of-inaccessibility', state: 'ready' },
        })
    })

    it('retains only an error type and public bundle locations', () => {
        const error = sanitizeAnalyticsPayload('error', {
            website: 'untrusted', url: '/projects/flights/map?key=private', name: 'TypeError', handled: true,
            message: 'Reading private notes for user@example.org at 38.5,-92.5, secret 123',
            stack: 'TypeError: private message\n at somePrivateFunction (https://www.rsmb.tv/assets/FlightsMap-Ab1.js:8:12)\n' +
                'at https://other.example/secret.js:22:2',
            context: { token: 'private' }, fingerprint: ['private-file'], tags: { email: 'user@example.org' },
        })
        expect(error).toMatchObject({
            url: '/projects/flights/map', name: 'TypeError', message: 'TypeError', handled: true,
            stack: 'at /assets/FlightsMap-Ab1.js:8:12', environment: 'production',
        })
        expect(JSON.stringify(error)).not.toMatch(/secret|private|user@example|38\.5|-92\.5/i)
        expect(error).not.toHaveProperty('fingerprint')
        expect(error).not.toHaveProperty('tags')
        expect(sanitizeAnalyticsPayload('error', { name: 'private-name', stack: null })).toMatchObject({
            name: 'Error', message: 'Error', stack: '',
        })
    })

    it('rechecks privacy preferences for automatic sends after the tracker loads', () => {
        vi.stubGlobal('window', { location: { hostname: 'www.rsmb.tv', pathname: '/' } })
        vi.stubGlobal('navigator', { doNotTrack: '0' })
        initializeUmamiAnalytics({ websiteId: 'configured-id', hostname: 'www.rsmb.tv' })
        const hook = (window as Window & { rsmbAnalyticsBeforeSend?: typeof sanitizeAnalyticsPayload }).rsmbAnalyticsBeforeSend!
        expect(hook('event', { url: '/' })).toMatchObject({ website: 'configured-id' })
        vi.stubGlobal('navigator', { doNotTrack: 'yes' })
        expect(hook('event', { url: '/' })).toBeNull()
    })

    it('deduplicates caught errors and tolerates older trackers without error support', () => {
        const track = vi.fn()
        const captureException = vi.fn()
        vi.stubGlobal('window', { location: { hostname: 'www.rsmb.tv', pathname: '/about' }, umami: { track, captureException } })
        initializeUmamiAnalytics({ hostname: 'www.rsmb.tv' })
        const error = new Error('Failed https://example.org/file?token=private')
        error.stack = 'Error: private text\n at https://www.rsmb.tv/assets/index-Ab1.js:5:9'
        captureAnalyticsException(error)
        captureAnalyticsException(error)
        expect(track).toHaveBeenCalledOnce()
        expect(captureException).toHaveBeenCalledOnce()
        expect(captureException.mock.calls[0][0].message).toBe('Error')
        expect(sanitizeAnalyticsPayload('error', { stack: captureException.mock.calls[0][0].stack })).toMatchObject({ stack: 'at /assets/index-Ab1.js:5:9' })
        vi.stubGlobal('window', { location: { hostname: 'www.rsmb.tv', pathname: '/about' }, umami: { track } })
        expect(() => captureAnalyticsException(new Error('Caught'))).not.toThrow()
        expect(() => captureAnalyticsException('a thrown string')).not.toThrow()
        const broken = new Error('private')
        Object.defineProperty(broken, 'stack', { get: () => { throw new Error('stack unavailable') } })
        expect(() => captureAnalyticsException(broken)).not.toThrow()
    })
})
