'use client'
import { useEffect, useId, useState } from 'react'
import { dateLabel } from './month-calendar'
import Toast from './toast'
import { courseLevels, type CourseLevel } from '@/lib/course-levels'

export type MovedBooking = {
    id: string
    slotId: string
    entitlementId: string
    course: string
    level?: CourseLevel
    date: string
    endsAt: string
    status: string
    cancellationHours: number
    teacher: string | null
    teacherId?: string | null
}
type Option = { id: string; startsAt: string; endsAt: string; teacher: string | null }
export default function BookingActions({
    bookingId,
    busy,
    onBusyChange,
    onMoved,
    onCancelled,
    onCancelRequest,
    onNotify,
    canManage = true,
    showCancel = true,
    compact = false,
    courseOptions,
    currentEntitlementId,
    currentSlotId,
    teacherOptions,
    currentTeacherId,
}: {
    bookingId: string
    courseOptions?: { id: string; course: string; level?: CourseLevel }[]
    currentEntitlementId?: string
    currentSlotId?: string
    teacherOptions?: { id: string; name: string }[]
    currentTeacherId?: string | null
    busy: boolean
    onBusyChange: (busy: boolean) => void
    onMoved: (booking: MovedBooking) => void
    onCancelled?: () => void
    onCancelRequest?: () => void
    onNotify?: (message: string) => void
    canManage?: boolean
    showCancel?: boolean
    compact?: boolean
}) {
    const canChangeCourse = !!courseOptions
    const fieldId = useId()
    const [entitlementId, setEntitlementId] = useState(currentEntitlementId ?? '')
    const [teacherId, setTeacherId] = useState(currentTeacherId ?? '')
    const [moving, setMoving] = useState(false)
    const [slots, setSlots] = useState<Option[]>([])
    const [slotId, setSlotId] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    useEffect(() => {
        if (!moving) return
        const controller = new AbortController()
        setLoading(true)
        setError('')
        setSlots([])
        setSlotId('')
        fetch(
            `/api/bookings/available-slots?${new URLSearchParams({ bookingId, ...(canChangeCourse && entitlementId ? { entitlementId } : {}) })}`,
            {
                signal: controller.signal,
                cache: 'no-store',
            },
        )
            .then(async (response) => {
                const data = await response.json()
                if (!response.ok) throw Error(data.error || 'Chargement impossible.')
                return data
            })
            .then((data) => {
                if (!controller.signal.aborted) {
                    setSlots(data)
                    if (canChangeCourse && data.some((slot: Option) => slot.id === currentSlotId))
                        setSlotId(currentSlotId ?? '')
                }
            })
            .catch((error) => {
                if (!controller.signal.aborted) setError(error.message)
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false)
            })
        return () => controller.abort()
    }, [moving, bookingId, entitlementId, currentSlotId, canChangeCourse])
    async function change(method: 'PATCH' | 'DELETE') {
        if (busy || !canManage || (method === 'PATCH' && (!slotId || loading))) return
        if (method === 'DELETE' && !confirm('Annuler cette réservation ? La séance sera recréditée à l’étudiant.'))
            return
        onBusyChange(true)
        setError('')
        try {
            const response = await fetch('/api/bookings', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: bookingId,
                    ...(method === 'PATCH'
                        ? {
                              slotId,
                              ...(courseOptions ? { entitlementId } : {}),
                              ...(teacherOptions ? { teacherId: teacherId || null } : {}),
                          }
                        : {}),
                }),
            })
            const data = await response.json()
            if (!response.ok) throw Error(data.error || 'Opération impossible.')
            if (method === 'PATCH') onMoved(data)
            else onCancelled?.()
            setMoving(false)
            onNotify?.(method === 'PATCH' ? 'Réservation modifiée.' : 'Réservation annulée.')
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Opération impossible.')
        } finally {
            onBusyChange(false)
        }
    }
    return (
        <div className="booking_actions">
            {!moving && (
                <div className="form_actions">
                    <button
                        type="button"
                        className={`btn${compact ? '' : ' btn-medium'} secondary`}
                        disabled={busy || !canManage}
                        aria-expanded={moving}
                        onClick={() => setMoving((value) => !value)}
                    >
                        Modifier la réservation
                    </button>
                    {showCancel && (
                        <button
                            type="button"
                            className={`btn${compact ? '' : ' btn-medium'} danger`}
                            disabled={busy || !canManage}
                            onClick={() => (onCancelRequest ? onCancelRequest() : void change('DELETE'))}
                        >
                            Annuler la réservation
                        </button>
                    )}
                </div>
            )}
            {moving && (
                <div className="booking_move_form">
                    {courseOptions && (
                        <>
                            <label htmlFor={`${fieldId}-course`}>Cours acheté</label>
                            <select
                                id={`${fieldId}-course`}
                                value={entitlementId}
                                disabled={busy}
                                onChange={(event) => setEntitlementId(event.target.value)}
                            >
                                {courseOptions.map((course) => (
                                    <option key={course.id} value={course.id}>
                                        {course.course}
                                        {course.level ? ` · ${courseLevels[course.level]}` : ''}
                                    </option>
                                ))}
                            </select>
                        </>
                    )}
                    {teacherOptions && (
                        <>
                            <label htmlFor={`${fieldId}-teacher`}>Professeur de l’élève</label>
                            <select
                                id={`${fieldId}-teacher`}
                                value={teacherId}
                                disabled={busy}
                                onChange={(event) => setTeacherId(event.target.value)}
                            >
                                <option value="">Professeur à définir</option>
                                {teacherOptions.map((teacher) => (
                                    <option key={teacher.id} value={teacher.id}>
                                        {teacher.name}
                                    </option>
                                ))}
                            </select>
                        </>
                    )}
                    <label htmlFor={fieldId}>Date et heure</label>
                    <select
                        id={fieldId}
                        value={slotId}
                        disabled={busy || loading}
                        onChange={(event) => setSlotId(event.target.value)}
                    >
                        <option value="">{loading ? 'Chargement…' : 'Choisir une séance'}</option>
                        {slots.map((slot) => (
                            <option key={slot.id} value={slot.id}>
                                {dateLabel(slot.startsAt)} –{' '}
                                {new Date(slot.endsAt).toLocaleTimeString('fr-FR', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </option>
                        ))}
                    </select>
                    {!loading && !error && slots.length === 0 && (
                        <p className="muted" role="status">
                            Aucun créneau disponible pour ce cours.
                        </p>
                    )}

                    <div className="form_actions">
                        <button
                            type="button"
                            className={`btn${compact ? '' : ' btn-medium'}`}
                            disabled={busy || loading || !slotId}
                            onClick={() => void change('PATCH')}
                        >
                            {busy ? 'Enregistrement…' : 'Enregistrer les modifications'}
                        </button>
                        <button
                            type="button"
                            className={`btn${compact ? '' : ' btn-medium'} secondary`}
                            disabled={busy}
                            onClick={() => setMoving(false)}
                        >
                            Fermer
                        </button>
                    </div>
                </div>
            )}
            {error && <Toast message={error} variant="error" />}
        </div>
    )
}
