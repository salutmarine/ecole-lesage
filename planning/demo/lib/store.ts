import catalogue from '../../data/lesage/catalogue.json'
export type Person = {
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string | null
    language: string
    role: 'STUDENT' | 'TEACHER'
}
export type Course = {
    id: string
    name: string
    level: Slot['level']
    durationMinutes: number
    totalDurationMinutes: number
    capacity: number
    reminderDays: number | null
    cancellationHours: number
    defaultTeacherId: string | null
    minGapHours: number
    bookingDelayHours: number
}
export const sourceCatalogue = catalogue
export const STORAGE_KEY = 'lesage-pages-demo-v2'
export type Slot = {
    id: string
    courseId: string
    course: string
    level: 'INITIATION' | 'PERFECTIONNEMENT' | 'SPECIALISATION'
    teacher: string
    startsAt: string
    endsAt: string
    cancellationHours: number
    capacity: number
    reserved: number
    blocked: boolean
}
export type Booking = {
    id: string
    slotId: string
    entitlementId: string
    course: string
    date: string
    endsAt: string
    teacher: string | null
    status: string
    cancellationHours: number
    attendance: string
}
export type Entitlement = {
    userId?: string
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
export type State = {
    version: 2
    slots: Slot[]
    entitlements: Entitlement[]
    bookings: Booking[]
    courses?: Course[]
    people?: Person[]
}
export function createState(now = new Date(), withDemoBookings = true): State {
    const courses = [
        catalogue.find((c) => c.name === 'DECOUVERTE AIGUILLE : CŒUR BAROQUE')!,
        catalogue.find((c) => c.name === 'HAUTE COUTURE')!,
    ]
    const entitlements = courses.map((c, i) => ({
        id: `credit-${i}`,
        courseId: `course-${i}`,
        course: c.name,
        total: 8,
        remaining: 8,
        bookingDelayHours: 0,
        purchaseDate: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
        expiresAt: new Date(now.getFullYear() + 1, now.getMonth() + 4, 1).toISOString(),
        status: 'ACTIVE',
    }))
    const slots: Slot[] = []
    for (let day = 1; day <= 190; day++) {
        const date = new Date(now.getFullYear(), now.getMonth(), day, 9, 30)
        if ([0, 6].includes(date.getDay())) continue
        for (let half = 0; half < 2; half++) {
            const i = (day + half) % courses.length
            const start = new Date(date)
            if (half) start.setHours(14, 0, 0, 0)
            slots.push({
                id: `slot-${day}-${half}`,
                courseId: `course-${i}`,
                course: courses[i].name,
                level: courses[i].level as Slot['level'],
                teacher: half ? 'Camille Martin' : 'Louise Bernard',
                startsAt: start.toISOString(),
                endsAt: new Date(start.getTime() + 3 * 3600000).toISOString(),
                cancellationHours: 48,
                capacity: 6,
                reserved: 0,
                blocked: false,
            })
        }
    }
    const bookings: Booking[] = []
    if (withDemoBookings) {
        const heartSlot = slots.find(
            (slot) => slot.course === 'DECOUVERTE AIGUILLE : CŒUR BAROQUE' && new Date(slot.startsAt) > now,
        )
        const coutureSlot = slots.find((slot) => {
            const date = new Date(slot.startsAt)
            return slot.course === 'HAUTE COUTURE' && date.getMonth() === now.getMonth() && date.getDate() === 10
        })
        for (const [slot, entitlement] of [
            [heartSlot, entitlements[0]],
            [coutureSlot, entitlements[1]],
        ] as const) {
            if (!slot || !entitlement) continue
            bookings.push({
                id: `booking-demo-${slot.id}`,
                slotId: slot.id,
                entitlementId: entitlement.id,
                course: slot.course,
                date: slot.startsAt,
                endsAt: slot.endsAt,
                teacher: slot.teacher,
                status: 'BOOKED',
                cancellationHours: slot.cancellationHours,
                attendance: 'UNMARKED',
            })
            slot.reserved++
        }
        if (coutureSlot) coutureSlot.reserved = coutureSlot.capacity
    }
    return { version: 2, entitlements, slots, bookings }
}
let current: State | undefined
export function loadState(): State {
    if (current) return current
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
            const parsed = JSON.parse(raw) as State
            if (
                parsed.version === 2 &&
                Array.isArray(parsed.slots) &&
                Array.isArray(parsed.entitlements) &&
                Array.isArray(parsed.bookings) &&
                parsed.slots.some((s) => new Date(s.startsAt).getTime() > Date.now())
            )
                current = parsed
        }
    } catch {
        /* Browsers may disable persistence. The demo still works in memory. */
    }
    return (current ??= createState())
}
export function saveState(state: State) {
    current = state
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
        /* In-memory fallback. */
    }
}
export function resetState() {
    const state = createState()
    saveState(state)
    return state
}
export function remaining(state: State) {
    return state.entitlements.map((e) => ({
        ...e,
        remaining: e.total - state.bookings.filter((b) => b.entitlementId === e.id && b.status !== 'CANCELLED').length,
    }))
}
export function validateSlot(state: State, entitlementId: string, slotId: string, excluding?: string) {
    const slot = state.slots.find((s) => s.id === slotId)
    const credit = remaining(state).find((e) => e.id === entitlementId)
    if (!slot || !credit || slot.courseId !== credit.courseId) throw Error('Choisissez une séance du même cours.')
    if (slot.blocked || new Date(slot.startsAt).getTime() <= Date.now()) throw Error('Ce créneau est indisponible.')
    if (slot.reserved >= slot.capacity) throw Error('Ce créneau est complet.')
    if (!excluding && credit.remaining <= 0) throw Error('Vous n’avez plus de séances disponibles.')
    if (new Date(slot.startsAt) >= new Date(credit.expiresAt)) throw Error('Ce crédit a expiré.')
    const conflict = state.bookings.some(
        (b) =>
            b.id !== excluding &&
            (state.entitlements.find((e) => e.id === b.entitlementId)?.userId ?? 'student-demo') ===
                (credit.userId ?? 'student-demo') &&
            b.status === 'BOOKED' &&
            new Date(b.date) < new Date(slot.endsAt) &&
            new Date(b.endsAt) > new Date(slot.startsAt),
    )
    if (conflict) throw Error('Vous avez déjà une réservation à cet horaire.')
    return slot
}
export function mutateBooking(
    state: State,
    method: string,
    body: { id?: string; slotId?: string; entitlementId?: string },
): Booking | { ok: boolean } {
    if (method === 'POST') {
        const slot = validateSlot(state, body.entitlementId ?? '', body.slotId ?? '')
        const booking: Booking = {
            id: crypto.randomUUID(),
            slotId: slot.id,
            entitlementId: body.entitlementId!,
            course: slot.course,
            date: slot.startsAt,
            endsAt: slot.endsAt,
            teacher: slot.teacher,
            status: 'BOOKED',
            cancellationHours: slot.cancellationHours,
            attendance: 'UNMARKED',
        }
        state.bookings.push(booking)
        slot.reserved++
        return booking
    }
    const booking = state.bookings.find((b) => b.id === body.id)
    if (!booking || booking.status !== 'BOOKED') throw Error('Réservation introuvable ou déjà annulée.')
    if (new Date(booking.date).getTime() - Date.now() < booking.cancellationHours * 3600000)
        throw Error('Le délai de modification de 48 h est dépassé.')
    const previous = state.slots.find((s) => s.id === booking.slotId)!
    if (method === 'DELETE') {
        booking.status = 'CANCELLED'
        previous.reserved--
        return { ok: true }
    }
    if (method !== 'PATCH') throw Error('Action inconnue.')
    const slot = validateSlot(state, booking.entitlementId, body.slotId ?? '', booking.id)
    previous.reserved--
    slot.reserved++
    Object.assign(booking, {
        slotId: slot.id,
        course: slot.course,
        date: slot.startsAt,
        endsAt: slot.endsAt,
        teacher: slot.teacher,
        attendance: 'UNMARKED',
    })
    return booking
}
// This adapter never sends an HTTP request: existing UI components use browser-local data.
export async function demoFetch(input: string, init?: RequestInit): Promise<Response> {
    try {
        const url = new URL(input, 'https://demo.invalid')
        const state = structuredClone(loadState())
        let result: unknown
        if (url.pathname === '/api/slots')
            result = (await import('./admin-store'))
                .calendarSlots(state)
                .filter((s) => s.startsAt.slice(0, 7) === url.searchParams.get('month'))
        else if (url.pathname === '/api/bookings/available-slots') {
            const booking = state.bookings.find((b) => b.id === url.searchParams.get('bookingId'))
            if (!booking) throw Error('Réservation introuvable.')
            result = state.slots.filter((s) => {
                if (s.id === booking.slotId) return false
                try {
                    validateSlot(state, booking.entitlementId, s.id, booking.id)
                    return true
                } catch {
                    return false
                }
            })
        } else if (url.pathname === '/api/bookings') {
            result = mutateBooking(state, init?.method ?? '', JSON.parse(String(init?.body ?? '{}')))
            saveState(state)
        } else {
            const { adminRequest } = await import('./admin-store')
            const response = await adminRequest(state, url, init)
            if (response instanceof Response) return response
            result = response
            if (init?.method && init.method !== 'GET') saveState(state)
        }
        return Response.json(result)
    } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : 'Erreur' }, { status: 400 })
    }
}
