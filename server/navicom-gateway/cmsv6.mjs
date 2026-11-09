import crypto from 'node:crypto'

let sessionCache = null

function env(name, fallback = '') {
  const value = process.env[name]
  return value == null || String(value).trim() === '' ? fallback : String(value).trim()
}

function boolEnv(name, fallback = false) {
  const value = env(name, fallback ? 'true' : 'false').toLowerCase()
  return ['1', 'true', 'yes', 'on'].includes(value)
}

function numberEnv(name, fallback) {
  const value = Number(env(name, String(fallback)))
  return Number.isFinite(value) ? value : fallback
}

function trimSlash(value) {
  return String(value || '').replace(/\/+$/, '')
}

function ensureAbsoluteBaseUrl() {
  const raw = trimSlash(env('NAVICOM_BASE_URL'))
  if (!raw) throw new Error('Thiếu NAVICOM_BASE_URL trong cấu hình Navicom Gateway.')
  let url
  try { url = new URL(raw) } catch { throw new Error('NAVICOM_BASE_URL không phải URL hợp lệ.') }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('NAVICOM_BASE_URL chỉ hỗ trợ http hoặc https.')
  return url
}

function candidateApiRoots() {
  const configured = ensureAbsoluteBaseUrl()
  const explicitPrefix = env('NAVICOM_CMSV6_API_PREFIX')
  const roots = []

  const add = (value) => {
    const normalized = trimSlash(value)
    if (normalized && !roots.includes(normalized)) roots.push(normalized)
  }

  if (explicitPrefix) {
    const origin = configured.origin
    const prefix = explicitPrefix.startsWith('/') ? explicitPrefix : `/${explicitPrefix}`
    add(`${origin}${prefix}`)
  }

  add(configured.href)

  const path = configured.pathname.replace(/\/+$/, '')
  if (/\/808gps$/i.test(path)) {
    add(configured.origin)
  } else {
    add(`${configured.origin}${path === '/' ? '' : path}/808gps`)
    add(`${configured.origin}/808gps`)
  }
  add(configured.origin)

  return roots
}

function buildActionUrl(root, action, params = {}) {
  const url = new URL(`${trimSlash(root)}/${action}`)
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') continue
    url.searchParams.set(key, String(value))
  }
  return url
}

async function fetchJson(url, timeoutMs = 12000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json,text/plain,*/*',
        'User-Agent': 'BVMSGTV-Navicom-Gateway/2.10.6',
      },
      redirect: 'follow',
      signal: controller.signal,
    })
    const text = await response.text()
    let data = null
    try { data = JSON.parse(text) } catch { /* non-json handled below */ }
    if (!response.ok) throw new Error(`CMSV6 trả về HTTP ${response.status}.`)
    if (!data || typeof data !== 'object') {
      throw new Error(`CMSV6 không trả JSON hợp lệ${text ? `: ${text.slice(0, 120)}` : '.'}`)
    }
    return { data, finalUrl: response.url }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('Hết thời gian chờ kết nối CMSV6.')
    throw error
  } finally {
    clearTimeout(timer)
  }
}

function md5(value) {
  return crypto.createHash('md5').update(String(value), 'utf8').digest('hex')
}

function resultCode(data) {
  const raw = data?.result
  if (raw == null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function sessionFrom(data) {
  return String(data?.jsession || data?.JSESSIONID || data?.session || '').trim()
}

function loginPasswordVariants(password) {
  const configured = env('NAVICOM_CMSV6_PASSWORD_MODE', 'auto').toLowerCase()
  if (configured === 'plain') return [{ label: 'plain', value: password }]
  if (configured === 'md5') return [{ label: 'md5', value: md5(password) }]
  const variants = [{ label: 'plain', value: password }, { label: 'md5', value: md5(password) }]
  return variants.filter((item, index, arr) => arr.findIndex((other) => other.value === item.value) === index)
}

export async function cmsv6Login(force = false) {
  const ttlMs = numberEnv('NAVICOM_CMSV6_SESSION_TTL_SECONDS', 1200) * 1000
  if (!force && sessionCache?.jsession && Date.now() - sessionCache.createdAt < ttlMs) return sessionCache

  const account = env('NAVICOM_USERNAME')
  const password = env('NAVICOM_PASSWORD')
  if (!account || !password) throw new Error('Thiếu NAVICOM_USERNAME hoặc NAVICOM_PASSWORD.')

  const attempts = []
  for (const root of candidateApiRoots()) {
    for (const variant of loginPasswordVariants(password)) {
      const url = buildActionUrl(root, 'StandardApiAction_login.action', {
        account,
        password: variant.value,
      })
      try {
        const { data, finalUrl } = await fetchJson(url)
        const jsession = sessionFrom(data)
        const code = resultCode(data)
        attempts.push({ root, password_mode: variant.label, result: code, session: Boolean(jsession) })
        if ((code == null || code === 0) && jsession) {
          const final = new URL(finalUrl)
          const actionSuffix = '/StandardApiAction_login.action'
          const pathname = final.pathname.endsWith(actionSuffix) ? final.pathname.slice(0, -actionSuffix.length) : new URL(root).pathname
          const resolvedRoot = trimSlash(`${final.origin}${pathname}`)
          sessionCache = {
            jsession,
            apiRoot: resolvedRoot,
            createdAt: Date.now(),
            passwordMode: variant.label,
            accountName: data.account_name || data.accountName || null,
          }
          return sessionCache
        }
      } catch (error) {
        attempts.push({ root, password_mode: variant.label, error: error instanceof Error ? error.message : String(error) })
      }
    }
  }

  const summary = attempts.map((item) => `${item.root} [${item.password_mode}] ${item.error || `result=${item.result}`}`).join(' | ')
  throw new Error(`Đăng nhập CMSV6 thất bại. Kiểm tra domain/tài khoản/mật khẩu. ${summary.slice(0, 900)}`)
}

function pad(value) { return String(value).padStart(2, '0') }
function cmsDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function parseNumber(value) {
  if (value == null || value === '') return null
  const normalized = typeof value === 'string' ? value.trim().replace(',', '.') : value
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

function normalizeCoordinate(value, axis) {
  let n = parseNumber(value)
  if (n == null) return null
  const max = axis === 'lat' ? 90 : 180
  if (Math.abs(n) <= max) return n
  for (const divisor of [1e6, 1e5, 1e7]) {
    const candidate = n / divisor
    if (Math.abs(candidate) <= max) return candidate
  }
  return null
}

function firstCoordinate(track, axis) {
  const mapKey = axis === 'lat' ? 'mlat' : 'mlng'
  const rawKey = axis === 'lat' ? 'lat' : 'lng'
  return normalizeCoordinate(track?.[mapKey], axis) ?? normalizeCoordinate(track?.[rawKey], axis)
}

function normalizeTimestamp(value) {
  if (value == null || value === '') return null
  if (typeof value === 'number' || /^\d{10,13}$/.test(String(value))) {
    let n = Number(value)
    if (n < 1e12) n *= 1000
    const d = new Date(n)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  const d = new Date(String(value).replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function trackTimestamp(track) {
  return normalizeTimestamp(track?.gt) || normalizeTimestamp(track?.gtm) || normalizeTimestamp(track?.gpsTime) || normalizeTimestamp(track?.time) || normalizeTimestamp(track?.pt)
}

function pickLatestTrack(tracks) {
  if (!Array.isArray(tracks) || !tracks.length) return null
  return [...tracks].sort((a, b) => {
    const ta = trackTimestamp(a)
    const tb = trackTimestamp(b)
    return (tb ? Date.parse(tb) : 0) - (ta ? Date.parse(ta) : 0)
  })[0]
}

async function queryTrackWithSession(session, deviceId, minutes) {
  const end = new Date()
  const begin = new Date(end.getTime() - minutes * 60_000)
  const url = buildActionUrl(session.apiRoot, 'StandardApiAction_queryTrackDetail.action', {
    devIdno: deviceId,
    begintime: cmsDate(begin),
    endtime: cmsDate(end),
    toMap: env('NAVICOM_CMSV6_MAP_TYPE', '1'),
    geoaddress: '1',
    jsession: session.jsession,
  })
  const { data } = await fetchJson(url, numberEnv('NAVICOM_CMSV6_TIMEOUT_MS', 15000))
  return data
}

function looksLikeSessionFailure(data) {
  const code = resultCode(data)
  if (code == null || code === 0) return false
  const text = JSON.stringify(data).toLowerCase()
  return code === 1 || code === 2 || text.includes('session') || text.includes('login') || text.includes('not logged')
}

async function queryLatestTrack(deviceId) {
  let session = await cmsv6Login(false)
  const primaryMinutes = Math.max(5, numberEnv('NAVICOM_CMSV6_LOOKBACK_MINUTES', 30))
  let data = await queryTrackWithSession(session, deviceId, primaryMinutes)
  if (looksLikeSessionFailure(data)) {
    session = await cmsv6Login(true)
    data = await queryTrackWithSession(session, deviceId, primaryMinutes)
  }
  let latest = pickLatestTrack(data?.tracks)
  if (!latest && boolEnv('NAVICOM_CMSV6_FALLBACK_24H', true)) {
    data = await queryTrackWithSession(session, deviceId, 24 * 60)
    latest = pickLatestTrack(data?.tracks)
  }
  return { session, latest, rawResult: resultCode(data), trackCount: Array.isArray(data?.tracks) ? data.tracks.length : 0 }
}

function playerBaseUrl(session) {
  const explicit = trimSlash(env('NAVICOM_CMSV6_PUBLIC_BASE_URL'))
  if (explicit) return explicit
  const configured = ensureAbsoluteBaseUrl()
  return trimSlash(configured.origin)
}

function playerPath() {
  const configured = env('NAVICOM_CMSV6_PLAYER_PATH', '/808gps/open/player/video.html')
  return configured.startsWith('/') ? configured : `/${configured}`
}

function buildPlayerUrl(session, deviceId, channel) {
  const url = new URL(`${playerBaseUrl(session)}${playerPath()}`)
  url.searchParams.set('lang', env('NAVICOM_CMSV6_PLAYER_LANG', 'en'))
  url.searchParams.set('devIdno', deviceId)
  url.searchParams.set('jsession', session.jsession)
  // CMSV6 video.html: `channel` là SỐ CỬA SỔ preview, không phải index camera.
  // Mỗi tab trong app chỉ xem một camera nên luôn dùng 1 cửa sổ,
  // còn `chns` mới là danh sách index kênh cần phát (0 = trước, 1 = cabin).
  url.searchParams.set('channel', '1')
  url.searchParams.set('chns', String(channel))
  url.searchParams.set('stream', env('NAVICOM_CMSV6_STREAM', '1'))
  return url.toString()
}

function normalizeSpeed(raw) {
  const value = parseNumber(raw)
  if (value == null) return null
  const divisor = Math.max(0.0001, numberEnv('NAVICOM_CMSV6_SPEED_DIVISOR', 10))
  return value / divisor
}

function ignitionFrom(track) {
  const field = env('NAVICOM_CMSV6_ACC_FIELD', 'ac')
  const raw = track?.[field]
  if (typeof raw === 'boolean') return raw
  const n = parseNumber(raw)
  if (n === 0) return false
  if (n === 1) return true
  return null
}

function channelLabel(index) {
  if (index === 0) return 'Camera trước'
  if (index === 1) return 'Camera cabin'
  if (index === 2) return 'Camera sau'
  return `Camera ${index + 1}`
}


function firstText(object, keys) {
  for (const key of keys) {
    const value = object?.[key]
    if (value == null) continue
    const text = String(value).trim()
    if (text) return text
  }
  return ''
}

function normalizeAccountVehicle(item, fallbackIndex = 0) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null
  const deviceId = firstText(item, ['devIdno', 'devIdNo', 'deviceId', 'device_id', 'devId', 'did', 'idno', 'terminalNo'])
  const plateNumber = firstText(item, ['vehiIdno', 'vehiIdNo', 'vehicleIdno', 'vehicle_idno', 'plateNumber', 'plate_number', 'licensePlate', 'name', 'nm', 'vid'])
  const vehicleName = firstText(item, ['vehicleName', 'vehicle_name', 'vehiName', 'name', 'nm', 'vid']) || plateNumber
  if (!deviceId && !plateNumber) return null
  return {
    key: `${deviceId || plateNumber || fallbackIndex}`,
    device_id: deviceId || null,
    plate_number: plateNumber || null,
    vehicle_name: vehicleName || null,
    channel_count: 2,
  }
}

function collectVehicleLikeObjects(value, output = [], depth = 0) {
  if (depth > 8 || value == null) return output
  if (Array.isArray(value)) {
    for (const item of value) collectVehicleLikeObjects(item, output, depth + 1)
    return output
  }
  if (typeof value !== 'object') return output
  const normalized = normalizeAccountVehicle(value, output.length)
  if (normalized && (normalized.device_id || normalized.plate_number)) output.push(normalized)
  for (const [key, child] of Object.entries(value)) {
    if (['tracks', 'track', 'alarms'].includes(key)) continue
    if (child && typeof child === 'object') collectVehicleLikeObjects(child, output, depth + 1)
  }
  return output
}

function dedupeAccountVehicles(items) {
  const map = new Map()
  for (const item of items) {
    if (!item) continue
    const key = item.device_id || `plate:${item.plate_number || item.key}`
    const current = map.get(key)
    if (!current) map.set(key, item)
    else map.set(key, {
      ...current,
      plate_number: current.plate_number || item.plate_number,
      vehicle_name: current.vehicle_name || item.vehicle_name,
      device_id: current.device_id || item.device_id,
      channel_count: 2,
    })
  }
  return [...map.values()].filter((item) => item.device_id || item.plate_number)
}

async function queryUserVehiclesWithSession(session) {
  const configured = env('NAVICOM_CMSV6_VEHICLE_ACTIONS', 'StandardApiAction_queryUserVehicle.action,StandardApiAction_getUserVehicle.action')
  const actions = configured.split(',').map((item) => item.trim()).filter(Boolean)
  const attempts = []
  for (const action of actions) {
    try {
      const url = buildActionUrl(session.apiRoot, action, {
        jsession: session.jsession,
        language: env('NAVICOM_CMSV6_PLAYER_LANG', 'en'),
      })
      const { data } = await fetchJson(url, numberEnv('NAVICOM_CMSV6_TIMEOUT_MS', 15000))
      if (looksLikeSessionFailure(data)) return { sessionExpired: true, attempts }
      const candidates = dedupeAccountVehicles(collectVehicleLikeObjects(data))
      attempts.push({ action, result: resultCode(data), count: candidates.length })
      if (candidates.length) return { vehicles: candidates, action, attempts }
      if (resultCode(data) === 0) return { vehicles: [], action, attempts }
    } catch (error) {
      attempts.push({ action, error: error instanceof Error ? error.message : String(error) })
    }
  }
  return { vehicles: [], action: null, attempts }
}

export async function cmsv6ListVehicles() {
  let session = await cmsv6Login(false)
  let result = await queryUserVehiclesWithSession(session)
  if (result.sessionExpired) {
    session = await cmsv6Login(true)
    result = await queryUserVehiclesWithSession(session)
  }
  const vehicles = (result.vehicles || []).map((item) => ({ ...item, channel_count: 2 }))
  return {
    account_name: session.accountName,
    count: vehicles.length,
    channels_per_vehicle: 2,
    vehicles,
    action: result.action,
    attempts: result.attempts,
  }
}

// ---------------------------------------------------------------------------
// Trạng thái online THỰC của thiết bị (v3.0.0)
// Trước đây "online" chỉ suy ra từ lịch sử GPS (queryTrackDetail). Khi xe vừa nổ
// máy, lịch sử GPS thường về chậm 1–3 phút nên app coi xe offline và camera không
// hiện. CMSV6 có API trạng thái realtime: getDeviceOlStatus (online/offline) và
// getDeviceStatus (vị trí tức thời). Hai API này là tùy chọn: nếu máy chủ không hỗ
// trợ, gateway quay về cách cũ.
// ---------------------------------------------------------------------------
const onlineHistory = new Map()

function asArray(value) {
  return Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : []
}

function matchesDevice(item, deviceId) {
  const ids = [item?.did, item?.devIdno, item?.devIdNo, item?.id, item?.idno].filter((value) => value != null).map(String)
  return ids.length === 0 || ids.includes(String(deviceId))
}

async function queryRealtimeStatus(session, deviceId) {
  if (!boolEnv('NAVICOM_CMSV6_REALTIME_STATUS', true)) return { online: null, status: null }
  const timeout = numberEnv('NAVICOM_CMSV6_STATUS_TIMEOUT_MS', 6000)
  const [olResult, statusResult] = await Promise.allSettled([
    fetchJson(buildActionUrl(session.apiRoot, 'StandardApiAction_getDeviceOlStatus.action', { devIdno: deviceId, jsession: session.jsession }), timeout),
    fetchJson(buildActionUrl(session.apiRoot, 'StandardApiAction_getDeviceStatus.action', { devIdno: deviceId, toMap: env('NAVICOM_CMSV6_MAP_TYPE', '1'), geoaddress: '1', jsession: session.jsession }), timeout),
  ])

  let online = null
  if (olResult.status === 'fulfilled' && resultCode(olResult.value.data) === 0) {
    const row = asArray(olResult.value.data.onlines).find((item) => matchesDevice(item, deviceId))
    const raw = row?.online ?? row?.ol
    if (raw != null) online = Number(raw) === 1 || raw === true
  }

  let status = null
  if (statusResult.status === 'fulfilled' && resultCode(statusResult.value.data) === 0) {
    status = asArray(statusResult.value.data.status).find((item) => matchesDevice(item, deviceId)) ?? null
    if (online == null && status && status.ol != null) online = Number(status.ol) === 1
  }
  return { online, status }
}

function trackOnlineTransition(deviceId, online) {
  const previous = onlineHistory.get(deviceId)
  const now = new Date().toISOString()
  if (!previous || previous.online !== online) {
    const next = { online, since: now }
    onlineHistory.set(deviceId, next)
    return next
  }
  return previous
}

export async function cmsv6VehicleState(deviceId, options = {}) {
  const requestedCount = Number(options.channelCount)
  const configuredCount = Number.isFinite(requestedCount) && requestedCount > 0 ? requestedCount : numberEnv('NAVICOM_CMSV6_CHANNELS', 2)
  const channelCount = Math.min(2, Math.max(1, configuredCount))
  const { session, latest: trackLatest, rawResult, trackCount } = await queryLatestTrack(deviceId)
  const realtime = await queryRealtimeStatus(session, deviceId).catch(() => ({ online: null, status: null }))

  // Dùng điểm GPS mới hơn giữa trạng thái realtime và lịch sử hành trình.
  const trackAt = trackLatest ? trackTimestamp(trackLatest) : null
  const statusAt = realtime.status ? trackTimestamp(realtime.status) : null
  const statusHasCoords = realtime.status && firstCoordinate(realtime.status, 'lat') != null && firstCoordinate(realtime.status, 'lng') != null
  const useStatus = Boolean(statusHasCoords && statusAt && (!trackAt || Date.parse(statusAt) >= Date.parse(trackAt)))
  const latest = useStatus ? realtime.status : trackLatest

  const updatedAt = latest ? trackTimestamp(latest) : null
  const offlineMinutes = Math.max(1, numberEnv('NAVICOM_CMSV6_OFFLINE_MINUTES', 15))
  const gpsFresh = updatedAt ? Date.now() - Date.parse(updatedAt) <= offlineMinutes * 60_000 : false
  const online = realtime.online ?? gpsFresh
  const transition = trackOnlineTransition(deviceId, online)
  const lat = latest ? firstCoordinate(latest, 'lat') : null
  const lng = latest ? firstCoordinate(latest, 'lng') : null
  const address = latest ? String(latest.ps || latest.pss || latest.position || latest.address || '').trim() || null : null
  const heading = latest ? parseNumber(latest.hx ?? latest.heading) : null

  return {
    device_id: deviceId,
    device_name: latest?.vid || latest?.dn || `Thiết bị ${deviceId}`,
    online,
    online_source: realtime.online != null ? 'cmsv6-status' : 'gps',
    online_since: transition.since,
    gps: {
      lat,
      lng,
      speed_kph: latest ? normalizeSpeed(latest.sp ?? latest.speed) : null,
      heading,
      ignition: latest ? ignitionFrom(latest) : null,
      updated_at: updatedAt,
      address,
    },
    channels: Array.from({ length: channelCount }, (_, index) => {
      const url = buildPlayerUrl(session, deviceId, index)
      return {
        id: String(index + 1),
        label: channelLabel(index),
        // Chỉ báo online/offline cho kênh khi CMSV6 xác nhận trạng thái thiết bị;
        // nếu chỉ có GPS thì để player CMSV6 tự xác nhận (không chặn video).
        ...(realtime.online != null ? { online: realtime.online } : {}),
        player_url: url,
        external_url: url,
        hls_url: null,
        snapshot_url: null,
      }
    }),
    updated_at: updatedAt,
    source: 'cmsv6-standard-api',
    message: latest ? null : `Đăng nhập CMSV6 thành công nhưng chưa tìm thấy điểm GPS của thiết bị ${deviceId} trong khoảng truy vấn.`,
    meta: {
      track_count: trackCount,
      gps_source: useStatus ? 'realtime-status' : 'track-history',
      cms_result: rawResult,
      password_mode: session.passwordMode,
    },
  }
}

export async function cmsv6Diagnostic(deviceId = '') {
  const session = await cmsv6Login(true)
  const accountVehicles = await cmsv6ListVehicles().catch(() => null)
  const result = {
    ok: true,
    api_root: session.apiRoot,
    account_name: session.accountName,
    session_obtained: Boolean(session.jsession),
    password_mode: session.passwordMode,
    device_id: deviceId || null,
    account_vehicle_count: accountVehicles?.count ?? null,
    account_vehicles: accountVehicles?.vehicles ?? [],
    channels_per_vehicle: 2,
  }
  if (deviceId) {
    const state = await cmsv6VehicleState(deviceId, { channelCount: 1 })
    result.gps_found = state.gps.lat != null && state.gps.lng != null
    result.online = state.online
    result.updated_at = state.updated_at
    result.camera_player_ready = Boolean(state.channels?.[0]?.player_url)
  }
  return result
}
