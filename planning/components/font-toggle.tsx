'use client'

import { useEffect, useState } from 'react'

const fonts = [
    { value: 'abchanel', label: 'ABChanel' },
    { value: 'geist', label: 'Geist' },
    { value: 'manrope', label: 'Manrope' },
]

export default function FontToggle() {
    const [font, setFont] = useState('abchanel')

    useEffect(() => {
        try {
            const saved = localStorage.getItem('lesage-font')
            if (saved && fonts.some((option) => option.value === saved)) {
                setFont(saved)
                document.documentElement.dataset.font = saved
            }
        } catch {}
    }, [])

    function selectFont(next: string) {
        setFont(next)
        document.documentElement.dataset.font = next
        try {
            localStorage.setItem('lesage-font', next)
        } catch {}
    }

    return (
        <div className="font_toggle" role="group" aria-label="Police de caractères">
            {fonts.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    aria-pressed={font === option.value}
                    onClick={() => selectFont(option.value)}
                >
                    {option.label}
                </button>
            ))}
        </div>
    )
}
