import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../components/Icon'
import { BRAND_LOGO, BRAND_NAME, HOSPITAL_NAME } from '../lib/brand'

const REMEMBER_PHONE_KEY = 'bvmsgtv_login_phone'

const FEATURES: Array<{ icon: Parameters<typeof Icon>[0]['name']; title: string; detail: string }> = [
  { icon: 'route', title: 'Điều phối & nối chuyến', detail: 'Giao chuyến, nhận chuyến và nối chuyến liên tục không cần quay về bệnh viện.' },
  { icon: 'navigation', title: 'GPS & camera Navicom', detail: 'Vị trí realtime và 2 camera mỗi xe, tự kết nối lại khi xe nổ máy.' },
  { icon: 'shield', title: 'Phân quyền nội bộ', detail: 'Hành chính, Điều phối, Kế toán, BGĐ và Tài xế — mỗi vai trò một màn hình.' },
]

export function LoginPage() {
  const { login } = useAuth()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    try {
      const savedPhone = window.localStorage.getItem(REMEMBER_PHONE_KEY)
      if (savedPhone) setPhone(savedPhone)
    } catch { /* trình duyệt chặn bộ nhớ cục bộ */ }
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (rememberMe) window.localStorage.setItem(REMEMBER_PHONE_KEY, phone)
      else window.localStorage.removeItem(REMEMBER_PHONE_KEY)
    } catch { /* bỏ qua */ }

    try {
      await login(phone, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-brand" aria-label={`${BRAND_NAME} — ${HOSPITAL_NAME}`}>
        <div className="auth-brand-glow" aria-hidden="true" />
        <div className="auth-brand-rings" aria-hidden="true"><i /><i /><i /></div>

        <header className="auth-brand-head">
          <span className="auth-brand-mark"><img src={BRAND_LOGO} alt="" /></span>
          <div><strong>{BRAND_NAME}</strong><small>{HOSPITAL_NAME}</small></div>
        </header>

        <div className="auth-brand-hero">
          <div className="auth-emblem"><img src={BRAND_LOGO} alt={`Logo ${HOSPITAL_NAME}`} /></div>
          <span className="auth-kicker"><i /> Trung tâm điều hành đội xe</span>
          <h1>An toàn trên mỗi<br /><em>hành trình chăm sóc mắt.</em></h1>
          <p>Một nền tảng cho toàn bộ quy trình đội xe bệnh viện — từ đề nghị điều xe, phê duyệt, phân công tài xế đến giám sát GPS, camera và chi phí.</p>
        </div>

        <ul className="auth-features">
          {FEATURES.map((item) => <li key={item.title}>
            <span><Icon name={item.icon} size={18} /></span>
            <div><strong>{item.title}</strong><small>{item.detail}</small></div>
          </li>)}
        </ul>

        <footer className="auth-brand-foot">© {new Date().getFullYear()} {HOSPITAL_NAME} · Hệ thống nội bộ</footer>
      </section>

      <section className="auth-panel" aria-label="Đăng nhập hệ thống điều phối xe">
        <div className="auth-card">
          <div className="auth-mobile-head">
            <span className="auth-brand-mark large"><img src={BRAND_LOGO} alt="" /></span>
            <div><strong>{BRAND_NAME}</strong><small>{HOSPITAL_NAME}</small></div>
          </div>

          <header className="auth-heading">
            <h2>Đăng nhập</h2>
            <p>Dùng số điện thoại đã được Hành chính cấp tài khoản.</p>
          </header>

          <form onSubmit={submit} className="auth-form">
            <label className="auth-field">
              <span>Số điện thoại</span>
              <div className="auth-input">
                <Icon name="phone" size={18} />
                <input inputMode="tel" autoComplete="username" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="VD: 0901 234 567" required />
              </div>
            </label>

            <label className="auth-field">
              <span>Mật khẩu</span>
              <div className="auth-input">
                <Icon name="lock" size={18} />
                <input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nhập mật khẩu" required />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword}>
                  <Icon name="eye" size={18} />
                </button>
              </div>
            </label>

            <div className="auth-options">
              <label><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /><span>Ghi nhớ số điện thoại</span></label>
              <button type="button" onClick={() => setError('Vui lòng liên hệ Điều phối hoặc Quản trị viên để được cấp lại mật khẩu.')}>Quên mật khẩu?</button>
            </div>

            {error && <div className="form-error" role="alert"><Icon name="alert" size={16} /><span><strong>Không thể đăng nhập.</strong> {error}</span></div>}

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? <><i className="login-spinner" />Đang xác thực...</> : <>Đăng nhập<Icon name="arrow-right" size={18} /></>}
            </button>
          </form>

          <aside className="auth-secure"><Icon name="shield" size={17} /><span>Phiên đăng nhập được mã hóa và phân quyền theo vai trò.</span></aside>
        </div>
      </section>
    </main>
  )
}
