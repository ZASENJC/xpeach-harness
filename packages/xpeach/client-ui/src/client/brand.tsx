/** XPeach brand occupants: the 🍑 mark and the "🍑Code" wordmark. */
import css from './xpeach.module.css'

/**
 * The XPeach peach mark — a warm fruit glyph carrying the site's identity
 * where the shell expects a square logo.
 * @param props - host-supplied geometry.
 * @returns the peach mark.
 */
export function XPeachMark({ size, className }: { size: number, className?: string | undefined }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" {...(className === undefined ? {} : { className })}>
      <defs>
        <linearGradient id="xpeach-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFB783" />
          <stop offset="1" stopColor="#F17C52" />
        </linearGradient>
      </defs>
      <path d="M16.8 6.4c3.3-3.8 7.4-4.3 9.3-3.8-.6 3.3-3.9 6.4-8.3 6.4z" fill="#6FA85A" />
      <path d="M16 8.6c.9-1.5.9-2.9.2-4.3" stroke="#A9714B" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M16.2 8.8c4.9 0 8.9 3.8 8.9 9 0 5.5-4.3 10-9.1 10-.4 0-.9 0-1.3-.1-3.9-.6-7.1-4.5-7.1-9.9 0-5.2 3.7-9 8.6-9z" fill="url(#xpeach-body)" />
      <path d="M16.2 8.8c-1.4 2-2.1 4.5-2.1 7.2 0 3.8 1.4 7.2 3.5 9.3" fill="none" stroke="#DE6E47" strokeWidth="1.1" strokeLinecap="round" opacity=".65" />
    </svg>
  )
}

/**
 * The XPeach wordmark rendered in the brand row: the site's own "🍑Code"
 * display name in the harness brand face.
 * @returns the wordmark.
 */
export function XPeachName(): JSX.Element {
  return (
    <span className={css.wordmark}>
      <span className={css.wordmarkPrimary}>XPEACH</span>
      <span className={css.wordmarkSub}>Harness</span>
    </span>
  )
}
