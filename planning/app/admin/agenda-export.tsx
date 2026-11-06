'use client'
import DatePicker from '@/components/date-picker'
import { useState } from 'react'
import { agendaPeriod, parisDate, type AgendaMode } from '@/lib/agenda-period'
export default function AgendaExport() {
    const [mode, setMode] = useState<AgendaMode>('day')
    const [date, setDate] = useState(() => parisDate(new Date()))
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    let preview = ''
    try {
        const period = agendaPeriod(date, mode)
        const format = (day: string) =>
            new Date(`${day}T12:00:00Z`).toLocaleDateString('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' })
        preview =
            mode === 'week' ? `Du ${format(period.firstDay)} au ${format(period.lastDay)}` : format(period.firstDay)
    } catch {
        /* The required date field provides validation before submission. */
    }
    async function download(event: React.FormEvent) {
        event.preventDefault()
        if (busy) return
        setBusy(true)
        setError('')
        try {
            const response = await fetch(`/api/admin/agenda/export?${new URLSearchParams({ mode, date })}`, {
                cache: 'no-store',
            })
            if (!response.ok) {
                const data = await response.json()
                throw Error(data.error || 'Export impossible.')
            }
            const blob = await response.blob()
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download =
                response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ?? `agenda-${date}.pdf`
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.setTimeout(() => URL.revokeObjectURL(url), 1000)
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Export impossible.')
        } finally {
            setBusy(false)
        }
    }
    return (
        <section className="card agenda_export">
            <h2>Exporter l’agenda en PDF</h2>
            <p className="muted">Tous les cours, horaires, professeurs et élèves inscrits sur la période choisie.</p>
            <form onSubmit={download}>
                <fieldset disabled={busy}>
                    <div className="attendance_views" role="group" aria-label="Période à exporter">
                        <button
                            type="button"
                            className={mode === 'day' ? 'btn' : 'btn secondary'}
                            aria-pressed={mode === 'day'}
                            onClick={() => setMode('day')}
                        >
                            Une journée
                        </button>
                        <button
                            type="button"
                            className={mode === 'week' ? 'btn' : 'btn secondary'}
                            aria-pressed={mode === 'week'}
                            onClick={() => setMode('week')}
                        >
                            Une semaine
                        </button>
                    </div>
                    <label htmlFor="agenda-export-date">
                        {mode === 'day' ? 'Date à exporter' : 'Choisir un jour de la semaine à exporter'}
                    </label>
                    <DatePicker id="agenda-export-date" value={date} onChange={setDate} required />
                    {preview && (
                        <p className="muted">
                            {preview}
                            {mode === 'week' ? ' · Du lundi au dimanche' : ''}
                        </p>
                    )}
                    <button type="submit" className="btn" disabled={!date}>
                        {busy ? 'Génération du PDF…' : 'Télécharger le PDF'}
                    </button>
                </fieldset>
                {error && (
                    <p className="error" role="alert">
                        {error}
                    </p>
                )}
            </form>
        </section>
    )
}
