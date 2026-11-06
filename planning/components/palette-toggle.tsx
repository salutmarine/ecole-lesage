'use client'

import { useEffect, useState } from 'react'

const palettes = [
    { value: 'sage', label: 'Sauge', color: '#36594d' },
    { value: 'clay', label: 'Argile', color: '#8b493b' },
    { value: 'ink', label: 'Encre', color: '#494574' },
]

export default function PaletteToggle() {
    const [palette, setPalette] = useState('sage')

    useEffect(() => {
        let next = 'sage'
        try {
            const saved = localStorage.getItem('lesage-palette')
            if (palettes.some((option) => option.value === saved)) next = saved!
        } catch {}
        setPalette(next)
        document.documentElement.dataset.palette = next
    }, [])

    function select(next: string) {
        setPalette(next)
        document.documentElement.dataset.palette = next
        try {
            localStorage.setItem('lesage-palette', next)
        } catch {}
    }

    return (
        <div className="font_toggle palette_toggle" role="group" aria-label="Palette de couleurs">
            {palettes.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    aria-pressed={palette === option.value}
                    onClick={() => select(option.value)}
                >
                    <span className="palette_swatch" style={{ background: option.color }} aria-hidden="true" />
                    {option.label}
                </button>
            ))}
        </div>
    )
}
