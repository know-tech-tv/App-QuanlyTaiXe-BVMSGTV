import type { ReactElement } from 'react'

/**
 * Bộ biểu tượng nét (stroke) dùng thống nhất toàn hệ thống, thay cho emoji.
 * Nét 1.8px, góc bo tròn, kế thừa màu chữ (currentColor).
 */
export type IconName =
  | 'dashboard' | 'requests' | 'dispatch' | 'vehicle' | 'bus' | 'expenses' | 'receipt' | 'incident' | 'alert' | 'maintenance' | 'wrench'
  | 'reports' | 'chart' | 'account' | 'user' | 'users' | 'bell' | 'bell-off' | 'search' | 'refresh' | 'check' | 'check-circle' | 'x' | 'plus'
  | 'clock' | 'pin' | 'flag' | 'map' | 'phone' | 'file' | 'paperclip' | 'camera' | 'image' | 'calendar' | 'fuel' | 'money' | 'shield'
  | 'zap' | 'inbox' | 'download' | 'copy' | 'print' | 'logout' | 'home' | 'menu' | 'chevron-right' | 'chevron-left' | 'arrow-right'
  | 'mic' | 'cloud-off' | 'gauge' | 'route' | 'hospital' | 'eye' | 'list' | 'lock' | 'navigation' | 'play' | 'road' | 'parking' | 'droplet'
  | 'smartphone' | 'monitor' | 'activity' | 'trash' | 'edit' | 'upload' | 'sparkles' | 'link'

const PATHS: Record<IconName, ReactElement> = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  requests: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" /></>,
  dispatch: <><circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M8 19h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H16" /></>,
  vehicle: <><path d="M5 17H3v-5l2-5h11l3 5h2v5h-2" /><circle cx="7.5" cy="17.5" r="2" /><circle cx="16.5" cy="17.5" r="2" /><path d="M9.5 17.5h5M5 12h16" /></>,
  bus: <><rect x="4" y="3" width="16" height="15" rx="3" /><path d="M4 11h16M8 21v-3M16 21v-3" /><circle cx="8" cy="14.5" r=".8" /><circle cx="16" cy="14.5" r=".8" /></>,
  expenses: <><circle cx="12" cy="12" r="9" /><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2" /></>,
  receipt: <><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  incident: <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5h.01" /></>,
  maintenance: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />,
  wrench: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />,
  reports: <><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  account: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2 20a7 7 0 0 1 14 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 20a7 7 0 0 0-2-5" /></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></>,
  'bell-off': <><path d="M8.7 3.3A6 6 0 0 1 18 8c0 3 .5 5 1.2 6.4M17 17H3s3-2 3-9c0-.5 0-1 .2-1.5" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0M2 2l20 20" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  refresh: <><path d="M20 11a8 8 0 0 0-14.8-4M4 5v4h4" /><path d="M4 13a8 8 0 0 0 14.8 4M20 19v-4h-4" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  'check-circle': <><circle cx="12" cy="12" r="9" /><path d="m8 12.5 3 3 5-6" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  pin: <><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  flag: <><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></>,
  map: <><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></>,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />,
  file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>,
  paperclip: <path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4L15.5 7" />,
  camera: <><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.5" r="3.5" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="9.5" r="1.8" /><path d="m21 16-5-5-9 9" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  fuel: <><path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M4 10h10" /><path d="M14 8h2a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V9l-3-3" /></>,
  money: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 9.5v5M18 9.5v5" /></>,
  shield: <><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  zap: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  inbox: <><path d="M3 13h5l1.5 3h5L16 13h5" /><path d="M5.5 5h13L21 13v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z" /></>,
  download: <><path d="M12 3v12M7 10l5 5 5-5M4 21h16" /></>,
  copy: <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
  print: <><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M6 14h12v7H6z" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></>,
  home: <><path d="m3 11 9-7 9 7" /><path d="M5 10v10h14V10M10 20v-6h4v6" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  'chevron-right': <path d="m9 6 6 6-6 6" />,
  'chevron-left': <path d="m15 6-6 6 6 6" />,
  'arrow-right': <path d="M5 12h14M13 6l6 6-6 6" />,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  'cloud-off': <><path d="M3 3l18 18M9 5.3A6 6 0 0 1 17.7 9 4.5 4.5 0 0 1 20 17M17 19H7a5 5 0 0 1-1.6-9.7" /></>,
  gauge: <><path d="M4.2 17a9 9 0 1 1 15.6 0" /><path d="m12 13 4-5" /><circle cx="12" cy="13.5" r="1.5" /></>,
  route: <><circle cx="6" cy="19" r="2.5" /><circle cx="18" cy="5" r="2.5" /><path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5" /></>,
  hospital: <><path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16M2 21h20" /><path d="M12 7v6M9 10h6M10 21v-4h4v4" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  list: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  navigation: <path d="M3 11 21 3l-8 18-2-8z" />,
  play: <path d="M7 4.5v15l12-7.5z" />,
  road: <><path d="M5 21 9 3M19 21 15 3M12 5v3M12 11v3M12 17v3" /></>,
  parking: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M9 17V7h4a3 3 0 0 1 0 6H9" /></>,
  droplet: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  smartphone: <><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" /></>,
  monitor: <><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3" /></>,
  edit: <><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></>,
  upload: <><path d="M12 21V9M7 14l5-5 5 5M4 3h16" /></>,
  link: <><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" /></>,
  sparkles: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></>,
}

export function Icon({ name, size = 18, className = '', strokeWidth = 1.8, title }: { name: IconName; size?: number; className?: string; strokeWidth?: number; title?: string }) {
  return <svg
    className={`ui-icon ${className}`.trim()}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden={title ? undefined : true}
    role={title ? 'img' : undefined}
  >{title && <title>{title}</title>}{PATHS[name]}</svg>
}

/** Chuyển các emoji cũ (còn dùng làm tham số) sang biểu tượng nét. */
const EMOJI_TO_ICON: Record<string, IconName> = {
  '🚐': 'bus', '🚘': 'vehicle', '🧾': 'receipt', '🔧': 'wrench', '⚠️': 'incident', '⚠': 'incident', '📄': 'file', '📷': 'camera', '📸': 'camera',
  '📎': 'paperclip', '👤': 'user', '📍': 'pin', '✅': 'check-circle', '✓': 'check-circle', '🖼': 'image', '🕒': 'clock', '⏰': 'clock', '🗺': 'map', '☎': 'phone',
  '💵': 'money', '💰': 'money', '🔔': 'bell', '🔕': 'bell-off', '🎙': 'mic', '🏥': 'hospital', '🛡': 'shield', '🏁': 'flag', '⛽': 'fuel', '📅': 'calendar',
  '📥': 'inbox', '📭': 'inbox', '☑': 'check-circle', '📲': 'smartphone', '📊': 'chart', '⚡': 'zap', '🛣️': 'road', '🛣': 'road', '🅿️': 'parking', '🧽': 'droplet',
  '🔍': 'search', '⌕': 'search', '!': 'alert', '🟢': 'activity',
}

export function iconFromEmoji(value: string | undefined, fallback: IconName = 'inbox'): IconName {
  if (!value) return fallback
  if (value in PATHS) return value as IconName
  return EMOJI_TO_ICON[value] ?? EMOJI_TO_ICON[value.replace('️', '')] ?? fallback
}
