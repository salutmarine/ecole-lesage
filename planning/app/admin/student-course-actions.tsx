'use client'
import { useState } from 'react'
import type { StudentEntitlement } from './student-credits'

export default function StudentCourseActions({
    userId,
    entitlement,
    busy,
    onBusyChange,
    onUpdated,
    onDeleted,
    onNotify,
}: {
    userId: string
    entitlement: StudentEntitlement
    busy: boolean
    onBusyChange: (busy: boolean) => void
    onUpdated: (entitlement: StudentEntitlement) => void
    onDeleted: (id: string) => void
    onNotify: (message: string) => void
}) {
    const [editing, setEditing] = useState(false)
    const [total, setTotal] = useState(entitlement.total)
    const [error, setError] = useState('')
    const used = entitlement.bookings.filter(
        (booking) => booking.status === 'BOOKED' || booking.status === 'COMPLETED',
    ).length
    async function save(remove = false) {
        if (busy) return
        if (
            remove &&
            !confirm(
                `Supprimer le cours « ${entitlement.course} » de cet étudiant ? Toutes les réservations et l’historique de séances associés à cet achat seront également supprimés.`,
            )
        )
            return
        onBusyChange(true)
        setError('')
        try {
            const response = await fetch('/api/admin/entitlements', {
                method: remove ? 'DELETE' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    entitlementId: entitlement.id,
                    ...(!remove ? { action: 'set-sessions', sessions: total } : {}),
                }),
            })
            const data = await response.json()
            if (!response.ok) throw Error(data.error || 'Modification impossible.')
            if (remove) onDeleted(entitlement.id)
            else onUpdated(data)
            setEditing(false)
            onNotify(remove ? 'Cours supprimé de l’étudiant.' : 'Nombre de séances mis à jour.')
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Modification impossible.')
        } finally {
            onBusyChange(false)
        }
    }
    return (
        <div className="student_credit_tools">
            <div className="form_actions">
                <button
                    type="button"
                    className="btn secondary"
                    disabled={busy}
                    onClick={() => {
                        setTotal(entitlement.total)
                        setEditing(!editing)
                        setError('')
                    }}
                >
                    Modifier le nombre de séances
                </button>
                <button type="button" className="btn danger" disabled={busy} onClick={() => void save(true)}>
                    Supprimer ce cours
                </button>
            </div>
            {editing && (
                <form
                    className="student_credit_form"
                    onSubmit={(event) => {
                        event.preventDefault()
                        void save()
                    }}
                >
                    <label htmlFor={`sessions-${entitlement.id}`}>Nombre total de séances</label>
                    <input
                        id={`sessions-${entitlement.id}`}
                        type="number"
                        min={used}
                        max={100000}
                        step={1}
                        required
                        disabled={busy}
                        value={total}
                        onChange={(event) => setTotal(Number(event.target.value))}
                    />
                    <p className="muted student_credit_balance">
                        {used} séances réservées ou effectuées. Le nouveau solde sera de {Math.max(0, total - used)}{' '}
                        séances.
                    </p>
                    <div className="form_actions">
                        <button className="btn" type="submit" disabled={busy}>
                            Enregistrer
                        </button>
                        <button
                            className="btn secondary"
                            type="button"
                            disabled={busy}
                            onClick={() => setEditing(false)}
                        >
                            Annuler
                        </button>
                    </div>
                </form>
            )}
            {error && (
                <p className="error" role="alert">
                    {error}
                </p>
            )}
        </div>
    )
}
