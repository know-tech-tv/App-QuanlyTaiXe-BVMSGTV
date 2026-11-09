import http from 'node:http'
import { URL } from 'node:url'
import { cmsv6Diagnostic, cmsv6ListVehicles, cmsv6VehicleState } from './cmsv6.mjs'

const port = Number(process.env.NAVICOM_GATEWAY_PORT || 3020)
const host = process.env.NAVICOM_GATEWAY_HOST || '127.0.0.1'
const mode = process.env.NAVICOM_MODE || 'unconfigured'

const allowedRoles = new Set(['director', 'fleet', 'dispatcher', 'admin'])

async function authorizeRequest(req) {
  if (String(process.env.NAVICOM_SKIP_AUTH || '').toLowerCase() === 'true') return { ok: true, role: 'local-test' }
  const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '')
  const anonKey = process.env.SUPABASE_ANON_KEY || ''
  if (!supabaseUrl || !anonKey) throw new Error('Gateway thiếu SUPABASE_URL hoặc SUPABASE_ANON_KEY để xác thực phân quyền.')
  const authorization = String(req.headers.authorization || '')
  if (!authorization.startsWith('Bearer ')) return { ok: false, status: 401, message: 'Thiếu phiên đăng nhập hợp lệ.' }

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authorization, apikey: anonKey },
  })
  if (!userResponse.ok) return { ok: false, status: 401, message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' }
  const user = await userResponse.json()
  if (!user?.id) return { ok: false, status: 401, message: 'Không xác định được người dùng.' }

  const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role,active&limit=1`, {
    headers: { Authorization: authorization, apikey: anonKey, Accept: 'application/json' },
  })
  if (!profileResponse.ok) return { ok: false, status: 403, message: 'Không đọc được phân quyền Navicom của tài khoản.' }
  const profiles = await profileResponse.json()
  const profile = Array.isArray(profiles) ? profiles[0] : null
  if (!profile?.active || !allowedRoles.has(profile.role)) {
    return { ok: false, status: 403, message: 'Tài khoản không có quyền xem Camera/GPS Navicom.' }
  }
  return { ok: true, role: profile.role }
}

function json(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  res.end(JSON.stringify(body))
}

function renderTemplate(template, vars) {
  return String(template || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => encodeURIComponent(vars[key] ?? ''))
}

function authHeaders() {
  const authMode = process.env.NAVICOM_AUTH_MODE || 'none'
  if (authMode === 'basic') {
    const value = Buffer.from(`${process.env.NAVICOM_USERNAME || ''}:${process.env.NAVICOM_PASSWORD || ''}`).toString('base64')
    return { Authorization: `Basic ${value}` }
  }
  if (authMode === 'bearer' && process.env.NAVICOM_TOKEN) return { Authorization: `Bearer ${process.env.NAVICOM_TOKEN}` }
  return {}
}

async function canonicalHttpState(deviceId) {
  const template = process.env.NAVICOM_STATUS_URL_TEMPLATE
  if (!template) throw new Error('Chưa cấu hình NAVICOM_STATUS_URL_TEMPLATE cho adapter Navicom.')
  const url = renderTemplate(template, { deviceId })
  const response = await fetch(url, { headers: { Accept: 'application/json', ...authHeaders() } })
  if (!response.ok) throw new Error(`Navicom upstream trả về HTTP ${response.status}.`)
  const data = await response.json()
  if (!data || typeof data !== 'object') throw new Error('Navicom upstream không trả JSON hợp lệ.')
  return normalizeCanonical(deviceId, data)
}

function normalizeCanonical(deviceId, data) {
  // Adapter canonical: khi xác định API Navicom thật, chỉ cần map response về cấu trúc này.
  const gps = data.gps && typeof data.gps === 'object' ? data.gps : {}
  const channels = Array.isArray(data.channels) ? data.channels : []
  return {
    device_id: String(data.device_id || deviceId),
    device_name: data.device_name ?? null,
    online: Boolean(data.online),
    gps: {
      lat: numberOrNull(gps.lat),
      lng: numberOrNull(gps.lng),
      speed_kph: numberOrNull(gps.speed_kph),
      heading: numberOrNull(gps.heading),
      ignition: typeof gps.ignition === 'boolean' ? gps.ignition : null,
      updated_at: gps.updated_at ?? null,
      address: gps.address ?? null,
    },
    channels: channels.map((item, index) => ({
      id: String(item.id ?? index + 1),
      label: String(item.label ?? `Camera ${index + 1}`),
      online: item.online !== false,
      player_url: item.player_url ?? null,
      hls_url: item.hls_url ?? null,
      snapshot_url: item.snapshot_url ?? null,
    })),
    updated_at: data.updated_at ?? gps.updated_at ?? null,
    source: 'navicom-gateway',
  }
}

function numberOrNull(value) {
  if (value == null || String(value).trim() === '') return null
  const next = Number(value)
  return Number.isFinite(next) ? next : null
}

function mockState(deviceId) {
  const lat = numberOrNull(process.env.NAVICOM_MOCK_LAT)
  const lng = numberOrNull(process.env.NAVICOM_MOCK_LNG)
  const count = Math.max(0, Number(process.env.NAVICOM_MOCK_CHANNELS || 2))
  // NAVICOM_MOCK_CYCLE_SECONDS=60: xe luân phiên tắt máy/nổ máy để kiểm thử camera tự kết nối lại.
  const cycleSeconds = Number(process.env.NAVICOM_MOCK_CYCLE_SECONDS || 0)
  const nowMs = Date.now()
  const phase = cycleSeconds > 0 ? Math.floor(nowMs / (cycleSeconds * 1000)) : 0
  const online = cycleSeconds > 0 ? phase % 2 === 0 : true
  const phaseStart = new Date(cycleSeconds > 0 ? phase * cycleSeconds * 1000 : nowMs).toISOString()
  const gpsAt = online ? new Date(nowMs).toISOString() : phaseStart
  const playerTemplate = process.env.NAVICOM_MOCK_PLAYER_URL || ''
  return {
    device_id: deviceId,
    device_name: `Thiết bị ${deviceId}`,
    online,
    online_source: 'cmsv6-status',
    online_since: phaseStart,
    gps: {
      lat,
      lng,
      speed_kph: online ? Number(process.env.NAVICOM_MOCK_SPEED || 0) : 0,
      heading: null,
      ignition: online,
      updated_at: gpsAt,
      address: process.env.NAVICOM_MOCK_ADDRESS || null,
    },
    channels: Array.from({ length: count }, (_, index) => ({
      id: String(index + 1),
      label: index === 0 ? 'Camera trước' : index === 1 ? 'Camera cabin' : `Camera ${index + 1}`,
      online,
      player_url: playerTemplate ? renderTemplate(playerTemplate, { deviceId, channel: String(index) }) : null,
      external_url: null,
      hls_url: null,
      snapshot_url: null,
    })),
    updated_at: gpsAt,
    source: 'mock',
    message: 'Chế độ mô phỏng. Chưa kết nối API Navicom thật.',
  }
}

async function getVehicleState(deviceId, options = {}) {
  if (mode === 'mock') return mockState(deviceId)
  if (mode === 'cmsv6') return cmsv6VehicleState(deviceId, options)
  if (mode === 'canonical-http') return canonicalHttpState(deviceId)
  throw new Error('Navicom gateway chưa được cấu hình adapter. Hãy đặt NAVICOM_MODE=cmsv6 để kết nối API CMSV6 thật, hoặc NAVICOM_MODE=mock để test giao diện.')
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    if (req.method !== 'GET') return json(res, 405, { message: 'Chỉ hỗ trợ GET.' })

    if (url.pathname === '/health') {
      // Health endpoint intentionally public: only reports gateway readiness, no vehicle/GPS/camera data.
      return json(res, 200, {
        ok: true,
        mode,
        configured: mode !== 'unconfigured',
        adapter: mode === 'cmsv6' ? 'CMSV6 Standard API' : mode,
        message: mode === 'unconfigured' ? 'Gateway đã chạy nhưng chưa cấu hình adapter Navicom.' : mode === 'cmsv6' ? 'Gateway sẵn sàng kết nối CMSV6 thật.' : 'Gateway sẵn sàng.',
      })
    }

    if (url.pathname === '/vehicles') {
      const auth = await authorizeRequest(req)
      if (!auth.ok) return json(res, auth.status, { message: auth.message })
      if (mode !== 'cmsv6') return json(res, 400, { message: 'NAVICOM_MODE phải là cmsv6 để lấy danh sách xe thật.' })
      const result = await cmsv6ListVehicles()
      return json(res, 200, result)
    }

    if (url.pathname === '/diagnostic/cmsv6') {
      const auth = await authorizeRequest(req)
      if (!auth.ok) return json(res, auth.status, { message: auth.message })
      if (auth.role !== 'admin') return json(res, 403, { message: 'Chỉ Quản trị được chạy chẩn đoán CMSV6.' })
      if (mode !== 'cmsv6') return json(res, 400, { message: 'NAVICOM_MODE phải là cmsv6.' })
      const deviceId = String(url.searchParams.get('deviceId') || '').trim()
      const result = await cmsv6Diagnostic(deviceId)
      return json(res, 200, result)
    }

    const match = url.pathname.match(/^\/vehicle\/([^/]+)$/)
    if (match) {
      const auth = await authorizeRequest(req)
      if (!auth.ok) return json(res, auth.status, { message: auth.message })
      const channelCount = Number(url.searchParams.get('channels') || 0)
      const state = await getVehicleState(decodeURIComponent(match[1]), { channelCount })
      return json(res, 200, state)
    }

    return json(res, 404, { message: 'Không tìm thấy endpoint Navicom gateway.' })
  } catch (error) {
    return json(res, 502, { message: error instanceof Error ? error.message : String(error) })
  }
})

server.listen(port, host, () => {
  console.log(`[Navicom Gateway] http://${host}:${port} · mode=${mode}`)
})
