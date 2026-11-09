import { useCallback, useEffect, useRef, useState } from 'react'
import type { NavicomVehicleState } from './navicom'

/**
 * Vòng đời trình phát camera Navicom (v3.0.0).
 *
 * Lỗi cũ: khi xe tắt máy, iframe CMSV6 đã được tải và báo "thiết bị offline".
 * Lúc xe nổ máy lại, URL player không đổi nên React giữ nguyên iframe cũ → camera
 * không bao giờ hiện cho tới khi người dùng tải lại trang.
 *
 * Hook này theo dõi trạng thái thiết bị và tăng `epoch` khi xe chuyển sang online
 * (hoặc bật ACC / thiết bị khởi động lại). `epoch` nằm trong `key` của iframe nên
 * trình phát được tạo mới. Có một khoảng chờ ngắn để đầu ghi kịp khởi động luồng video.
 */
export type CameraLiveness = 'online' | 'offline' | 'unknown'

export const CAMERA_WARMUP_MS = 6_000
const GPS_FRESH_MS = 3 * 60_000
export const GATEWAY_FAILURES_BEFORE_ERROR = 3

export function cameraLiveness(state: NavicomVehicleState | null | undefined, gatewayFailures = 0): CameraLiveness {
  if (!state || gatewayFailures >= GATEWAY_FAILURES_BEFORE_ERROR) return 'unknown'
  if (state.online_source === 'cmsv6-status') return state.online ? 'online' : 'offline'
  // Gateway cũ / không có API trạng thái: GPS mới hoặc ACC bật thì coi như online,
  // còn lại để trình phát CMSV6 tự xác nhận (không chặn video vì GPS cũ).
  const stamp = state.gps?.updated_at || state.updated_at
  const fresh = stamp ? Date.now() - new Date(stamp).getTime() <= GPS_FRESH_MS : false
  if (fresh || state.gps?.ignition === true || state.online) return 'online'
  return 'unknown'
}

export function useCameraLifecycle(state: NavicomVehicleState | null | undefined, gatewayFailures = 0) {
  const liveness = cameraLiveness(state, gatewayFailures)
  const ignitionOn = state?.gps?.ignition === true
  // Khóa "phiên online": đổi khi xe online lại, thiết bị khởi động lại hoặc bật ACC.
  const sessionKey = liveness === 'online' ? `on|${state?.online_since ?? ''}|${ignitionOn ? 'acc' : ''}` : `off|${liveness}`
  const [epoch, setEpoch] = useState(0)
  const [waking, setWaking] = useState(false)
  const previousKeyRef = useRef<string | null>(null)

  useEffect(() => {
    const previous = previousKeyRef.current
    previousKeyRef.current = sessionKey
    // Lần đầu mở trang: không cần chờ, phát ngay nếu xe đang online.
    if (previous == null || previous === sessionKey || liveness !== 'online') {
      if (liveness !== 'online') setWaking(false)
      return
    }
    setWaking(true)
    const timer = window.setTimeout(() => {
      setWaking(false)
      setEpoch((value) => value + 1)
    }, CAMERA_WARMUP_MS)
    return () => window.clearTimeout(timer)
  }, [liveness, sessionKey])

  const reload = useCallback(() => {
    setWaking(false)
    setEpoch((value) => value + 1)
  }, [])

  return { liveness, epoch, waking, reload }
}
