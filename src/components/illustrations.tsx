// 空状态物件线稿插图(UI方案 2.4/6.1):统一 ink-secondary 线条,禁止抽象几何与光斑

interface ArtProps {
  size?: number
}

const stroke = 'var(--ink-secondary)'

export const BookArt = ({ size = 96 }: ArtProps) => (
  <svg width={size} height={size} viewBox="0 0 96 96" fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M48 22c-8-6-24-6-32-2v54c8-4 24-4 32 2 8-6 24-6 32-2V20c-8-4-24-4-32 2Z" />
    <path d="M48 22v54" />
    <path d="M24 32c6-2 14-2 18 1M24 44c6-2 14-2 18 1M24 56c6-2 14-2 18 1M54 33c4-3 12-3 18-1M54 45c4-3 12-3 18-1M54 57c4-3 12-3 18-1" />
  </svg>
)

export const QuizSheetArt = ({ size = 96 }: ArtProps) => (
  <svg width={size} height={size} viewBox="0 0 96 96" fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="20" y="12" width="56" height="72" rx="3" />
    <rect x="28" y="22" width="8" height="8" rx="1" />
    <path d="M42 26h26M28 42h40M28 52h40M28 62h28" />
    <rect x="28" y="70" width="8" height="8" rx="1" />
    <path d="M42 74h18" />
  </svg>
)

export const CardsArt = ({ size = 96 }: ArtProps) => (
  <svg width={size} height={size} viewBox="0 0 96 96" fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="14" y="26" width="44" height="56" rx="4" />
    <path d="M30 18h44a4 4 0 0 1 4 4v44" />
    <path d="M24 44h24M24 56h16" />
  </svg>
)

export const ChartArt = ({ size = 96 }: ArtProps) => (
  <svg width={size} height={size} viewBox="0 0 96 96" fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 14v62h60" />
    <path d="M32 60V38M46 76V28M60 66V48M74 56v-36" />
  </svg>
)

export const BooksStackArt = ({ size = 96 }: ArtProps) => (
  <svg width={size} height={size} viewBox="0 0 96 96" fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="16" y="62" width="64" height="16" rx="2" />
    <rect x="22" y="44" width="52" height="16" rx="2" />
    <rect x="28" y="26" width="40" height="16" rx="2" />
    <path d="M16 70l4-8M44 52l4-8" />
  </svg>
)
