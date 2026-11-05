'use client'

import { useEffect, useRef, type ReactNode } from 'react'

export default function SidePanel({
    titleId,
    busy,
    onClose,
    children,
}: {
    titleId: string
    busy: boolean
    onClose: () => void
    children: ReactNode
}) {
    const dialog = useRef<HTMLDialogElement>(null)
    useEffect(() => {
        const element = dialog.current
        if (element && !element.open) element.showModal()
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = previousOverflow
        }
    }, [])
    return (
        <dialog
            ref={dialog}
            className="sidepanel"
            aria-labelledby={titleId}
            onClose={(event) => {
                // Ignore a queued close event if the dialog has since reopened.
                if (!event.currentTarget.open) onClose()
            }}
            onCancel={(event) => {
                if (busy) event.preventDefault()
            }}
            onClick={(event) => {
                if (event.target === event.currentTarget && !busy) onClose()
            }}
        >
            <div className="sidepanel_content">
                <button
                    type="button"
                    className="btn sidepanel_close"
                    aria-label="Fermer les détails"
                    disabled={busy}
                    onClick={onClose}
                >
                    ×
                </button>
                {children}
            </div>
        </dialog>
    )
}
