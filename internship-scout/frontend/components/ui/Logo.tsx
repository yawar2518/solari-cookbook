import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'

/** The fyt mark: the rounded-square "F" with the teal dot (from assets/favicon.png). */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/fyt-mark.png"
      alt=""
      width={size}
      height={size}
      priority
      className={cn('shrink-0 select-none', className)}
      style={{ width: size, height: size, filter: 'drop-shadow(0 4px 14px rgba(45,107,228,0.35))' }}
    />
  )
}

/** Mark + "fyt" wordmark. The wordmark is live text so it stays crisp and inherits the theme. */
export function Logo({ href = '/', size = 32, className, textClassName }: { href?: string; size?: number; className?: string; textClassName?: string }) {
  return (
    <Link href={href} className={cn('flex items-center gap-2.5', className)} aria-label="fyt home">
      <LogoMark size={size} />
      <span className={cn('font-display text-[17px] font-bold lowercase tracking-tight text-ink', textClassName)} style={{ lineHeight: 1 }}>
        fyt
      </span>
    </Link>
  )
}
