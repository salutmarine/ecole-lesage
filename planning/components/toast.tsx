'use client'

import { useEffect, useState } from 'react'

type Variant = 'info' | 'success' | 'warning' | 'error'
export function ToastMessage({ message, variant = 'success' }: { message: string; variant?: Variant }) {
    return (
        <div className={`admin_toast toast_${variant}`}>
            <svg
                className="toast_icon"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                {variant === 'warning' ? (
                    <>
                        <path d="m12 3 10 18H2L12 3Z" />
                        <path d="M12 9v5m0 3h.01" />
                    </>
                ) : (
                    <>
                        <circle cx="12" cy="12" r="9" />
                        {variant === 'success' ? (
                            <path d="m8 12 3 3 5-6" />
                        ) : variant === 'info' ? (
                            <path d="M12 11v6m0-10h.01" />
                        ) : (
                            <path d="M12 7v6m0 4h.01" />
                        )}
                    </>
                )}
            </svg>
            <span>{message}</span>
        </div>
    )
}
export default function Toast({ message, variant = 'error' }: { message: string; variant?: Variant }) {
    const [visible, setVisible] = useState(true)
    useEffect(() => {
        setVisible(true)
        const timer = window.setTimeout(() => setVisible(false), 2000)
        return () => window.clearTimeout(timer)
    }, [message])
    return (
        <div className="admin_toast_region" role={variant === 'error' ? 'alert' : 'status'} aria-atomic="true">
            {visible && <ToastMessage key={message} message={message} variant={variant} />}
        </div>
    )
}
