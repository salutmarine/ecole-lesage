'use client'
import { useEffect, useState } from 'react'
import { dateLabel } from '@/components/month-calendar'
import type { StudentEntitlement } from './student-credits'

type Slot = { id: string; startsAt: string; endsAt: string; places: number; teacher: string | null }
export default function StudentBooking({
    userId,
    entitlements,
    busy,
    onBusyChange,
    onUpdated,
    onNotify,
    onClose,
}: {
    userId: string
    entitlements: StudentEntitlement[]
    busy: boolean
    onBusyChange: (busy: boolean) => void
    onUpdated: (entitlement: StudentEntitlement) => void
    onNotify: (message: string) => void
    onClose: () => void
}) {
    const [entitlementId, setEntitlementId] = useState('')
    const [slotId, setSlotId] = useState('')
    const [slots, setSlots] = useState<Slot[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const eligible = entitlements.filter(
        (e) => e.status === 'ACTIVE' && e.remaining > 0 && new Date(e.expiresAt) > new Date(),
    )
    useEffect(() => {
        if (!entitlementId) return
        const controller = new AbortController()
        setLoading(true)
        setError('')
        fetch(`/api/admin/available-slots?${new URLSearchParams({ userId, entitlementId })}`, {
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
    }, [entitlementId, userId])
    async function submit(event: React.FormEvent) {
        event.preventDefault()
        const entitlement = eligible.find((e) => e.id === entitlementId)
        const slot = slots.find((s) => s.id === slotId)
        if (busy || loading || !entitlement || !slot) return
        onBusyChange(true)
        setError('')
        try {
            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, entitlementId, slotId }),
            })
            const data = await response.json()
            if (!response.ok) throw Error(data.error || 'Réservation impossible.')
            onUpdated({
                ...entitlement,
                remaining: entitlement.remaining - 1,
                bookings: [
                    {
                        id: data.id,
                        course: entitlement.course,
                        startsAt: slot.startsAt,
                        endsAt: slot.endsAt,
                        status: 'BOOKED',
                        attendance: 'UNMARKED',
                    },
                    ...entitlement.bookings,
                ],
            })
            onNotify('Séance réservée pour l’étudiant.')
            onClose()
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Réservation impossible.')
        } finally {
            onBusyChange(false)
        }
    }
    return (
        <form className="student_credit_form" onSubmit={submit}>
            <h4>Réserver une séance</h4>
            <fieldset disabled={busy}>
                <label htmlFor="student-booking-course">Cours de l’étudiant</label>
                <select
                    id="student-booking-course"
                    required
                    value={entitlementId}
                    onChange={(event) => {
                        setEntitlementId(event.target.value)
                        setSlots([])
                        setSlotId('')
                        setError('')
                        setLoading(Boolean(event.target.value))
                    }}
                >
                    <option value="">Choisir un cours</option>
                    {eligible.map((e) => (
                        <option key={e.id} value={e.id}>
                            {e.course} · {e.remaining} séance(s) restante(s) · jusqu’au{' '}
                            {new Date(e.expiresAt).toLocaleDateString('fr-FR')}
                        </option>
                    ))}
                </select>
                <label htmlFor="student-booking-slot">Date et heure de la séance</label>
                <select
                    id="student-booking-slot"
                    value={slotId}
                    onChange={(event) => setSlotId(event.target.value)}
                    required
                    disabled={loading || !entitlementId || slots.length === 0}
                >
                    <option value="">{loading ? 'Chargement des créneaux…' : 'Choisir une date et une heure'}</option>
                    {slots.map((slot) => (
                        <option key={slot.id} value={slot.id}>
                            {dateLabel(slot.startsAt)} –{' '}
                            {new Date(slot.endsAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}{' '}
                            · {slot.places} place(s){slot.teacher ? ` · ${slot.teacher}` : ''}
                        </option>
                    ))}
                </select>
                {entitlementId && !loading && !error && slots.length === 0 && (
                    <p className="muted" role="status">
                        Aucune séance réservable pour ce cours et cet étudiant.
                    </p>
                )}
                {eligible.length === 0 && (
                    <p className="muted">Ajoutez d’abord un cours avec des séances disponibles.</p>
                )}
                <p className="muted">La réservation utilise une séance du solde de l’étudiant.</p>
                <div className="form_actions">
                    <button className="btn btn-medium" type="submit" disabled={loading || !slotId}>
                        {busy ? 'Réservation…' : 'Réserver la séance'}
                    </button>
                    <button className="btn btn-medium secondary" type="button" onClick={onClose}>
                        Annuler
                    </button>
                </div>
            </fieldset>
            {error && (
                <p className="error" role="alert">
                    {error}
                </p>
            )}
        </form>
    )
}
