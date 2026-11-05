'use client'
import type { AnchorHTMLAttributes } from 'react'
export const router = {
    push(href: string) {
        window.location.hash = href
    },
    refresh() {
        window.dispatchEvent(new Event('lesage:refresh'))
    },
}
export function useRouter() {
    return router
}
export default function Link({
    href,
    prefetch: _prefetch,
    onClick,
    ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean }) {
    return <a {...props} href={`#${href}`} onClick={onClick} />
}
