'use client'
import { useState } from 'react'
import SidePanel from '@/components/side-panel'
import Toast from '@/components/toast'
import BookingActions, { type MovedBooking } from '@/components/booking-actions'
import { CalendarSlot, MonthCalendar, dateLabel } from '@/components/month-calendar'
import { availableEntitlement } from '@/lib/student-availability'
type Ent = {
    id: string
    courseId: string
    course: string
    total: number
    remaining: number
    bookingDelayHours: number
    expiresAt: string
    purchaseDate: string
    status: string
}
type Booking = {
    id: string
    slotId: string
    entitlementId: string
    course: string
    date: string
    endsAt: string
    teacher: string | null
    status: string
    cancellationHours: number
}
function BookingPanel({
    booking,
    entitlement,
    busy,
    onClose,
    onCancel,
    onMoved,
    onBusyChange,
}: {
    booking: Booking
    entitlement?: Ent
    busy: boolean
    onClose: () => void
    onCancel: () => void
    onMoved: (booking: MovedBooking) => void
    onBusyChange: (busy: boolean) => void
}) {
    const canCancel =
        booking.status === 'BOOKED' &&
        new Date(booking.date).getTime() - Date.now() >= booking.cancellationHours * 3600000
    return (
        <SidePanel titleId="booking-panel-title" busy={busy} onClose={onClose}>
            <span className="section_kicker">Ma réservation</span>
            <h2 id="booking-panel-title">{booking.course}</h2>
            <dl className="admin_settings">
                <div>
                    <dt>Statut</dt>
                    <dd>
                        {booking.status === 'BOOKED'
                            ? 'Confirmée'
                            : booking.status === 'CANCELLED'
                              ? 'Annulée'
                              : 'Terminée'}
                    </dd>
                </div>
                <div>
                    <dt>Début</dt>
                    <dd>{dateLabel(booking.date)}</dd>
                </div>
                <div>
                    <dt>Fin</dt>
                    <dd>{dateLabel(booking.endsAt)}</dd>
                </div>
                <div>
                    <dt>Durée</dt>
                    <dd>
                        {(
                            (new Date(booking.endsAt).getTime() - new Date(booking.date).getTime()) /
                            3600000
                        ).toLocaleString('fr-FR')}{' '}
                        h
                    </dd>
                </div>
                <div>
                    <dt>Professeur</dt>
                    <dd>{booking.teacher || 'Non attribué'}</dd>
                </div>
                {entitlement && (
                    <>
                        <div>
                            <dt>{entitlement.remaining > 1 ? 'Séances restantes' : 'Séance restante'}</dt>
                            <dd>
                                {entitlement.remaining} sur {entitlement.total}
                            </dd>
                        </div>
                        <div>
                            <dt>Validité du cours acheté</dt>
                            <dd>Jusqu’au {new Date(entitlement.expiresAt).toLocaleDateString('fr-FR')}</dd>
                        </div>
                    </>
                )}
            </dl>
            {booking.status === 'BOOKED' && (
                <>
                    <p className="muted">
                        Modification ou annulation possible jusqu’à {booking.cancellationHours}{' '}
                        {booking.cancellationHours > 1 ? 'heures' : 'heure'} avant la séance.
                    </p>
                    <BookingActions
                        bookingId={booking.id}
                        busy={busy}
                        onBusyChange={onBusyChange}
                        onMoved={onMoved}
                        canManage={canCancel}
                        onCancelRequest={onCancel}
                    />
                    {!canCancel && <p className="muted">Le délai d’annulation est dépassé.</p>}
                </>
            )}
        </SidePanel>
    )
}

function ReservationsPanel({
    reservations,
    busy,
    onClose,
    onCancel,
    onMoved,
    onBusyChange,
}: {
    reservations: Booking[]
    busy: boolean
    onClose: () => void
    onCancel: (booking: Booking) => void
    onMoved: (booking: MovedBooking) => void
    onBusyChange: (busy: boolean) => void
}) {
    const now = Date.now()
    const upcoming = reservations
        .filter((booking) => booking.status === 'BOOKED' && new Date(booking.endsAt).getTime() >= now)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const past = reservations
        .filter((booking) => booking.status !== 'BOOKED' || new Date(booking.endsAt).getTime() < now)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return (
        <SidePanel titleId="reservations-panel-title" busy={busy} onClose={onClose}>
            <span className="section_kicker">Mon agenda</span>
            <h2 id="reservations-panel-title">Mes réservations</h2>

            <section className="student_reservations_section" aria-labelledby="upcoming-reservations-title">
                <h3 id="upcoming-reservations-title">À venir</h3>
                {upcoming.length === 0 && <p className="muted">Aucune réservation à venir.</p>}
                {upcoming.map((booking) => {
                    const canManage = new Date(booking.date).getTime() - now >= booking.cancellationHours * 3600000
                    return (
                        <article className="student_reservation_card" key={booking.id}>
                            <div>
                                <strong>{booking.course}</strong>
                                <p>{dateLabel(booking.date)}</p>
                                <p className="muted">{booking.teacher || 'Professeur non attribué'}</p>
                            </div>
                            <BookingActions
                                bookingId={booking.id}
                                busy={busy}
                                onBusyChange={onBusyChange}
                                onMoved={onMoved}
                                canManage={canManage}
                                onCancelRequest={() => onCancel(booking)}
                            />
                            {!canManage && (
                                <p className="muted">Le délai de modification et d’annulation est dépassé.</p>
                            )}
                        </article>
                    )
                })}
            </section>

            <section className="student_reservations_section" aria-labelledby="past-reservations-title">
                <h3 id="past-reservations-title">Passées</h3>
                {past.length === 0 && <p className="muted">Aucune réservation passée.</p>}
                {past.map((booking) => (
                    <article className="student_reservation_card student_reservation_past" key={booking.id}>
                        <div>
                            <strong>{booking.course}</strong>
                            <p>{dateLabel(booking.date)}</p>
                            <p className="muted">
                                {booking.status === 'CANCELLED' ? 'Annulée' : 'Terminée'}
                                {booking.teacher ? ` · ${booking.teacher}` : ''}
                            </p>
                        </div>
                    </article>
                ))}
            </section>
        </SidePanel>
    )
}

export default function StudentDashboard({ entitlements, bookings }: { entitlements: Ent[]; bookings: Booking[] }) {
    const [items, setItems] = useState(entitlements),
        [reservations, setReservations] = useState(bookings),
        [selected, setSelected] = useState<CalendarSlot | null>(null),
        [refresh, setRefresh] = useState(0),
        [busy, setBusy] = useState(false),
        [message, setMessage] = useState('')
    const [openedBookingId, setOpenedBookingId] = useState<string | null>(null)
    const [reservationsOpen, setReservationsOpen] = useState(false)
    const [successToast, setSuccessToast] = useState<{ id: number; message: string } | null>(null)
    const openedBooking = reservations.find((booking) => booking.id === openedBookingId)
    function entitlementFor(slot: CalendarSlot) {
        return availableEntitlement(items, slot)
    }
    const current = selected ? entitlementFor(selected) : undefined
    async function reserve() {
        if (!selected || !current) return
        setBusy(true)
        setMessage('')
        try {
            const r = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    entitlementId: current.id,
                    slotId: selected.id,
                }),
            })
            const data = await r.json()
            if (!r.ok) throw Error(data.error || 'Réservation refusée')
            setItems((old) => old.map((e) => (e.id === current.id ? { ...e, remaining: e.remaining - 1 } : e)))
            setReservations((old) => [
                ...old,
                {
                    id: data.id,
                    slotId: selected.id,
                    entitlementId: current.id,
                    endsAt: selected.endsAt,
                    teacher: selected.teacher ?? null,
                    course: current.course,
                    date: selected.startsAt,
                    status: 'BOOKED',
                    cancellationHours: selected.cancellationHours ?? 48,
                },
            ])
            setSelected(null)
            setRefresh((n) => n + 1)
            setSuccessToast((previous) => ({
                id: (previous?.id ?? 0) + 1,
                message: 'Votre réservation est confirmée.',
            }))
        } catch (e) {
            setMessage(e instanceof Error ? e.message : 'Erreur')
        } finally {
            setBusy(false)
        }
    }
    async function cancel(id: string) {
        if (busy || !confirm('Annuler cette réservation ?')) return
        setBusy(true)
        setMessage('')
        try {
            const r = await fetch('/api/bookings', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            })
            const data = await r.json()
            if (!r.ok) throw Error(data.error)
            const b = reservations.find((x) => x.id === id)
            setReservations((old) => old.map((x) => (x.id === id ? { ...x, status: 'CANCELLED' } : x)))
            if (b)
                setItems((old) => old.map((e) => (e.id === b.entitlementId ? { ...e, remaining: e.remaining + 1 } : e)))
            setRefresh((n) => n + 1)
            setSuccessToast((previous) => ({ id: (previous?.id ?? 0) + 1, message: 'Réservation annulée.' }))
        } catch (e) {
            setMessage(e instanceof Error ? e.message : 'Erreur')
        } finally {
            setBusy(false)
        }
    }
    function moved(booking: MovedBooking) {
        setReservations((current) => current.map((item) => (item.id === booking.id ? booking : item)))
        setRefresh((n) => n + 1)
        setSuccessToast((previous) => ({
            id: (previous?.id ?? 0) + 1,
            message: 'Réservation déplacée.',
        }))
    }
    return (
        <>
            {successToast && <Toast key={successToast.id} message={successToast.message} variant="success" />}
            <div className="student_workspace">
                <aside className="student_summary">
                    <div className="hero_panel">
                        <div>
                            <div className="section_kicker">Etudiant</div>
                            <h1>Mes cours & réservations</h1>
                            <p>Réservez un cours dans le calendrier.</p>
                        </div>
                    </div>
                    <div className="card">
                        <h2>Mes séances restantes</h2>
                        {items.length === 0 && <p className="muted">Aucun cours acheté.</p>}
                        {items.map((e) => (
                            <div className="student_entitlement" key={e.id}>
                                <strong>{e.course}</strong>
                                <div className="metric_value">
                                    {e.remaining}{' '}
                                    <span>
                                        {e.remaining > 1 ? 'séances restantes' : 'séance restante'} sur {e.total}
                                    </span>
                                </div>
                                <p className="muted">Expire le {new Date(e.expiresAt).toLocaleDateString('fr-FR')}</p>
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        className="card student_reservations_cta"
                        onClick={() => {
                            setReservationsOpen(true)
                            setMessage('')
                        }}
                    >
                        <span>Voir mes réservations</span>
                        <span aria-hidden="true">→</span>
                    </button>
                </aside>
                <div className="card student_calendar">
                    <MonthCalendar
                        mode="student"
                        showLegend={false}
                        canReserveSlot={(slot) => !!entitlementFor(slot)}
                        bookedSlotIds={reservations
                            .filter((b) => b.status === 'BOOKED' || b.status === 'COMPLETED')
                            .map((b) => b.slotId)}
                        refresh={refresh}
                        onSelect={(slot) => {
                            const booking = reservations.find(
                                (b) => b.slotId === slot.id && (b.status === 'BOOKED' || b.status === 'COMPLETED'),
                            )
                            if (booking) {
                                setOpenedBookingId(booking.id)
                                setMessage('')
                            } else if (entitlementFor(slot)) {
                                setSelected(slot)
                                setMessage('')
                            }
                        }}
                    />
                </div>
            </div>
            {openedBooking && (
                <BookingPanel
                    key={openedBooking.id}
                    booking={openedBooking}
                    entitlement={items.find((e) => e.id === openedBooking.entitlementId)}
                    busy={busy}
                    onClose={() => setOpenedBookingId(null)}
                    onCancel={() => void cancel(openedBooking.id)}
                    onBusyChange={setBusy}
                    onMoved={moved}
                />
            )}
            {reservationsOpen && (
                <ReservationsPanel
                    reservations={reservations}
                    busy={busy}
                    onClose={() => setReservationsOpen(false)}
                    onCancel={(booking) => void cancel(booking.id)}
                    onMoved={moved}
                    onBusyChange={setBusy}
                />
            )}
            {message && <Toast message={message} variant="error" />}
            {selected && current && (
                <SidePanel titleId="reserve-panel-title" busy={busy} onClose={() => setSelected(null)}>
                    <span className="section_kicker">Réserver une séance</span>
                    <h2 id="reserve-panel-title">{selected.course}</h2>
                    <dl className="admin_settings">
                        <div>
                            <dt>Début</dt>
                            <dd>{dateLabel(selected.startsAt)}</dd>
                        </div>
                        <div>
                            <dt>Fin</dt>
                            <dd>{dateLabel(selected.endsAt)}</dd>
                        </div>
                        <div>
                            <dt>Durée</dt>
                            <dd>
                                {(
                                    (new Date(selected.endsAt).getTime() - new Date(selected.startsAt).getTime()) /
                                    3600000
                                ).toLocaleString('fr-FR')}{' '}
                                h
                            </dd>
                        </div>
                        <div>
                            <dt>Professeur</dt>
                            <dd>{selected.teacher || 'Non attribué'}</dd>
                        </div>
                        <div>
                            <dt>Places disponibles</dt>
                            <dd>
                                {Math.max(0, selected.capacity - selected.reserved)} sur {selected.capacity}
                            </dd>
                        </div>
                    </dl>
                    <p className="muted">
                        {current.remaining === 1
                            ? 'Cette réservation utilisera votre dernière séance disponible.'
                            : `Cette réservation utilisera une de vos ${current.remaining} séances disponibles.`}
                    </p>
                    <button className="btn btn-medium" type="button" onClick={reserve} disabled={busy}>
                        {busy ? 'Réservation…' : 'Confirmer la réservation'}
                    </button>
                </SidePanel>
            )}
        </>
    )
}
