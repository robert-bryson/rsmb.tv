import { afterEach, describe, expect, it, vi } from 'vitest'
import { initializeUmamiAnalytics, trackAnalyticsEvent } from '../utils/analytics'

describe('initializeUmamiAnalytics', () => {
    afterEach(() => {
        document.getElementById('umami-analytics')?.dispatchEvent(new Event('error'))
        document.getElementById('umami-analytics')?.remove()
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
        for (let index = 0; index < 10; index++) trackAnalyticsEvent('map-ready', { index })
        location.pathname = '/about'
        target.umami = { track: vi.fn() }
        document.getElementById('umami-analytics')!.dispatchEvent(new Event('load'))
        expect(target.umami.track).toHaveBeenCalledTimes(8)
        const payload = target.umami.track.mock.calls[0][0]({ url: '/about?private=value' })
        expect(payload).toMatchObject({ name: 'map-ready', url: '/projects/flights/map', data: { index: 2 } })
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
})
