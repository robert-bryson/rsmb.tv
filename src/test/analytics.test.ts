import { afterEach, describe, expect, it } from 'vitest'
import { initializeUmamiAnalytics } from '../utils/analytics'

describe('initializeUmamiAnalytics', () => {
    afterEach(() => {
        document.getElementById('umami-analytics')?.remove()
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
})