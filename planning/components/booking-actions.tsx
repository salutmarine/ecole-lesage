'use client'
import { useEffect, useId, useState } from 'react'
import { dateLabel } from './month-calendar'
import Toast from './toast'

export type MovedBooking = {
    id: string
    slotId: string
    entitlementId: string
    course: string
    date: string
    endsAt: string
    status: string
    cancellationHours: number
    teacher: string | null
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
}: {
    bookingId: string
    busy: boolean
    onBusyChange: (busy: boolean) => void
    onMoved: (booking: MovedBooking) => void
    onCancelled?: () => void
    onCancelRequest?: () => void
    onNotify?: (message: string) => void
    canManage?: boolean
    showCancel?: boolean
}) {
    const fieldId = useId()
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
        fetch(`/api/bookings/available-slots?${new URLSearchParams({ bookingId })}`, {
            signal: controller.signal,
            cache: 'no-store',
        })
            .then(async (response) => {
                const data = await response.json()
                if (!response.ok) throw Error(data.error || 'Chargement impossible.')
                return data
            })
            .then((data) => {
                if (!controller.signal.aborted) setSlots(data)
            })
            .catch((error) => {
                if (!controller.signal.aborted) setError(error.message)
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false)
            })
        return () => controller.abort()
    }, [moving, bookingId])
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
                body: JSON.stringify({ id: bookingId, ...(method === 'PATCH' ? { slotId } : {}) }),
            })
            const data = await response.json()
            if (!response.ok) throw Error(data.error || 'Opération impossible.')
            if (method === 'PATCH') onMoved(data)
            else onCancelled?.()
            setMoving(false)
            onNotify?.(method === 'PATCH' ? 'Réservation déplacée.' : 'Réservation annulée.')
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Opération impossible.')
        } finally {
            onBusyChange(false)
        }
    }
    return (
        <div className="booking_actions">
            <div className="form_actions">
                <button
                    type="button"
                    className="btn btn-medium secondary"
                    disabled={busy || !canManage}
                    aria-expanded={moving}
                    onClick={() => setMoving((value) => !value)}
                >
                    Modifier la réservation
                </button>
                {showCancel && (
                    <button
                        type="button"
                        className="btn btn-medium danger"
                        disabled={busy || !canManage}
                        onClick={() => onCancelRequest ? onCancelRequest() : void change('DELETE')}
                    >
                        Annuler la réservation
                    </button>
                )}
            </div>
            {moving && (
                <div className="booking_move_form">
                    <label htmlFor={fieldId}>Nouvelle date et heure</label>
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
                                {slot.teacher ? ` · ${slot.teacher}` : ''}
                            </option>
                        ))}
                    </select>
                    {!loading && !error && slots.length === 0 && (
                        <p className="muted" role="status">
                            Aucun autre créneau réservable pour ce cours.
                        </p>
                    )}
                    <p className="muted">
                        Le solde reste inchangé. La réservation actuelle est conservée si le nouveau créneau est refusé.
                    </p>
                    <div className="form_actions">
                        <button
                            type="button"
                            className="btn btn-medium"
                            disabled={busy || loading || !slotId}
                            onClick={() => void change('PATCH')}
                        >
                            {busy ? 'Enregistrement…' : 'Confirmer le déplacement'}
                        </button>
                        <button
                            type="button"
                            className="btn btn-medium secondary"
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
