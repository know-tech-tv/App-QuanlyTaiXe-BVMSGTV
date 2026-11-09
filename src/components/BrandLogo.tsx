import { BRAND_LOGO_SMALL } from '../lib/brand'
interface BrandLogoProps {
  className?: string
  compact?: boolean
}

export function BrandLogo({ className = '', compact = false }: BrandLogoProps) {
  return (
    <div className={`brand-identity ${compact ? 'compact' : ''} ${className}`.trim()}>
      <span className="brand-logo-disc">
        <img
          className="brand-logo-image"
          src={BRAND_LOGO_SMALL}
          alt="Logo Bệnh viện Mắt Sài Gòn Trà Vinh"
        />
      </span>
      <div className="brand-title-copy">
        <strong>Điều phối xe</strong>
        <span className="brand-hospital-name">Bệnh viện mắt Sài Gòn Trà Vinh</span>
      </div>
    </div>
  )
}
