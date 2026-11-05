'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export default function TopbarActions({ children }: { children: ReactNode }) {
    const pathname = usePathname()
    if (pathname === '/' || pathname === '/login') return null
    return <div className="topbar_right">{children}</div>
}
