import { supabase } from './supabase'
export interface NavicomGpsState {
  lat: number | null
  lng: number | null
  speed_kph?: number | null
  heading?: number | null
  ignition?: boolean | null
  updated_at?: string | null
  address?: string | null
}

export interface NavicomCameraChannel {
  id: string
  label: string
  online?: boolean
  player_url?: string | null
  hls_url?: string | null
  snapshot_url?: string | null
  external_url?: string | null
}


export interface NavicomAccountVehicle {
  key: string
  device_id: string | null
  plate_number: string | null
  vehicle_name: string | null
  channel_count: number
}

export interface NavicomAccountVehiclesResponse {
  account_name?: string | null
  count: number
  channels_per_vehicle: number
  vehicles: NavicomAccountVehicle[]
  action?: string | null
}

export interface NavicomVehicleState {
  device_id: string
  online: boolean
  /** 'cmsv6-status': CMSV6 xác nhận online/offline thật; 'gps': chỉ suy ra từ độ mới GPS. */
  online_source?: 'cmsv6-status' | 'gps' | null
  /** Thời điểm thiết bị chuyển sang trạng thái online hiện tại (gateway theo dõi). */
  online_since?: string | null
  device_name?: string | null
  gps: NavicomGpsState
  channels: NavicomCameraChannel[]
  updated_at?: string | null
  source?: string | null
  message?: string | null
}

const gatewayBase = String(import.meta.env.VITE_NAVICOM_GATEWAY_URL ?? '/api/navicom').replace(/\/$/, '')

export function navicomGatewayConfigured() {
  return Boolean(gatewayBase)
}

async function navicomFetch<T>(path: string, signal?: AbortSignal): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (supabase) {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (token) headers.Authorization = `Bearer ${token}`
  }
  const response = await fetch(`${gatewayBase}${path}`, {
    method: 'GET',
    credentials: 'same-origin',
    headers,
    signal,
  })
  let body: unknown = null
  try { body = await response.json() } catch { /* ignore */ }
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body ? String((body as { message?: unknown }).message ?? '') : ''
    throw new Error(message || `Navicom gateway trả về HTTP ${response.status}.`)
  }
  return body as T
}

export function fetchNavicomHealth(signal?: AbortSignal) {
  return navicomFetch<{ ok: boolean; mode?: string; configured?: boolean; message?: string }>('/health', signal)
}

export function fetchNavicomVehicleState(deviceId: string, channelCount?: number | null, signal?: AbortSignal) {
  const count = Number(channelCount)
  const query = Number.isFinite(count) && count > 0 ? `?channels=${encodeURIComponent(String(Math.round(count)))}` : ''
  return navicomFetch<NavicomVehicleState>(`/vehicle/${encodeURIComponent(deviceId)}${query}`, signal)
}

export function fetchNavicomAccountVehicles(signal?: AbortSignal) {
  return navicomFetch<NavicomAccountVehiclesResponse>('/vehicles', signal)
}
