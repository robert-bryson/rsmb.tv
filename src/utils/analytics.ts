import sitePages from '../content/sitePages.json' with { type: 'json' }
import siteAliases from '../content/siteAliases.json' with { type: 'json' }
import { metadata as postMetadata } from 'virtual:post-content'
import { projects } from '../content/projects'

const UMAMI_SCRIPT_ID = 'umami-analytics'
const UMAMI_HOSTNAME = 'www.rsmb.tv'
const UMAMI_SCRIPT_URL = 'https://cloud.umami.is/script.js'
const UMAMI_WEBSITE_ID = 'a7ba7f9f-4aa2-4264-aa0e-602ffd2ac4e2'
const BEFORE_SEND = 'rsmbAnalyticsBeforeSend'

type EventData = Record<string, string | number>
type Payload = Record<string, unknown>
type Tracker = {
  track: (payload: (defaults: Payload) => Payload) => unknown
  captureException?: (error: unknown, options?: Payload) => unknown
}
type AnalyticsWindow = Window & {
  umami?: Tracker
  rsmbAnalyticsBeforeSend?: typeof sanitizeAnalyticsPayload
}

export type MapFeature = 'flights' | 'temperature-records' | 'tornado-tracks' | 'adv-atlas'
export type MapAction = 'filter' | 'selection' | 'view' | 'playback' | 'statistics'

const oneOf = (...values: string[]) => (value: unknown) => typeof value === 'string' && values.includes(value)
const fields: Record<string, (value: unknown) => boolean> = {
  feature: oneOf('flights', 'temperature-records', 'tornado-tracks', 'adv-atlas', 'posts'),
  action: oneOf('filter', 'selection', 'view', 'playback', 'statistics'),
  phase: oneOf('startup', 'runtime'),
  state: oneOf('ready', 'degraded', 'fallback', 'error'),
  navigation: oneOf('document', 'client'),
  revision: value => typeof value === 'string' && /^[\w.-]{1,64}$/.test(value),
  prefetch: oneOf('all', 'pages', 'off'),
  device: oneOf('mobile', 'desktop'),
  durationMs: value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 86_400_000,
  project: oneOf(...projects.map(project => project.slug)),
  destination: oneOf('details', 'demo', 'source', 'data'),
  placement: oneOf('home', 'projects', 'project-header', 'about', 'footer'),
  contentType: oneOf('writing', 'trip'),
  galleryType: oneOf('trip'),
  method: oneOf('clipboard', 'native', 'manual'),
  outcome: oneOf('copied', 'handed-off', 'cancelled', 'manual', 'failed'),
  format: oneOf('rss', 'json'),
  resultBucket: oneOf('0', '1', '2-10', '11-50', '51+'),
}

// Only these names, keys, and bounded values may enter custom event data.
const eventProperties = {
  'map-ready': ['feature', 'state', 'durationMs', 'navigation', 'revision', 'prefetch', 'device'],
  'map-startup-error': ['feature', 'state', 'durationMs', 'navigation', 'revision', 'prefetch', 'device'],
  'map-runtime-error': ['feature', 'revision'],
  'map-recovered': ['feature', 'state', 'phase'],
  'map-interacted': ['feature', 'action'],
  'project-link-click': ['project', 'destination', 'placement'],
  'filters-applied': ['feature', 'resultBucket'],
  'article-engaged': ['contentType'],
  'gallery-opened': ['galleryType'],
  'share-action': ['feature', 'method', 'outcome'],
  'contact-link-click': ['placement'],
  'feed-link-click': ['format', 'placement'],
  'page-error': [],
  'page-retry': [],
} satisfies Record<string, string[]>
type EventName = keyof typeof eventProperties

const pendingEvents: Array<{ name: EventName; data: EventData; pathname: string; title: string }> = []
const pendingErrors: Array<{ error: Error; pathname: string }> = []
const reportedErrors = new WeakMap<object, { pathname: string; time: number }>()
const pageTitles = new Map<string, string>(Object.entries(sitePages).map(([path, page]) => [path, page.title]))
for (const [alias, canonical] of Object.entries(siteAliases)) pageTitles.set(alias, pageTitles.get(canonical) ?? 'rsmb.tv')
for (const post of postMetadata) {
  if (post.development?.published === false) continue
  pageTitles.set(`/${post.format === 'trip' ? 'trips' : 'blog'}/${post.slug}`, post.title)
}

function trackingAllowed(hostname = window.location.hostname) {
  if (hostname !== UMAMI_HOSTNAME || ['1', 'yes'].includes(navigator.doNotTrack ?? '')
    || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return false
  try { return !window.localStorage.getItem('umami.disabled') }
  catch { return true }
}

function cleanUrl(value: unknown, referrer = false): string {
  if (typeof value !== 'string' || !value) return ''
  try {
    const url = new URL(value, `https://${UMAMI_HOSTNAME}`)
    if (!['http:', 'https:'].includes(url.protocol)) return ''
    if (url.hostname !== UMAMI_HOSTNAME) return referrer ? url.origin : '/404'
    return pageTitles.has(url.pathname) ? url.pathname : '/404'
  } catch { return '' }
}

const errorNames = new Set(['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'URIError', 'EvalError', 'AggregateError'])
function errorName(value: unknown): string {
  return typeof value === 'string' && errorNames.has(value) ? value : 'Error'
}

/** Keep only locations of public site bundles. Exception text can contain user input. */
function cleanStack(value: unknown): string {
  if (typeof value !== 'string') return ''
  return Array.from(value.matchAll(/(?:https:\/\/www\.rsmb\.tv|(?:^|\n)\s*at )(\/assets\/[a-zA-Z0-9_.-]+\.js):(\d+):(\d+)/g))
    .slice(0, 20).map(([, file, line, column]) => `at ${file}:${line}:${column}`).join('\n')
}

function cleanEventData(name: EventName, data: unknown): EventData {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
  const result: EventData = {}
  for (const key of eventProperties[name]) {
    const value = (data as Payload)[key]
    if (fields[key]?.(value)) result[key] = value as string | number
  }
  return result
}

/** Allow only the fields needed by the tracker for pageviews, performance, and errors. */
export function sanitizeAnalyticsPayload(type: string, payload: Payload, websiteId = UMAMI_WEBSITE_ID): Payload | null {
  if (!['event', 'performance', 'error'].includes(type)) return null
  const url = cleanUrl(payload.url) || '/404'
  const clean: Payload = { website: websiteId, url }
  if (typeof payload.screen === 'string' && /^\d{1,5}x\d{1,5}$/.test(payload.screen)) clean.screen = payload.screen
  if (typeof payload.language === 'string' && /^[a-z]{2,3}(?:-[a-z0-9]{2,8}){0,3}$/i.test(payload.language)) clean.language = payload.language
  if (type === 'error') {
    const name = errorName(payload.name)
    Object.assign(clean, {
      version: 1, name, message: name, stack: cleanStack(payload.stack),
      handled: payload.handled === true, environment: 'production', release: __BUILD_REVISION__,
    })
    return clean
  }
  Object.assign(clean, {
    hostname: UMAMI_HOSTNAME, title: pageTitles.get(url) ?? 'Not Found | rsmb.tv',
    referrer: cleanUrl(payload.referrer, true), tag: 'rsmb-tv',
  })
  if (type === 'performance') {
    for (const metric of ['ttfb', 'fcp', 'lcp', 'inp', 'cls', 'duration']) {
      const value = payload[metric]
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) clean[metric] = value
    }
  } else if (payload.name !== undefined) {
    if (typeof payload.name !== 'string' || !Object.hasOwn(eventProperties, payload.name)) return null
    clean.name = payload.name
    clean.data = cleanEventData(payload.name as EventName, payload.data)
  }
  return clean
}

function flushEvents() {
  if (!trackingAllowed()) { pendingEvents.length = 0; pendingErrors.length = 0; return }
  const tracker = (window as AnalyticsWindow).umami
  if (!tracker?.track) return
  for (const event of pendingEvents.splice(0)) {
    try {
      const result = tracker.track(defaults => ({ ...defaults, url: event.pathname, title: event.title, name: event.name, data: event.data }))
      void Promise.resolve(result).catch(() => {})
    } catch { /* Analytics must not interrupt the application. */ }
  }
  for (const { error, pathname } of pendingErrors.splice(0)) {
    // An old failure must not be attributed to the page navigated to meanwhile.
    if (pathname !== window.location.pathname) continue
    try { void Promise.resolve(tracker.captureException?.(error)).catch(() => {}) }
    catch { /* Error reporting must not replace the original failure. */ }
  }
}

export function trackAnalyticsEvent(name: EventName, data: EventData = {}, pathname = window.location.pathname) {
  try {
    if (!trackingAllowed() || !document.getElementById(UMAMI_SCRIPT_ID)) return
    const path = cleanUrl(pathname) || '/404'
    pendingEvents.push({ name, data: cleanEventData(name, data), pathname: path, title: pageTitles.get(path) ?? 'Not Found | rsmb.tv' })
    if (pendingEvents.length > 8) pendingEvents.shift()
    flushEvents()
  } catch { /* Never break the user action because analytics failed. */ }
}

/** Caught React errors need explicit reporting; deduplicate Strict Mode reports. */
export function captureAnalyticsException(error: unknown) {
  try {
    if (!trackingAllowed() || !document.getElementById(UMAMI_SCRIPT_ID)) return
    const pathname = window.location.pathname
    if (error && typeof error === 'object') {
      const previous = reportedErrors.get(error)
      const now = performance.now()
      if (previous?.pathname === pathname && now - previous.time < 1000) return
      reportedErrors.set(error, { pathname, time: now })
    }
    const exception = error instanceof Error ? error : new Error('Non-Error exception')
    trackAnalyticsEvent('page-error')
    const name = errorName(exception.name)
    const safeError = new Error(name)
    safeError.name = name
    safeError.stack = cleanStack(exception.stack)
    pendingErrors.push({ error: safeError, pathname: window.location.pathname })
    if (pendingErrors.length > 4) pendingErrors.shift()
    flushEvents()
  } catch { /* Reporting an error must not cause another error. */ }
}

export function analyticsResultBucket(count: number) {
  return count <= 0 ? '0' : count === 1 ? '1' : count <= 10 ? '2-10' : count <= 50 ? '11-50' : '51+'
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
  if (!websiteId || !trackingAllowed(hostname) || targetDocument.getElementById(UMAMI_SCRIPT_ID)) return
  ;(window as AnalyticsWindow)[BEFORE_SEND] = (type, payload) => {
    try { return trackingAllowed() ? sanitizeAnalyticsPayload(type, payload, websiteId) : null }
    catch { return null }
  }
  const script = targetDocument.createElement('script')
  script.id = UMAMI_SCRIPT_ID
  script.defer = true
  script.referrerPolicy = 'no-referrer'
  script.src = UMAMI_SCRIPT_URL
  script.dataset.websiteId = websiteId
  script.dataset.domains = UMAMI_HOSTNAME
  script.dataset.tag = 'rsmb-tv'
  script.dataset.excludeSearch = 'true'
  script.dataset.excludeHash = 'true'
  script.dataset.doNotTrack = 'true'
  script.dataset.performance = 'true'
  script.dataset.errors = 'true'
  script.dataset.release = __BUILD_REVISION__
  script.dataset.environment = 'production'
  script.dataset.beforeSend = BEFORE_SEND
  script.addEventListener('load', flushEvents)
  script.addEventListener('error', () => { pendingEvents.length = 0; pendingErrors.length = 0 })
  targetDocument.head.appendChild(script)
}
