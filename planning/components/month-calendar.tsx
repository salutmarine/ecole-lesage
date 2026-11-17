'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { type CourseLevel } from '@/lib/course-levels'
export type CalendarSlot = {
    id: string
    courseId: string | null
    course: string
    level?: CourseLevel | null
    teacherId?: string | null
    teachers?: { id: string; name: string }[]
    teacher?: string | null
    startsAt: string
    endsAt: string
    cancellationHours?: number
    capacity: number
    students?: {
        status: string
        teacherId?: string | null
        teacher?: string | null
        entitlementId?: string
        course?: string
        level?: CourseLevel
        bookingId: string
        id: string
        name: string
        language?: string
        email: string
        sessions?: { total: number; remaining: number }
        phone?: string | null
        attendance?: 'UNMARKED' | 'PRESENT' | 'ABSENT'
    }[]
    reserved: number
    blocked: boolean
}
const week = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven']
export const dateLabel = (iso: string) =>
    new Date(iso).toLocaleString('fr-FR', {
        dateStyle: 'full',
        timeStyle: 'short',
    })
export function MonthCalendar({
    mode,
    courseId,
    onSelect,
    onCreateSlot,
    refresh,
    bookedSlotIds = [],
    bookedSlotCourses = {},
    canReserve = true,
    allowUnavailableSelection = false,
    canReserveSlot,
    showLegend = true,
    teacherId,
    initialDate,
}: {
    mode: 'admin' | 'student' | 'teacher'
    initialDate?: string
    teacherId?: string
    courseId?: string
    onSelect: (slot: CalendarSlot) => void
    onCreateSlot?: (date: string) => void
    refresh: number
    bookedSlotIds?: string[]
    bookedSlotCourses?: Record<string, string>
    canReserve?: boolean
    allowUnavailableSelection?: boolean
    canReserveSlot?: (slot: CalendarSlot) => boolean
    showLegend?: boolean
}) {
    const [month, setMonth] = useState(() => {
        const d = initialDate ? new Date(initialDate) : new Date()
        return new Date(d.getFullYear(), d.getMonth(), 1)
    })
    const cache = useRef(new Map<string, Promise<CalendarSlot[]>>())
    const cacheRevision = useRef(refresh)
    const [result, setResult] = useState<{ key: string; slots: CalendarSlot[] }>({ key: '', slots: [] })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(true)
    const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
    useEffect(() => {
        let alive = true
        if (cacheRevision.current !== refresh) {
            cache.current.clear()
            cacheRevision.current = refresh
        }
        function load(monthKey: string) {
            let request = cache.current.get(monthKey)
            if (!request) {
                request = fetch(`/api/slots?month=${monthKey}`, { cache: 'no-store' }).then(async (r) => {
                    const data = await r.json()
                    if (!r.ok) throw Error(data.error || 'Erreur')
                    return data as CalendarSlot[]
                })
                cache.current.set(monthKey, request)
                const pending = request
                request.catch(() => {
                    if (cache.current.get(monthKey) === pending) cache.current.delete(monthKey)
                })
            }
            return request
        }
        setLoading(true)
        setError('')
        load(key)
            .then((slots) => {
                if (!alive) return
                setResult({ key, slots })
                // Prepare adjacent months so navigation can reuse their results.
                const [year, monthNumber] = key.split('-').map(Number)
                for (const offset of [-1, 1]) {
                    const adjacent = new Date(year, monthNumber - 1 + offset, 1)
                    const adjacentKey = `${adjacent.getFullYear()}-${String(adjacent.getMonth() + 1).padStart(2, '0')}`
                    void load(adjacentKey).catch(() => {})
                }
            })
            .catch((e) => {
                if (alive) setError(e.message)
            })
            .finally(() => {
                if (alive) setLoading(false)
            })
        return () => {
            alive = false
        }
    }, [key, refresh])
    const slots = result.key === key ? result.slots : []
    const cells = useMemo(() => {
        const first = new Date(month.getFullYear(), month.getMonth(), 1)
        const firstWeekday = (first.getDay() + 6) % 7
        const offset = firstWeekday < 5 ? firstWeekday : 0
        const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
        const weekdays = Array.from({ length: days }, (_, i) => i + 1).filter((day) => {
            const weekday = new Date(month.getFullYear(), month.getMonth(), day).getDay()
            return weekday !== 0 && weekday !== 6
        })
        return [...Array(offset).fill(null), ...weekdays]
    }, [month])
    const byDay = useMemo(() => {
        const map = new Map<number, CalendarSlot[]>()
        for (const s of slots) {
            if (
                mode === 'teacher' &&
                ((teacherId && !s.teachers?.some((teacher) => teacher.id === teacherId)) ||
                    (courseId && s.courseId !== courseId))
            )
                continue
            if (
                mode === 'admin' &&
                ((courseId && s.courseId !== courseId) ||
                    (teacherId && !s.teachers?.some((teacher) => teacher.id === teacherId)))
            )
                continue
            const day = new Date(s.startsAt).getDate()
            map.set(day, [...(map.get(day) || []), s])
        }
        return map
    }, [slots, mode, courseId, teacherId])
    return (
        <div className="month_shell" data-mode={mode}>
            <div className="month_toolbar">
                <div>
                    <h2>Calendrier des séances</h2>
                    <p className="muted">
                        {mode === 'student'
                            ? 'Vos séances réservées, disponibles et complètes sont affichées.'
                            : mode === 'teacher'
                              ? 'Cliquez sur une séance pour consulter les inscrits et faire l’appel.'
                              : onCreateSlot
                                ? 'Cliquez sur un créneau pour le consulter, ou double-cliquez dans une zone vide d’une date pour en créer un.'
                                : 'Cliquez sur un créneau pour voir les places disponibles.'}
                    </p>
                </div>
                <div className="month_controls">
                    <button
                        type="button"
                        className="btn secondary month_today"
                        onClick={() => {
                            const today = new Date()
                            setMonth(new Date(today.getFullYear(), today.getMonth(), 1))
                        }}
                    >
                        Aujourd’hui
                    </button>
                    <button
                        type="button"
                        className="calendar-month-button calendar-month-button--previous"
                        onClick={() => setMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                        aria-label="Mois précédent"
                    >
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.4" /></svg>
                    </button>
                    <strong>
                        {month.toLocaleDateString('fr-FR', {
                            month: 'long',
                            year: 'numeric',
                        })}
                    </strong>
                    <button
                        type="button"
                        className="calendar-month-button"
                        onClick={() => setMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                        aria-label="Mois suivant"
                    >
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.4" /></svg>
                    </button>
                </div>
            </div>
            {error && (
                <p className="error" role="alert">
                    {error}
                </p>
            )}
            <p className="muted" role="status" style={{ minHeight: '1.5em', margin: 0 }}>
                {loading ? 'Chargement du calendrier…' : '\u00a0'}
            </p>
            {!loading &&
                !error &&
                mode !== 'student' &&
                (courseId || (mode === 'admin' && teacherId)) &&
                byDay.size === 0 && (
                    <p className="muted" role="status">
                        Aucune séance ne correspond aux filtres pour ce mois.
                    </p>
                )}
            <div className="month_grid" role="grid" aria-label="Calendrier mensuel">
                {week.map((d) => (
                    <div className="month_weekday" key={d}>
                        {d}
                    </div>
                ))}
                {cells.map((day, i) => (
                    <div
                        key={i}
                        className={'month_cell ' + (!day ? 'month_empty' : '')}
                        role="gridcell"
                        tabIndex={day && mode === 'admin' && onCreateSlot ? 0 : undefined}
                        aria-label={
                            day && mode === 'admin' && onCreateSlot
                                ? `${day} ${month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })} : double-cliquez ou appuyez sur Entrée pour ajouter un créneau`
                                : undefined
                        }
                        onDoubleClick={(event) => {
                            if (
                                !day ||
                                mode !== 'admin' ||
                                !onCreateSlot ||
                                (event.target as HTMLElement).closest('button')
                            )
                                return
                            onCreateSlot(`${key}-${String(day).padStart(2, '0')}`)
                        }}
                        onKeyDown={(event) => {
                            if (
                                event.target !== event.currentTarget ||
                                !day ||
                                mode !== 'admin' ||
                                !onCreateSlot ||
                                !['Enter', ' '].includes(event.key)
                            )
                                return
                            event.preventDefault()
                            onCreateSlot(`${key}-${String(day).padStart(2, '0')}`)
                        }}
                    >
                        {day && (
                            <>
                                <div className="month_day">{day}</div>
                                <div className="month_events">
                                    {(byDay.get(day) || []).map((s) => {
                                        const booked = mode === 'student' && bookedSlotIds.includes(s.id)
                                        const sessionName = booked ? bookedSlotCourses[s.id] || 'Séance' : 'Séance'
                                        const available = Math.max(0, s.capacity - s.reserved)
                                        const full = available === 0
                                        const availability =
                                            available === 0
                                                ? 'Complet'
                                                : `${available} / ${s.capacity} ${available === 1 ? 'place libre' : 'places libres'}`
                                        const match = mode !== 'student' || (canReserveSlot ? canReserveSlot(s) : true)
                                        const disabled =
                                            booked ||
                                            !canReserve ||
                                            s.blocked ||
                                            s.reserved >= s.capacity ||
                                            new Date(s.startsAt) <= new Date() ||
                                            !match
                                        const color =
                                            new Date(s.endsAt) <= new Date()
                                                ? 'gray'
                                                : booked || (mode !== 'student' && full)
                                                  ? 'green'
                                                  : full || (mode === 'student' && disabled)
                                                    ? 'gray'
                                                    : 'blue'
                                        return (
                                            <button
                                                type="button"
                                                key={s.id}
                                                className={`btn month_event month_event_${color}`}
                                                disabled={
                                                    mode === 'student' &&
                                                    !booked &&
                                                    disabled &&
                                                    !allowUnavailableSelection
                                                }
                                                onClick={() => onSelect(s)}
                                                title={`${sessionName} · ${availability}${booked ? ' · Déjà réservé' : ''}`}
                                            >
                                                {booked && (
                                                    <span className="month_event_badge">
                                                        <span aria-hidden="true">✓</span> Réservé
                                                    </span>
                                                )}
                                                {full && !booked && (
                                                    <span className="month_event_badge">
                                                        <svg
                                                            width="12"
                                                            height="12"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            aria-hidden="true"
                                                            focusable="false"
                                                        >
                                                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                                            <circle cx="9" cy="7" r="4" />
                                                            <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                                                        </svg>
                                                        Complet
                                                    </span>
                                                )}
                                                <span className="month_event_time">
                                                    {new Date(s.startsAt).toLocaleTimeString('fr-FR', {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </span>
                                                <span className="month_event_name">{sessionName}</span>
                                                {mode !== 'student' && (
                                                    <span className="month_event_places">
                                                        {s.teacher || 'Professeur à définir'}
                                                    </span>
                                                )}
                                                {!full && <span className="month_event_places">{availability}</span>}
                                            </button>
                                        )
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
            {showLegend && (
                <div className="month_legend" aria-label="Légende des créneaux">
                    <span>
                        <i className="month_legend_swatch month_legend_blue" aria-hidden="true" />
                        Disponible
                    </span>
                    <span>
                        <i className="month_legend_swatch month_legend_green" aria-hidden="true" />
                        {mode === 'student' ? 'Réservé' : 'Complet'}
                    </span>
                    <span>
                        <i className="month_legend_swatch month_legend_gray" aria-hidden="true" />
                        {mode === 'student' ? 'Complet / Pas disponible' : 'Pas disponible'}
                    </span>
                </div>
            )}
        </div>
    )
}
