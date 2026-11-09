import { BRAND_LOGO_SMALL } from '../lib/brand'
import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { ROLE_LABELS } from '../lib/constants'
import { NetworkBanner } from './NetworkBanner'
import { useData } from '../context/DataContext'
import { NotificationCenter } from './NotificationCenter'
import { useNotifications, type NotificationTarget } from '../context/NotificationContext'
import { queueNavigationFocus } from '../lib/focusNavigation'
import { GlobalSearch } from './GlobalSearch'
import { OnlineUsersButton } from './Presence'
import { Icon, type IconName } from './Icon'
import { NavicomFleetWatcher } from './NavicomFleetWatcher'

export type PageKey = 'dashboard' | 'requests' | 'dispatch' | 'tracking' | 'vehicles' | 'expenses' | 'incidents' | 'maintenance' | 'reports' | 'account' | 'users'

export const PAGE_PATHS: Record<PageKey, string> = {
  dashboard: '/tong-quan',
  requests: '/de-nghi-xe',
  dispatch: '/dieu-xe',
  tracking: '/theo-doi-xe',
  vehicles: '/ho-so-xe',
  expenses: '/chi-phi',
  incidents: '/su-co',
  maintenance: '/bao-duong',
  reports: '/bao-cao',
  account: '/ho-so',
  users: '/tai-khoan',
}

export function pageFromPath(pathname: string): PageKey {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  if (normalized === '/') return 'dashboard'
  const match = (Object.entries(PAGE_PATHS) as Array<[PageKey, string]>).find(([, path]) => path === normalized)
  return match?.[0] ?? 'dashboard'
}

type RoleKey = 'department_head' | 'dispatcher' | 'accountant' | 'fleet' | 'director' | 'admin'
type NavGroup = 'operate' | 'assets' | 'analyze' | 'system'

const navigation: Array<{ key: PageKey; label: string; mobileLabel: string; icon: IconName; hint: string; group: NavGroup; roles: string[] }> = [
  { key: 'dashboard', label: 'Tổng quan', mobileLabel: 'Tổng quan', icon: 'dashboard', hint: 'Điều hành theo vai trò', group: 'operate', roles: ['dispatcher', 'accountant', 'fleet', 'director', 'admin'] },
  { key: 'requests', label: 'Đề nghị từ khoa/phòng', mobileLabel: 'Đề nghị', icon: 'requests', hint: 'Gửi & Hành chính duyệt', group: 'operate', roles: ['department_head', 'fleet', 'admin'] },
  { key: 'dispatch', label: 'Điều xe', mobileLabel: 'Điều xe', icon: 'dispatch', hint: 'Theo dõi chuyến đi', group: 'operate', roles: ['dispatcher', 'accountant', 'fleet', 'director', 'admin'] },
  { key: 'tracking', label: 'Theo dõi xe realtime', mobileLabel: 'Theo dõi', icon: 'navigation', hint: 'GPS & camera Navicom', group: 'operate', roles: ['dispatcher', 'fleet', 'director', 'admin'] },
  { key: 'vehicles', label: 'Hồ sơ xe', mobileLabel: 'Hồ sơ xe', icon: 'vehicle', hint: 'Danh mục & trạng thái xe', group: 'assets', roles: ['dispatcher', 'fleet', 'admin'] },
  { key: 'expenses', label: 'Chi phí', mobileLabel: 'Chi phí', icon: 'expenses', hint: 'Xăng dầu & chứng từ', group: 'assets', roles: ['dispatcher', 'accountant', 'director', 'admin'] },
  { key: 'incidents', label: 'Sự cố', mobileLabel: 'Sự cố', icon: 'incident', hint: 'Xử lý cảnh báo', group: 'assets', roles: ['dispatcher', 'fleet', 'director', 'admin'] },
  { key: 'maintenance', label: 'Bảo dưỡng', mobileLabel: 'Bảo dưỡng', icon: 'maintenance', hint: 'Lịch sửa chữa', group: 'assets', roles: ['dispatcher', 'fleet', 'director', 'admin'] },
  { key: 'reports', label: 'Báo cáo', mobileLabel: 'Báo cáo', icon: 'reports', hint: 'Thống kê tức thời', group: 'analyze', roles: ['dispatcher', 'accountant', 'fleet', 'director', 'admin'] },
  { key: 'users', label: 'Tài khoản', mobileLabel: 'Tài khoản', icon: 'users', hint: 'Phân quyền hệ thống', group: 'system', roles: ['admin'] },
  { key: 'account', label: 'Hồ sơ cá nhân', mobileLabel: 'Hồ sơ', icon: 'account', hint: 'Thông tin tài khoản', group: 'system', roles: ['department_head', 'dispatcher', 'accountant', 'fleet', 'director', 'admin'] },
]

const GROUP_LABELS: Record<NavGroup, string> = {
  operate: 'Điều hành',
  assets: 'Đội xe & chi phí',
  analyze: 'Phân tích',
  system: 'Hệ thống',
}

const pageDescriptions: Record<PageKey, string> = {
  dashboard: 'Chỉ số điều hành, việc cần xử lý và cảnh báo quan trọng trong ngày.',
  requests: 'Trưởng khoa/đơn vị gửi đề nghị xe; Hành chính đội xe duyệt trước khi Điều phối tạo chuyến.',
  dispatch: 'Tạo chuyến, duyệt chuyến, theo dõi vị trí và lịch sử từng chuyến xe.',
  tracking: 'Trung tâm điều hành GPS realtime, camera Navicom và cảnh báo online/offline của toàn đội xe.',
  vehicles: 'Hồ sơ xe, tình trạng, đăng kiểm, bảo hiểm và phân công tài xế.',
  expenses: 'Chi phí phát sinh, hóa đơn, duyệt chi và theo dõi nhiên liệu.',
  incidents: 'Sự cố, mức độ nghiêm trọng và tiến độ xử lý của từng xe.',
  maintenance: 'Kế hoạch bảo dưỡng, sửa chữa và các mốc kỹ thuật.',
  reports: 'Báo cáo vận hành, chi phí và chuyến đột xuất theo kỳ.',
  account: 'Thông tin tài khoản và đổi mật khẩu.',
  users: 'Tạo, chỉnh sửa, phân quyền và theo dõi trạng thái trực tuyến.',
}

export function AppShell({ page, onPage, children }: { page: PageKey; onPage: (page: PageKey) => void; children: ReactNode }) {
  const { user, logout } = useAuth()
  const { error, data, refresh, online } = useData()
  const { unreadByTarget, markTargetRead } = useNotifications()
  const [loggingOut, setLoggingOut] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => { try { return localStorage.getItem('bvms-sidebar-collapsed') === '1' } catch { return false } })
  const [hoverTooltip, setHoverTooltip] = useState<{ label: string; top: number; left: number } | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const currentProfile = data.profiles.find((profile) => profile.id === user?.id) ?? user?.profile
  const visible = navigation.filter((item) => item.roles.includes(currentProfile?.role ?? ''))
  const currentRole = (currentProfile?.role ?? 'dispatcher') as RoleKey

  const notificationCountFor = (key: PageKey) => unreadByTarget[key as NotificationTarget] ?? 0

  function handlePageNavigation(key: PageKey, recordId?: string) {
    markTargetRead(key as NotificationTarget)
    if (recordId && ['requests', 'dispatch', 'tracking', 'expenses', 'incidents', 'maintenance'].includes(key)) {
      queueNavigationFocus(key as 'requests' | 'dispatch' | 'tracking' | 'expenses' | 'incidents' | 'maintenance', recordId)
    }
    setMoreOpen(false)
    onPage(key)
  }

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setHoverTooltip(null)
    const currentLabel = navigation.find((item) => item.key === page)?.label ?? 'Điều phối xe'
    document.title = `${currentLabel} | Bệnh viện mắt Sài Gòn Trà Vinh`
  }, [page])

  useEffect(() => {
    if (!sidebarCollapsed) setHoverTooltip(null)
  }, [sidebarCollapsed])

  useEffect(() => {
    markTargetRead(page as NotificationTarget)
  }, [markTargetRead, page])

  async function handleLogout() {
    if (loggingOut) return
    const accepted = window.confirm('Đăng xuất khỏi hệ thống Điều phối xe?')
    if (!accepted) return

    setLoggingOut(true)
    try {
      await logout()
    } finally {
      setLoggingOut(false)
    }
  }

  async function handleRefresh() {
    if (refreshing) return
    setRefreshing(true)
    try {
      await refresh()
    } finally {
      setRefreshing(false)
    }
  }

  const groups = (Object.keys(GROUP_LABELS) as NavGroup[])
    .map((group) => ({ group, items: visible.filter((item) => item.group === group) }))
    .filter((entry) => entry.items.length)
  const mobilePrimary = visible.filter((item) => item.key !== 'account').slice(0, 4)
  const mobileMore = visible.filter((item) => !mobilePrimary.includes(item))
  const moreBadge = mobileMore.reduce((sum, item) => sum + notificationCountFor(item.key), 0)
  const currentNav = navigation.find((item) => item.key === page)
  const homePage: PageKey = currentRole === 'department_head' ? 'requests' : 'dashboard'

  function toggleSidebar() {
    setSidebarCollapsed((value) => {
      try { localStorage.setItem('bvms-sidebar-collapsed', value ? '0' : '1') } catch { /* bỏ qua */ }
      return !value
    })
  }

  function showTooltip(event: { currentTarget: HTMLElement }, label: string) {
    if (!sidebarCollapsed) return
    const rect = event.currentTarget.getBoundingClientRect()
    setHoverTooltip({ label, top: rect.top + rect.height / 2, left: rect.right + 10 })
  }

  const badge = (count: number, className: string) => count > 0 ? <b className={className}>{count > 99 ? '99+' : count}</b> : null

  return (
    <div className={`app-shell role-${currentRole} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <NavicomFleetWatcher />
      <aside className="sidebar" aria-label="Điều hướng chính">
        <button type="button" className="sidebar-brand" onClick={() => onPage(homePage)} aria-label="Về trang chủ">
          <span className="sidebar-brand-logo"><img src={BRAND_LOGO_SMALL} alt="" /></span>
          <span className="sidebar-brand-copy"><strong>Điều phối xe</strong><small>BV Mắt Sài Gòn Trà Vinh</small></span>
        </button>

        <nav className="side-nav">
          {groups.map(({ group, items }) => <div className="side-nav-group" key={group}>
            <span className="side-nav-label">{GROUP_LABELS[group]}</span>
            {items.map((item) => (
              <button
                type="button"
                key={item.key}
                className={page === item.key ? 'active' : ''}
                aria-current={page === item.key ? 'page' : undefined}
                onMouseEnter={(event) => showTooltip(event, item.label)}
                onMouseLeave={() => setHoverTooltip(null)}
                onFocus={(event) => showTooltip(event, item.label)}
                onBlur={() => setHoverTooltip(null)}
                onClick={() => handlePageNavigation(item.key)}
              >
                <span className="side-nav-icon"><Icon name={item.icon} size={18} />{sidebarCollapsed && badge(notificationCountFor(item.key), 'side-nav-dot')}</span>
                <span className="side-nav-text">{item.label}</span>
                {!sidebarCollapsed && badge(notificationCountFor(item.key), 'side-nav-badge')}
              </button>
            ))}
          </div>)}
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="sidebar-user" onClick={() => onPage('account')} aria-label="Mở hồ sơ cá nhân">
            <span className="sidebar-avatar">{currentProfile?.avatar_url ? <img src={currentProfile.avatar_url} alt="" /> : currentProfile?.full_name.slice(0, 1).toUpperCase()}</span>
            <span className="sidebar-user-copy"><strong>{currentProfile?.full_name}</strong><small>{currentProfile ? ROLE_LABELS[currentProfile.role] : ''}</small></span>
          </button>
          <div className="sidebar-footer-actions">
            <button type="button" className="sidebar-icon-button" onClick={toggleSidebar} aria-label={sidebarCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'} title={sidebarCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}>
              <Icon name={sidebarCollapsed ? 'chevron-right' : 'chevron-left'} size={17} />
            </button>
            <button type="button" className="sidebar-icon-button logout" onClick={() => void handleLogout()} disabled={loggingOut} aria-label="Đăng xuất" title="Đăng xuất">
              <Icon name="logout" size={17} />
            </button>
          </div>
        </div>
      </aside>
      {hoverTooltip && <div className="sidebar-floating-tooltip" style={{ top: hoverTooltip.top, left: hoverTooltip.left }} role="tooltip">{hoverTooltip.label}</div>}

      <main className="main-area">
        <NetworkBanner />
        <header className="topbar">
          <div className="topbar-mobile-brand">
            <button type="button" onClick={() => onPage(homePage)} aria-label="Về trang chủ"><img src={BRAND_LOGO_SMALL} alt="" /></button>
          </div>
          <div className="topbar-heading">
            <nav className="page-breadcrumb" aria-label="Đường dẫn trang">
              <span>{ROLE_LABELS[currentRole]}</span>
              <Icon name="chevron-right" size={12} />
              <span>{currentNav ? GROUP_LABELS[currentNav.group] : ''}</span>
            </nav>
            <h1>{currentNav?.label}</h1>
          </div>
          <div className="topbar-actions">
            <GlobalSearch onNavigate={(target, recordId) => handlePageNavigation(target, recordId)} />
            {currentRole !== 'department_head' && <OnlineUsersButton />}
            <button type="button" className="topbar-icon-button refresh" onClick={() => void handleRefresh()} disabled={refreshing} aria-label="Làm mới dữ liệu" title="Làm mới dữ liệu">
              <Icon name="refresh" size={18} className={refreshing ? 'spinning' : ''} />
            </button>
            <NotificationCenter onNavigate={(target, recordId) => handlePageNavigation(target as PageKey, recordId)} />
            <span className={`connection-dot ${online ? 'online' : 'offline'}`} title={online ? 'Đang kết nối máy chủ' : 'Mất kết nối, dữ liệu lưu tạm'} aria-label={online ? 'Trực tuyến' : 'Ngoại tuyến'} />
            <button type="button" className="topbar-avatar" onClick={() => onPage('account')} aria-label="Hồ sơ cá nhân">
              {currentProfile?.avatar_url ? <img src={currentProfile.avatar_url} alt="" /> : currentProfile?.full_name.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>
        {error && <div className="data-error-banner">Không tải được dữ liệu mới: {error}</div>}
        <p className="page-description">{pageDescriptions[page]}</p>
        <div className="page-content">{children}</div>
      </main>

      <nav className="mobile-nav" aria-label="Điều hướng">
        {mobilePrimary.map((item) => (
          <button type="button" key={item.key} className={page === item.key ? 'active' : ''} onClick={() => handlePageNavigation(item.key)} aria-label={item.label}>
            <span className="mobile-nav-icon"><Icon name={item.icon} size={20} />{badge(notificationCountFor(item.key), 'mobile-nav-badge')}</span>
            <small>{item.mobileLabel}</small>
          </button>
        ))}
        {mobileMore.length > 0 && <button type="button" className={mobileMore.some((item) => item.key === page) || moreOpen ? 'active' : ''} onClick={() => setMoreOpen((value) => !value)} aria-expanded={moreOpen} aria-label="Thêm chức năng">
          <span className="mobile-nav-icon"><Icon name="menu" size={20} />{badge(moreBadge, 'mobile-nav-badge')}</span>
          <small>Thêm</small>
        </button>}
      </nav>

      {moreOpen && <>
        <button type="button" className="mobile-more-overlay" onClick={() => setMoreOpen(false)} aria-label="Đóng" />
        <section className="mobile-more-sheet" aria-label="Chức năng khác">
          <div className="mobile-more-user">
            <span className="sidebar-avatar">{currentProfile?.avatar_url ? <img src={currentProfile.avatar_url} alt="" /> : currentProfile?.full_name.slice(0, 1).toUpperCase()}</span>
            <div><strong>{currentProfile?.full_name}</strong><small>{ROLE_LABELS[currentRole]}</small></div>
          </div>
          <div className="mobile-more-grid">
            {mobileMore.map((item) => <button type="button" key={item.key} className={page === item.key ? 'active' : ''} onClick={() => handlePageNavigation(item.key)}>
              <span><Icon name={item.icon} size={20} />{badge(notificationCountFor(item.key), 'mobile-nav-badge')}</span>
              <strong>{item.mobileLabel}</strong>
            </button>)}
          </div>
          <button type="button" className="mobile-more-logout" onClick={() => void handleLogout()} disabled={loggingOut}><Icon name="logout" size={18} />{loggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</button>
        </section>
      </>}
    </div>
  )
}
