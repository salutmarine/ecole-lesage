'use client'
import { useState } from 'react'
import StudentBooking from './student-booking'

export type StudentEntitlement = {
    id: string
    courseId: string
    course: string
    total: number
    remaining: number
    status: string
    purchaseDate: string
    expiresAt: string
    bookings: { id: string; course: string; startsAt: string; endsAt: string; status: string; attendance: string }[]
}
export default function StudentCredits({
    userId,
    courses,
    entitlements,
    busy,
    onBusyChange,
    onUpdated,
    onNotify,
}: {
    userId: string
    courses: { id: string; name: string }[]
    entitlements: StudentEntitlement[]
    busy: boolean
    onBusyChange: (busy: boolean) => void
    onUpdated: (entitlement: StudentEntitlement) => void
    onNotify: (message: string) => void
}) {
    const [action, setAction] = useState<'add-course' | 'add-sessions' | 'book-session' | null>(null)
    const [error, setError] = useState('')
    const eligible = entitlements.filter((e) => e.status === 'ACTIVE' && new Date(e.expiresAt) > new Date())
    const defaultExpiry = new Date()
    defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 1)
    const localDate = (date: Date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (busy || !action || action === 'book-session') return
        const form = new FormData(event.currentTarget)
        onBusyChange(true)
        setError('')
        try {
            const response = await fetch('/api/admin/entitlements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    userId,
                    sessions: Number(form.get('sessions')),
                    ...(action === 'add-course'
                        ? {
                              courseId: form.get('courseId'),
                              expiresAt: new Date(`${form.get('expiresAt')}T23:59:59`).toISOString(),
                          }
                        : { entitlementId: form.get('entitlementId') }),
                }),
            })
            const data = await response.json()
            if (!response.ok) throw Error(data.error || 'Ajout impossible.')
            onUpdated(data)
            onNotify(action === 'add-course' ? 'Cours ajouté à l’étudiant.' : 'Séances ajoutées à l’étudiant.')
            setAction(null)
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Ajout impossible.')
        } finally {
            onBusyChange(false)
        }
    }
    return (
        <section className="student_credit_tools">
            <div className="form_actions">
                <button
                    type="button"
                    className="btn"
                    disabled={busy || courses.length === 0}
                    aria-expanded={action === 'add-course'}
                    onClick={() => {
                        setAction('add-course')
                        setError('')
                    }}
                >
                    Ajouter un cours
                </button>
                <button
                    type="button"
                    className="btn secondary"
                    disabled={busy || eligible.length === 0}
                    aria-expanded={action === 'add-sessions'}
                    onClick={() => {
                        setAction('add-sessions')
                        setError('')
                    }}
                >
                    Ajouter des séances
                </button>
                <button
                    type="button"
                    className="btn secondary"
                    disabled={busy || !eligible.some((e) => e.remaining > 0)}
                    aria-expanded={action === 'book-session'}
                    onClick={() => {
                        setAction('book-session')
                        setError('')
                    }}
                >
                    Réserver une séance
                </button>
            </div>
            {action === 'book-session' && (
                <StudentBooking
                    userId={userId}
                    entitlements={entitlements}
                    busy={busy}
                    onBusyChange={onBusyChange}
                    onUpdated={onUpdated}
                    onNotify={onNotify}
                    onClose={() => setAction(null)}
                />
            )}
            {action && action !== 'book-session' && (
                <form key={action} className="student_credit_form" onSubmit={submit}>
                    <h4>{action === 'add-course' ? 'Ajouter un cours' : 'Créditer des séances'}</h4>
                    <fieldset disabled={busy}>
                        <label htmlFor="credit-course">
                            {action === 'add-course' ? 'Cours à ajouter' : 'Cours de l’étudiant'}
                        </label>
                        <select
                            id="credit-course"
                            name={action === 'add-course' ? 'courseId' : 'entitlementId'}
                            defaultValue=""
                            required
                        >
                            <option value="">Choisir un cours</option>
                            {action === 'add-course'
                                ? courses.map((c) => (
                                      <option key={c.id} value={c.id}>
                                          {c.name}
                                      </option>
                                  ))
                                : eligible.map((e) => (
                                      <option key={e.id} value={e.id}>
                                          {e.course} · {e.remaining} restante(s) · valable jusqu’au{' '}
                                          {new Date(e.expiresAt).toLocaleDateString('fr-FR')}
                                      </option>
                                  ))}
                        </select>
                        <label htmlFor="credit-sessions">Nombre de séances à ajouter</label>
                        <input
                            id="credit-sessions"
                            name="sessions"
                            type="number"
                            min={1}
                            max={1000}
                            step={1}
                            defaultValue={1}
                            required
                        />
                        {action === 'add-course' && (
                            <>
                                <label htmlFor="credit-expiry">Valable jusqu’au</label>
                                <input
                                    id="credit-expiry"
                                    name="expiresAt"
                                    type="date"
                                    min={localDate(new Date())}
                                    defaultValue={localDate(defaultExpiry)}
                                    required
                                />
                            </>
                        )}
                        <p className="muted">
                            {action === 'add-course'
                                ? 'Le cours est attribué dès aujourd’hui, sans créer de commande ni de paiement.'
                                : 'Les séances s’ajoutent au solde. La date de validité reste la même.'}
                        </p>
                        <div className="form_actions">
                            <button className="btn btn-medium" type="submit">
                                {busy ? 'Ajout…' : 'Confirmer l’ajout'}
                            </button>
                            <button className="btn btn-medium secondary" type="button" onClick={() => setAction(null)}>
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
            )}
        </section>
    )
}
