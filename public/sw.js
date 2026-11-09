const CACHE = 'dieu-phoi-xe-bvmsgtv-shell-v3.0.0'

self.addEventListener('install', (event) => {
  const scope = self.registration.scope
  const core = [
    scope,
    `${scope}index.html`,
    `${scope}manifest.webmanifest`,
    `${scope}icons/icon-192.png`,
    `${scope}icons/icon-512.png`,
    `${scope}brand/logo-bvmsgtv-2026-256.png`,
  ]
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(core))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== location.origin) return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(event.request, copy))
        }
        return response
      })
      .catch(async () => {
        const cached = await caches.match(event.request)
        if (cached) return cached
        if (event.request.mode === 'navigate') return caches.match(`${self.registration.scope}index.html`)
        return Response.error()
      }),
  )
})


self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data || {}
  const paths = {
    dashboard: 'tong-quan',
    requests: 'de-nghi-xe',
    dispatch: 'dieu-xe',
    expenses: 'chi-phi',
    incidents: 'su-co',
    maintenance: 'bao-duong',
    tracking: 'theo-doi-xe',
  }
  const path = paths[data.target] || 'tong-quan'
  const url = new URL(path, self.registration.scope)
  if (data.recordId) url.searchParams.set('focus', data.recordId)

  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
    const existing = clients.find((client) => new URL(client.url).origin === url.origin)
    if (existing && 'navigate' in existing) {
      await existing.navigate(url.href)
      return existing.focus()
    }
    return self.clients.openWindow(url.href)
  }))
})
