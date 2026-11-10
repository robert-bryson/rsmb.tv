const UMAMI_SCRIPT_ID = 'umami-analytics'
const UMAMI_HOSTNAME = 'www.rsmb.tv'
const UMAMI_SCRIPT_URL = 'https://cloud.umami.is/script.js'
const UMAMI_WEBSITE_ID = 'a7ba7f9f-4aa2-4264-aa0e-602ffd2ac4e2'

type EventData = Record<string, string | number>
type Tracker = { track: (payload: (defaults: Record<string, unknown>) => Record<string, unknown>) => unknown }
const pendingEvents: Array<{ name: string; data: EventData; pathname: string }> = []

function trackingAllowed() {
  return window.location.hostname === UMAMI_HOSTNAME && navigator.doNotTrack !== '1'
}

function flushEvents() {
  if (!trackingAllowed()) { pendingEvents.length = 0; return }
  const tracker = (window as Window & { umami?: Tracker }).umami
  if (!tracker?.track) return
  for (const event of pendingEvents.splice(0)) {
    try {
      // Late delivery retains the original path and excludes query parameters.
      const result = tracker.track(defaults => ({ ...defaults, url: event.pathname, name: event.name, data: event.data }))
      void Promise.resolve(result).catch(() => {})
    } catch { /* Analytics must not interrupt the application. */ }
  }
}

export function trackAnalyticsEvent(name: string, data: EventData, pathname = window.location.pathname) {
  if (!trackingAllowed() || !document.getElementById(UMAMI_SCRIPT_ID)) return
  pendingEvents.push({ name, data, pathname })
  if (pendingEvents.length > 8) pendingEvents.shift()
  flushEvents()
}

interface UmamiAnalyticsOptions {
  websiteId?: string
  hostname?: string
  document?: Document
}

export function initializeUmamiAnalytics({
  websiteId = UMAMI_WEBSITE_ID,
  hostname = window.location.hostname,
  document: targetDocument = document,
}: UmamiAnalyticsOptions = {}): void {
  if (!websiteId || hostname !== UMAMI_HOSTNAME || targetDocument.getElementById(UMAMI_SCRIPT_ID)) return

  const script = targetDocument.createElement('script')
  script.id = UMAMI_SCRIPT_ID
  script.defer = true
  script.src = UMAMI_SCRIPT_URL
  script.dataset.websiteId = websiteId
  script.dataset.domains = UMAMI_HOSTNAME
  script.dataset.excludeSearch = 'true'
  script.dataset.doNotTrack = 'true'
  script.dataset.performance = 'true'
  script.addEventListener('load', flushEvents)
  script.addEventListener('error', () => { pendingEvents.length = 0 })
  targetDocument.head.appendChild(script)
}
