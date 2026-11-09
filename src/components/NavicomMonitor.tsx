import { useEffect, useState } from 'react'
import type { Vehicle } from '../types/models'
import { Icon } from './Icon'
import { NavicomCameraPane } from './NavicomCameraPane'
import { GATEWAY_FAILURES_BEFORE_ERROR, useCameraLifecycle } from '../lib/navicomCamera'
import { formatDateTime } from '../lib/utils'
import { fetchNavicomVehicleState, type NavicomCameraChannel, type NavicomVehicleState } from '../lib/navicom'

const NAVICOM_POLL_MS = 5_000

export function NavicomMonitor({ vehicle, compact = false }: { vehicle: Vehicle | null | undefined; compact?: boolean }) {
  const [state, setState] = useState<NavicomVehicleState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cameraMode, setCameraMode] = useState<'both' | 'front' | 'cabin'>('both')
  const [refreshKey, setRefreshKey] = useState(0)
  const [failures, setFailures] = useState(0)

  const deviceId = vehicle?.navicom_device_id?.trim() ?? ''
  const navicomEnabled = Boolean(vehicle?.navicom_enabled)
  const enabled = Boolean(navicomEnabled && deviceId)

  useEffect(() => {
    if (!enabled) {
      setState(null)
      setError(null)
      return
    }
    let stopped = false
    let controller: AbortController | null = null

    async function load(showLoading = false) {
      controller?.abort()
      controller = new AbortController()
      if (showLoading) setLoading(true)
      try {
        const next = await fetchNavicomVehicleState(deviceId, vehicle?.navicom_channel_count, controller.signal)
        if (stopped) return
        setState(next)
        setError(null)
        setFailures(0)
      } catch (err) {
        if (stopped || (err instanceof DOMException && err.name === 'AbortError')) return
        setError(err instanceof Error ? err.message : String(err))
        setFailures((value) => value + 1)
      } finally {
        if (!stopped) setLoading(false)
      }
    }

    void load(true)
    const timer = window.setInterval(() => void load(false), NAVICOM_POLL_MS)
    return () => {
      stopped = true
      controller?.abort()
      window.clearInterval(timer)
    }
  }, [deviceId, enabled, refreshKey, vehicle?.navicom_channel_count])


  if (!vehicle) return null
  if (!navicomEnabled) return <section className={`navicom-monitor ${compact ? 'compact' : ''} unconfigured`}>
    <div className="navicom-monitor-head"><div><span className="navicom-brand-dot" /><div><strong>Xe chưa bật tích hợp Navicom</strong><small>Vào Quản lý xe → Chỉnh sửa → bật “Kích hoạt Navicom”.</small></div></div></div>
  </section>
  if (!deviceId) return <section className={`navicom-monitor ${compact ? 'compact' : ''} unconfigured`}>
    <div className="navicom-monitor-head"><div><span className="navicom-brand-dot" /><div><strong>Thiếu mã thiết bị Navicom</strong><small>{vehicle.plate_number}: chọn xe từ tài khoản Navicom hoặc nhập Device ID / IMEI rồi lưu lại.</small></div></div></div>
  </section>

  const hasCoordinates = state?.gps?.lat != null && state?.gps?.lng != null

  return <section className={`navicom-monitor ${compact ? 'compact' : ''}`}>
    <div className="navicom-monitor-head">
      <div><span className={`navicom-brand-dot ${state?.online ? 'online' : ''}`} /><div><strong>Navicom · {vehicle.plate_number}</strong><small>{loading && !state ? 'Đang kết nối thiết bị...' : state?.online ? 'Thiết bị online · GPS & camera đang cập nhật trực tiếp' : state?.gps?.updated_at ? 'Xe đang tắt máy · camera tự kết nối lại khi xe khởi động' : 'Chưa có dữ liệu GPS mới'}</small></div></div>
      <button type="button" className="navicom-refresh-button" onClick={() => setRefreshKey((value) => value + 1)} aria-label="Làm mới Navicom"><Icon name="refresh" size={15} /></button>
    </div>

    {error && failures >= GATEWAY_FAILURES_BEFORE_ERROR && <div className="navicom-error"><Icon name="alert" size={15} /><span>{error}</span></div>}
    {state?.message && <div className="navicom-mode-note"><Icon name="alert" size={15} /><span>{state.message}</span></div>}

    {state && <>
      <div className="navicom-status-grid">
        <div><span>Vị trí GPS Navicom</span><strong>{state.gps.address || (hasCoordinates ? `${state.gps.lat!.toFixed(6)}, ${state.gps.lng!.toFixed(6)}` : 'Chưa có tọa độ')}</strong></div>
        <div><span>Tốc độ</span><strong>{state.gps.speed_kph != null ? `${Math.round(state.gps.speed_kph)} km/h` : '—'}</strong></div>
        <div><span>Trạng thái xe</span><strong>{state.gps.ignition == null ? '—' : state.gps.ignition ? 'Đang bật máy' : 'Đã tắt máy'}</strong></div>
        <div><span>Cập nhật gần nhất</span><strong>{state.gps.updated_at ? formatDateTime(state.gps.updated_at) : state.updated_at ? formatDateTime(state.updated_at) : '—'}</strong></div>
      </div>

      {hasCoordinates && <NavicomRealtimeMap
        lat={state.gps.lat!}
        lng={state.gps.lng!}
        plateNumber={vehicle.plate_number}
        speedKph={state.gps.speed_kph}
        updatedAt={state.gps.updated_at ?? state.updated_at}
        address={state.gps.address}
        compact={compact}
      />}

      {!compact && <CameraViewer key={deviceId} state={state} failures={failures} error={error} mode={cameraMode} onMode={setCameraMode} />}
    </>}
  </section>
}

function NavicomRealtimeMap({ lat, lng, plateNumber, speedKph, updatedAt, address, compact }: {
  lat: number
  lng: number
  plateNumber: string
  speedKph?: number | null
  updatedAt?: string | null
  address?: string | null
  compact?: boolean
}) {
  const deltaLat = compact ? 0.006 : 0.012
  const deltaLng = compact ? 0.009 : 0.018
  const bbox = `${lng - deltaLng},${lat - deltaLat},${lng + deltaLng},${lat + deltaLat}`
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lng}`)}`
  const externalUrl = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(String(lat))}&mlon=${encodeURIComponent(String(lng))}#map=17/${encodeURIComponent(String(lat))}/${encodeURIComponent(String(lng))}`

  return <section className={`navicom-realtime-map ${compact ? 'compact' : ''}`}>
    <div className="navicom-map-head">
      <div>
        <span className="navicom-map-live-dot" />
        <div><strong>Vị trí xe realtime</strong><small>Tự cập nhật từ GPS Navicom mỗi 5 giây</small></div>
      </div>
      <a href={externalUrl} target="_blank" rel="noreferrer" className="navicom-map-external" aria-label="Mở bản đồ lớn">Mở rộng</a>
    </div>
    <div className="navicom-map-canvas">
      <iframe
        key={`${lat.toFixed(6)}-${lng.toFixed(6)}`}
        title={`Vị trí realtime ${plateNumber}`}
        src={mapUrl}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="navicom-map-floating-card">
        <strong>{plateNumber}</strong>
        <span>{speedKph != null ? `${Math.round(speedKph)} km/h` : 'Chưa có tốc độ'}</span>
      </div>
    </div>
    <div className="navicom-map-footer">
      <div><span>Tọa độ</span><strong>{lat.toFixed(6)}, {lng.toFixed(6)}</strong></div>
      <div><span>Vị trí</span><strong>{address || 'Theo tọa độ GPS Navicom'}</strong></div>
      <div><span>Cập nhật</span><strong>{updatedAt ? formatDateTime(updatedAt) : '—'}</strong></div>
    </div>
  </section>
}

function CameraViewer({ state, failures, error, mode, onMode }: { state: NavicomVehicleState; failures: number; error: string | null; mode: 'both' | 'front' | 'cabin'; onMode: (mode: 'both' | 'front' | 'cabin') => void }) {
  // Trước v3.0.0 camera bị chặn khi GPS cũ hơn 2 phút → xe vừa nổ máy (GPS lịch sử
  // về chậm) luôn hiện "Xe đang offline". Nay dùng trạng thái online thật từ gateway.
  const camera = useCameraLifecycle(state, failures)
  const channels = (state.channels ?? []).slice(0, 2)
  if (!channels.length) return <div className="navicom-camera-empty"><Icon name="camera" size={18} /><span>Thiết bị chưa trả về kênh camera.</span></div>
  const gatewayError = failures >= GATEWAY_FAILURES_BEFORE_ERROR ? error : null
  const pane = (channel: NavicomCameraChannel | null, title: string) => <NavicomCameraPane channel={channel} title={title} liveness={camera.liveness} epoch={camera.epoch} waking={camera.waking} gatewayError={gatewayError} onReload={camera.reload} className="navicom-camera-pane" />

  return <div className="navicom-camera-block dual-camera-viewer">
    <div className="navicom-camera-tabs dual" role="tablist">
      <button type="button" className={mode === 'both' ? 'active' : ''} onClick={() => onMode('both')}>Cả 2 camera</button>
      <button type="button" className={mode === 'front' ? 'active' : ''} onClick={() => onMode('front')}>Camera trước</button>
      <button type="button" className={mode === 'cabin' ? 'active' : ''} onClick={() => onMode('cabin')}>Camera cabin</button>
    </div>
    <div className={`navicom-dual-player mode-${mode}`}>
      {(mode === 'both' || mode === 'front') && pane(channels[0] ?? null, 'Camera trước')}
      {(mode === 'both' || mode === 'cabin') && pane(channels[1] ?? null, 'Camera cabin')}
    </div>
  </div>
}
