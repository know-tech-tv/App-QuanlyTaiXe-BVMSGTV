import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { enterLandscapeFullscreen, exitLandscapeFullscreen, fullscreenElement } from '../lib/cameraFullscreen'
import type { NavicomCameraChannel } from '../lib/navicom'
import type { CameraLiveness } from '../lib/navicomCamera'

/**
 * Ô xem một kênh camera Navicom — dùng chung cho Theo dõi xe và Navicom Monitor.
 * `epoch` (từ useCameraLifecycle) nằm trong key của iframe: mỗi lần xe nổ máy /
 * online lại, trình phát CMSV6 được tạo mới thay vì kẹt ở màn hình "offline".
 */
export function NavicomCameraPane({ channel, title, liveness, epoch, waking, gatewayError, onReload, className = '' }: {
  channel: NavicomCameraChannel | null
  title: string
  liveness: CameraLiveness
  epoch: number
  waking: boolean
  gatewayError?: string | null
  onReload: () => void
  className?: string
}) {
  const cardRef = useRef<HTMLElement | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [forceLandscape, setForceLandscape] = useState(false)
  const [forcePlay, setForcePlay] = useState(false)

  const streamKey = channel?.player_url || channel?.hls_url || channel?.snapshot_url || ''
  // Khi xe online lại thì bỏ chế độ "thử phát" thủ công.
  useEffect(() => { if (liveness === 'online') setForcePlay(false) }, [liveness])

  useEffect(() => {
    if (!expanded) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleFullscreen = () => {
      if (!fullscreenElement()) {
        setExpanded(false)
        setForceLandscape(false)
      }
    }
    document.addEventListener('fullscreenchange', handleFullscreen)
    document.addEventListener('webkitfullscreenchange', handleFullscreen as EventListener)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('fullscreenchange', handleFullscreen)
      document.removeEventListener('webkitfullscreenchange', handleFullscreen as EventListener)
    }
  }, [expanded])

  async function toggleFullscreen() {
    if (expanded) {
      await exitLandscapeFullscreen()
      setExpanded(false)
      setForceLandscape(false)
      return
    }
    setExpanded(true)
    const element = cardRef.current
    if (!element) return
    const result = await enterLandscapeFullscreen(element)
    setForceLandscape(!result.orientationLocked)
  }

  const offline = liveness === 'offline' || channel?.online === false
  const canPlay = Boolean(streamKey) && !waking && !gatewayError && (!offline || forcePlay)
  const dotTone = waking ? 'unknown' : offline ? 'offline' : liveness === 'online' ? 'online' : 'unknown'
  const playerKey = `${streamKey}#${epoch}`

  let body
  if (waking) {
    body = <div className="camera-wake-state"><i className="spinner-small" /><strong>Xe vừa khởi động</strong><span>Đang chờ đầu ghi Navicom mở luồng video, camera sẽ tự hiện sau vài giây.</span></div>
  } else if (gatewayError) {
    body = <div className="fleet-camera-unavailable fleet-camera-pending"><Icon name="cloud-off" size={24} /><strong>Không kết nối được Navicom Gateway</strong><span>{gatewayError}</span><button type="button" className="camera-retry-button" onClick={onReload}>Thử lại</button></div>
  } else if (offline && !forcePlay) {
    body = <div className="fleet-camera-unavailable fleet-camera-pending"><Icon name="cloud-off" size={24} /><strong>Xe đang tắt máy hoặc mất tín hiệu</strong><span>Camera sẽ tự kết nối lại ngay khi xe khởi động.</span>{streamKey && <button type="button" className="camera-retry-button" onClick={() => setForcePlay(true)}>Thử phát camera</button>}</div>
  } else if (!streamKey) {
    body = <div className="fleet-camera-unavailable fleet-camera-pending"><Icon name="camera" size={24} /><strong>{title} chưa khả dụng</strong><span>Gateway chưa cung cấp đường dẫn phát video cho kênh này.</span></div>
  } else if (channel?.player_url) {
    body = <iframe
      key={playerKey}
      title={title}
      src={channel.player_url}
      loading="eager"
      allow="autoplay; fullscreen; picture-in-picture"
      allowFullScreen
      // Chặn alert()/confirm() của player Navicom; vẫn cho chạy script và phát video.
      sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
    />
  } else if (channel?.hls_url) {
    body = <video key={playerKey} src={channel.hls_url} controls autoPlay muted playsInline />
  } else {
    body = <img key={playerKey} src={channel?.snapshot_url ?? ''} alt={title} />
  }

  return <article ref={cardRef} className={`fleet-camera-card ${expanded ? 'camera-landscape-expanded' : ''} ${forceLandscape ? 'camera-force-landscape' : ''} ${className}`.trim()}>
    <header>
      <div><span className={`fleet-camera-dot ${dotTone}`} /><strong>{channel?.label || title}</strong></div>
      <div className="fleet-camera-actions">
        {streamKey && !waking && <button type="button" className="camera-reload-button" onClick={onReload} title="Tạo lại kết nối camera"><Icon name="refresh" size={13} />Tải lại</button>}
        {canPlay && channel?.external_url && <a href={channel.external_url} target="_blank" rel="noopener noreferrer">Mở riêng</a>}
        {canPlay && <button type="button" onClick={() => void toggleFullscreen()}>{expanded ? 'Thoát' : 'Phóng to ngang'}</button>}
      </div>
    </header>
    <div className={`fleet-camera-frame ${canPlay ? '' : 'is-unverified'}`}>{body}</div>
    {expanded && forceLandscape && <div className="camera-rotate-hint">Đang hiển thị ngang để xem camera rõ hơn</div>}
  </article>
}
