'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { courseLevels, type CourseLevel } from '@/lib/course-levels'
export type CalendarSlot = {
    id: string
    courseId: string | null
    course: string
    level?: CourseLevel | null
    teacherId?: string | null
    teacher?: string | null
    startsAt: string
    endsAt: string
    cancellationHours?: number
    capacity: number
    students?: { status: string; bookingId: string; id: string; name: string; email: string }[]
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
    refresh,
    bookedSlotIds = [],
    canReserve = true,
    canReserveSlot,
    showLegend = true,
}: {
    mode: 'admin' | 'student'
    courseId?: string
    onSelect: (slot: CalendarSlot) => void
    refresh: number
    bookedSlotIds?: string[]
    canReserve?: boolean
    canReserveSlot?: (slot: CalendarSlot) => boolean
    showLegend?: boolean
}) {
    const [month, setMonth] = useState(() => {
        const d = new Date()
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
                mode === 'student' &&
                !bookedSlotIds.includes(s.id) &&
                (!canReserve ||
                    s.blocked ||
                    new Date(s.startsAt) <= new Date() ||
                    !(canReserveSlot ? canReserveSlot(s) : s.courseId === courseId))
            )
                continue
            const day = new Date(s.startsAt).getDate()
            map.set(day, [...(map.get(day) || []), s])
        }
        return map
    }, [slots, mode, canReserve, bookedSlotIds, canReserveSlot, courseId])
    return (
        <div className="month_shell">
            <div className="month_toolbar">
                <div>
                    <h2>Calendrier des séances</h2>
                    <p className="muted">
                        {mode === 'student'
                            ? 'Vos séances réservées et les séances que vous pouvez réserver sont affichées.'
                            : 'Cliquez sur un créneau pour voir les places disponibles.'}
                    </p>
                </div>
                <div className="month_controls">
                    <button
                        type="button"
                        className="btn secondary"
                        onClick={() => setMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                        aria-label="Mois précédent"
                    >
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            focusable="false"
                        >
                            <path d="m14 6-6 6 6 6" />
                        </svg>
                    </button>
                    <strong>
                        {month.toLocaleDateString('fr-FR', {
                            month: 'long',
                            year: 'numeric',
                        })}
                    </strong>
                    <button
                        type="button"
                        className="btn secondary"
                        onClick={() => setMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                        aria-label="Mois suivant"
                    >
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            focusable="false"
                        >
                            <path d="m10 6 6 6-6 6" />
                        </svg>
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
            <div className="month_grid" role="grid" aria-label="Calendrier mensuel">
                {week.map((d) => (
                    <div className="month_weekday" key={d}>
                        {d}
                    </div>
                ))}
                {cells.map((day, i) => (
                    <div key={i} className={'month_cell ' + (!day ? 'month_empty' : '')} role="gridcell">
                        {day && (
                            <>
                                <div className="month_day">{day}</div>
                                <div className="month_events">
                                    {(byDay.get(day) || []).map((s) => {
                                        const booked = mode === 'student' && bookedSlotIds.includes(s.id)
                                        const available = Math.max(0, s.capacity - s.reserved)
                                        const full = available === 0
                                        const availability =
                                            available === 0
                                                ? 'Complet'
                                                : `${available} / ${s.capacity} ${available === 1 ? 'place libre' : 'places libres'}`
                                        const match =
                                            mode === 'admin' ||
                                            (canReserveSlot ? canReserveSlot(s) : s.courseId === courseId)
                                        const disabled =
                                            booked ||
                                            !canReserve ||
                                            s.blocked ||
                                            s.reserved >= s.capacity ||
                                            new Date(s.startsAt) <= new Date() ||
                                            !match
                                        return (
                                            <button
                                                type="button"
                                                key={s.id}
                                                className={
                                                    'btn ' +
                                                    ('month_event ' +
                                                        (s.level
                                                            ? `month_event_level_border_${s.level.toLowerCase()} `
                                                            : '') +
                                                        (booked
                                                            ? 'month_event_booked'
                                                            : full
                                                              ? 'month_event_full'
                                                              : disabled
                                                                ? 'month_event_disabled'
                                                                : ''))
                                                }
                                                disabled={mode === 'student' && !booked && disabled}
                                                onClick={() => onSelect(s)}
                                                title={`${s.course} · ${availability}${booked ? ' · Déjà réservé' : ''}`}
                                            >
                                                {booked && (
                                                    <span className="month_event_badge">
                                                        <span aria-hidden="true">✓</span> Réservé
                                                    </span>
                                                )}
                                                {full && !booked && (
                                                    <span className="month_event_badge month_event_badge_full">
                                                        Complet
                                                    </span>
                                                )}
                                                <span className="month_event_time">
                                                    {new Date(s.startsAt).toLocaleTimeString('fr-FR', {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </span>
                                                <span className="month_event_name">{s.course}</span>
                                                {s.teacher && <span className="month_event_places">{s.teacher}</span>}
                                                <span className="month_event_places">{availability}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
            <div className="month_legend" aria-label="Légende des créneaux et des niveaux">
                <span>
                    <i className="month_legend_swatch month_legend_available" aria-hidden="true" /> Disponible
                </span>
                <span>
                    <i className="month_legend_swatch month_legend_unavailable" aria-hidden="true" /> Indisponible
                </span>
                <span>
                    <i className="month_legend_swatch month_legend_full" aria-hidden="true" /> Complet
                </span>
                {mode === 'student' && (
                    <span>
                        <i className="month_legend_swatch month_legend_booked" aria-hidden="true" /> Réservé
                    </span>
                )}
                {(Object.entries(courseLevels) as [CourseLevel, string][]).map(([level, label]) => (
                    <span key={level}>
                        <i
                            className={`month_legend_swatch month_legend_level month_legend_level_${level.toLowerCase()}`}
                            aria-hidden="true"
                        />{' '}
                        {label}
                    </span>
                ))}
            </div>
        </div>
    )
}
