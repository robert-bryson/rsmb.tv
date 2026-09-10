const UMAMI_SCRIPT_ID = 'umami-analytics'
const UMAMI_HOSTNAME = 'www.rsmb.tv'
const UMAMI_SCRIPT_URL = 'https://cloud.umami.is/script.js'
const UMAMI_WEBSITE_ID = 'a7ba7f9f-4aa2-4264-aa0e-602ffd2ac4e2'

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
  targetDocument.head.appendChild(script)
}